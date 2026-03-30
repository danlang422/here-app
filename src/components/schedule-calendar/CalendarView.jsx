import { useState, useMemo } from 'react'
import useAuthStore from '@/store/authStore'
import useUIStore from '@/store/uiStore'
import { useCalendarUiStore } from '@/store/calendarUiStore'
import { useActivities } from '@/hooks/useActivities'
import { useCalendars } from '@/hooks/useCalendars'
import { useOrgEnrollments } from '@/hooks/useEnrollments'
import { useSchoolDays } from '@/hooks/useSchoolDays'
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useStaffUsers } from '@/hooks/useUsers'
import { useTerms } from '@/hooks/useTerms'
import { addDays, formatDateISO } from '@/lib/scheduleUtils'
import {
  timeToMinutes,
  floorToHour,
  ceilToHour,
  DEFAULT_GRID_START,
  DEFAULT_GRID_END,
} from '@/components/agenda/agendaUtils'
import { CalendarWeekNav, getWeekStart } from './CalendarWeekNav'
import { CalendarFilterBar } from './CalendarFilterBar'
import { CalendarSidebar } from './CalendarSidebar'
import { CalendarWeekGrid } from './CalendarWeekGrid'
import { CalendarEventPopover } from './CalendarEventPopover'
import { CalendarAggregatePopover } from './CalendarAggregatePopover'

export function CalendarView() {
  const orgId = useAuthStore((s) => s.profile?.organization_id)

  // Server state
  const { data: activities = [] } = useActivities(orgId)
  const { data: calendars = [] } = useCalendars(orgId)
  const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)
  const { data: template } = useDefaultScheduleTemplate(orgId)
  const { data: orgSettings = {} } = useOrgSettings(orgId)
  const { data: staffUsers = [] } = useStaffUsers(orgId)
  const { data: terms = [] } = useTerms(orgId)

  // Week anchor
  const selectedDate = useUIStore((s) => s.selectedDate)
  const weekStart = getWeekStart(selectedDate ?? new Date())
  const weekDates = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i))

  // School days for the visible week
  const { data: schoolDays = [] } = useSchoolDays(
    orgId,
    formatDateISO(weekDates[0]),
    formatDateISO(weekDates[4])
  )
  const schoolDaysByDate = useMemo(
    () => Object.fromEntries(schoolDays.map((sd) => [sd.date, sd])),
    [schoolDays]
  )

  // Calendar visibility filter
  const { isCalendarVisible } = useCalendarUiStore()
  const visibleActivities = useMemo(
    () => activities.filter((a) => a.calendar_id === null || isCalendarVisible(a.calendar_id)),
    [activities, isCalendarVisible]
  )

  // Text filter
  const [filterText, setFilterText] = useState('')
  const filteredActivities = useMemo(() => {
    if (!filterText.trim()) return visibleActivities
    const lower = filterText.trim().toLowerCase()
    return visibleActivities.filter((a) => {
      if (a.name?.toLowerCase().includes(lower)) return true
      if (a.teacher?.first_name?.toLowerCase().includes(lower)) return true
      if (a.teacher?.last_name?.toLowerCase().includes(lower)) return true
      return false
    })
  }, [visibleActivities, filterText])

  // Enrollment count map
  const enrollmentCountByActivity = useMemo(() => {
    const map = {}
    orgEnrollments.forEach((e) => {
      map[e.activity_id] = (map[e.activity_id] ?? 0) + 1
    })
    return map
  }, [orgEnrollments])

  // Grid bounds — same pattern as AgendaView
  const gridBounds = useMemo(() => {
    const timed = visibleActivities.filter((a) => a.default_start_time && a.default_end_time)
    if (timed.length === 0) {
      return { start: DEFAULT_GRID_START, end: DEFAULT_GRID_END }
    }
    const starts = timed.map((a) => a.default_start_time)
    const ends = timed.map((a) => a.default_end_time)
    const minStart = starts.reduce((a, b) => (a < b ? a : b))
    const maxEnd = ends.reduce((a, b) => (a > b ? a : b))
    return {
      start: minStart < DEFAULT_GRID_START ? floorToHour(minStart) : DEFAULT_GRID_START,
      end: maxEnd > DEFAULT_GRID_END ? ceilToHour(maxEnd) : DEFAULT_GRID_END,
    }
  }, [visibleActivities])

  const gridStartMinutes = timeToMinutes(gridBounds.start)
  const gridEndMinutes = timeToMinutes(gridBounds.end)

  // Popover state
  const [popover, setPopover] = useState(null)
  // null | { activity } | { prefillData: { date, startTime, calendarId } }
  const [aggregatePopover, setAggregatePopover] = useState(null)
  // null | { aggregateData: { count, totalEnrollment, activities }, position: { x, y } }

  function handleActivityClick(activity) {
    setPopover({ activity })
  }

  function handleEmptyClick(date, startTime) {
    setPopover({ prefillData: { date, startTime, calendarId: null } })
  }

  function handleAggregateClick(aggregateData, event) {
    setAggregatePopover({ aggregateData, position: { x: event.clientX, y: event.clientY } })
  }

  return (
    <div className="flex flex-col h-full">
      <CalendarWeekNav />
      <CalendarFilterBar filterText={filterText} onFilterChange={setFilterText} />

      <div className="flex flex-1 overflow-hidden">
        <CalendarSidebar
          calendars={calendars}
          staffUsers={staffUsers}
          orgId={orgId}
        />

        <CalendarWeekGrid
          weekDates={weekDates}
          schoolDaysByDate={schoolDaysByDate}
          activities={filteredActivities}
          enrollmentCountByActivity={enrollmentCountByActivity}
          gridStartMinutes={gridStartMinutes}
          gridEndMinutes={gridEndMinutes}
          blockDefinitions={template?.block_definitions}
          blockLabels={orgSettings?.block_labels}
          onEmptyClick={handleEmptyClick}
          onActivityClick={handleActivityClick}
          onAggregateClick={handleAggregateClick}
        />
      </div>

      {aggregatePopover && (
        <CalendarAggregatePopover
          aggregateData={aggregatePopover.aggregateData}
          position={aggregatePopover.position}
          onClose={() => setAggregatePopover(null)}
          onActivityClick={(activity) => {
            setAggregatePopover(null)
            handleActivityClick(activity)
          }}
          enrollmentCountByActivity={enrollmentCountByActivity}
        />
      )}

      {popover && (
        <CalendarEventPopover
          activity={popover.activity ?? null}
          prefillData={popover.prefillData ?? null}
          onClose={() => setPopover(null)}
          orgId={orgId}
          orgSettings={orgSettings}
          defaultTemplate={template}
          terms={terms}
          calendars={calendars}
        />
      )}
    </div>
  )
}
