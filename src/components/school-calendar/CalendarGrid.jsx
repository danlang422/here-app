import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useSchoolDays } from '@/hooks/useSchoolDays'
import { upsertSchoolDay, bulkUpsertSchoolDays, getSchoolDays } from '@/api/schoolDays'
import { recalculateRotationDays } from '@/lib/business-logic/rotation'
import { getWeekdaysInRange } from '@/lib/business-logic/schoolDayGeneration'
import DayPopover from './DayPopover'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// Fixed rotation label colors by index
const ROTATION_COLORS = [
  'text-blue-600',
  'text-green-600',
  'text-purple-600',
  'text-orange-600',
]

function getMonthRange(year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    year: start.getFullYear(),
    month: start.getMonth(),
  }
}

function getMonthLabel(year, month) {
  const d = new Date(year, month, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Build the grid of weekday cells for a given month.
 * Returns an array of weeks, each containing 5 cells (Mon-Fri).
 * Cells may be null (padding before/after month days).
 */
function buildMonthGrid(year, month) {
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  const weeks = []
  let currentWeek = [null, null, null, null, null]
  let hasContent = false

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dow = date.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

    // Skip weekends
    if (dow === 0 || dow === 6) continue

    const weekdayIndex = dow - 1 // 0=Mon, 1=Tue, ..., 4=Fri

    // If this weekday is earlier than or same as what we've seen, start a new week
    if (hasContent && weekdayIndex === 0) {
      weeks.push(currentWeek)
      currentWeek = [null, null, null, null, null]
    }

    currentWeek[weekdayIndex] = {
      day,
      date: date.toISOString().slice(0, 10),
    }
    hasContent = true
  }

  // Push the last week if it has content
  if (hasContent) {
    weeks.push(currentWeek)
  }

  return weeks
}

function getDayStatus(schoolDay) {
  if (!schoolDay) return 'outside' // no school_days row
  if (schoolDay.is_school_day) return 'school'
  return schoolDay.override_reason || 'cancelled'
}

function getDayCellClasses(status, isToday) {
  let bg = ''
  switch (status) {
    case 'school':
      bg = 'bg-base-100'
      break
    case 'planned_holiday':
      bg = 'bg-base-200 text-base-content/50'
      break
    case 'weather':
      bg = 'bg-amber-50'
      break
    case 'emergency':
      bg = 'bg-red-50'
      break
    case 'outside':
      bg = 'bg-transparent'
      break
    default:
      bg = 'bg-base-200'
  }

  const todayRing = isToday ? 'ring-2 ring-blue-400' : ''
  return `${bg} ${todayRing}`
}

export default function CalendarGrid({ orgId, orgSettings, terms }) {
  const today = getTodayStr()
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [popover, setPopover] = useState(null) // { date, anchorRect }

  const queryClient = useQueryClient()
  const { startDate, endDate } = getMonthRange(viewDate.year, viewDate.month)
  const { data: schoolDays = [] } = useSchoolDays(orgId, startDate, endDate)

  const schoolDayMap = useMemo(() => {
    return new Map(schoolDays.map(d => [d.date, d]))
  }, [schoolDays])

  const rotationColorMap = useMemo(() => {
    const names = orgSettings?.rotation_day_names || ['A', 'B']
    const map = {}
    names.forEach((name, i) => {
      map[name] = ROTATION_COLORS[i % ROTATION_COLORS.length]
    })
    return map
  }, [orgSettings?.rotation_day_names])

  const weeks = useMemo(
    () => buildMonthGrid(viewDate.year, viewDate.month),
    [viewDate.year, viewDate.month]
  )

  function prevMonth() {
    setViewDate(prev => {
      const d = new Date(prev.year, prev.month - 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
    setPopover(null)
  }

  function nextMonth() {
    setViewDate(prev => {
      const d = new Date(prev.year, prev.month + 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
    setPopover(null)
  }

  function goToToday() {
    const now = new Date()
    setViewDate({ year: now.getFullYear(), month: now.getMonth() })
    setPopover(null)
  }

  function handleDayClick(cell, e) {
    if (!cell) return
    const rect = e.currentTarget.getBoundingClientRect()
    setPopover(prev =>
      prev?.date === cell.date ? null : { date: cell.date, anchorRect: rect }
    )
  }

  // Find the term that contains a given date (for rotation recalculation scope)
  function findTermForDate(dateStr) {
    return terms?.find(t => dateStr >= t.start_date && dateStr <= t.end_date)
  }

  async function handleMarkDayOff(date, reason, notes) {
    const existing = schoolDayMap.get(date)
    await upsertSchoolDay({
      organization_id: orgId,
      date,
      is_school_day: false,
      override_reason: reason,
      notes: notes || null,
      rotation_day: null,
      ...(existing?.id ? { id: existing.id } : {}),
    })

    // Recalculate rotation for the term containing this date
    await recalculateTermRotation(date)
    queryClient.invalidateQueries({ queryKey: ['school-days', orgId] })
    setPopover(null)
  }

  async function handleRestoreSchoolDay(date) {
    const existing = schoolDayMap.get(date)
    if (!existing) return

    await upsertSchoolDay({
      ...existing,
      is_school_day: true,
      override_reason: null,
      notes: null,
    })

    await recalculateTermRotation(date)
    queryClient.invalidateQueries({ queryKey: ['school-days', orgId] })
    setPopover(null)
  }

  async function handleMarkRange(startDateStr, endDateStr, reason, notes) {
    const weekdays = getWeekdaysInRange(startDateStr, endDateStr)

    // Fetch existing records for the full range — schoolDayMap only covers the current
    // month view, so a cross-month range would produce a mixed batch (some rows with id,
    // some without). PostgREST normalizes mixed batches by setting missing id to null,
    // which violates the NOT NULL constraint. Fetching the full range gives us consistent ids.
    const existingInRange = await getSchoolDays(orgId, startDateStr, endDateStr)
    const existingRangeMap = new Map(existingInRange.map(d => [d.date, d]))

    const rows = weekdays.map(date => {
      const existing = existingRangeMap.get(date)
      return {
        organization_id: orgId,
        date,
        is_school_day: false,
        override_reason: reason,
        notes: notes || null,
        rotation_day: null,
        ...(existing?.id ? { id: existing.id } : {}),
      }
    })

    if (rows.length > 0) {
      await bulkUpsertSchoolDays(rows)
    }

    await recalculateTermRotation(startDateStr)
    queryClient.invalidateQueries({ queryKey: ['school-days', orgId] })
    setPopover(null)
  }

  async function recalculateTermRotation(dateStr) {
    const term = findTermForDate(dateStr)
    if (!term || !orgSettings?.uses_rotation_schedule) return

    const allDays = await getSchoolDays(orgId, term.start_date, term.end_date)
    const updates = recalculateRotationDays(allDays, orgSettings)
    if (updates.length > 0) {
      await bulkUpsertSchoolDays(updates)
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body">
        {/* Header with navigation */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="card-title text-lg">School Calendar</h3>
          <div className="flex items-center gap-1">
            <button className="btn btn-ghost btn-xs" onClick={prevMonth}>
              <CaretLeft size={10} />
            </button>
            <button
              className="btn btn-ghost btn-xs font-medium min-w-25"
              onClick={goToToday}
              title="Go to current month"
            >
              {getMonthLabel(viewDate.year, viewDate.month)}
            </button>
            <button className="btn btn-ghost btn-xs" onClick={nextMonth}>
              <CaretRight size={10} />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-5 gap-1 mb-1">
          {WEEKDAY_LABELS.map(label => (
            <div key={label} className="text-center text-xs font-medium text-base-content/50 py-1">
              {label}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-5 gap-1">
              {week.map((cell, ci) => {
                if (!cell) {
                  return <div key={ci} className="aspect-square" />
                }

                const schoolDay = schoolDayMap.get(cell.date)
                const status = getDayStatus(schoolDay)
                const isToday = cell.date === today
                const cellClasses = getDayCellClasses(status, isToday)
                const rotationDay = schoolDay?.rotation_day
                const rotationColor = rotationDay ? (rotationColorMap[rotationDay] || 'text-base-content/60') : ''

                return (
                  <button
                    key={ci}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer hover:ring-1 hover:ring-base-300 transition-colors ${cellClasses} ${status === 'outside' ? 'text-base-content/30' : ''}`}
                    onClick={(e) => handleDayClick(cell, e)}
                    title={cell.date}
                  >
                    <span className="text-sm font-medium leading-none">{cell.day}</span>
                    {rotationDay && (
                      <span className={`text-[10px] font-bold leading-none mt-0.5 ${rotationColor}`}>
                        {rotationDay}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-base-content/60">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-base-100 border border-base-300" /> School
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-base-200" /> Holiday
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> Weather
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Emergency
          </span>
        </div>
      </div>

      {/* Day Popover */}
      {popover && (
        <DayPopover
          date={popover.date}
          anchorRect={popover.anchorRect}
          schoolDay={schoolDayMap.get(popover.date) || null}
          orgSettings={orgSettings}
          onMarkDayOff={handleMarkDayOff}
          onRestoreSchoolDay={handleRestoreSchoolDay}
          onMarkRange={handleMarkRange}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  )
}
