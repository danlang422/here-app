import { CalendarDayColumn } from './CalendarDayColumn'
import AgendaBlockOverlay from '@/components/agenda/AgendaBlockOverlay'
import { formatDateISO } from '@/lib/scheduleUtils'
import {
  minutesToPx,
  TIME_COL_WIDTH,
  DAY_COL_MIN_WIDTH,
  GRID_PAD_Y,
} from '@/components/agenda/agendaUtils'

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatHourLabel(hour) {
  if (hour === 0 || hour === 24) return '12a'
  if (hour === 12) return '12p'
  if (hour < 12) return `${hour}a`
  return `${hour - 12}p`
}

export function CalendarWeekGrid({
  weekDates,
  schoolDaysByDate,
  activities,
  enrollmentCountByActivity,
  gridStartMinutes,
  gridEndMinutes,
  blockDefinitions,
  blockLabels,
  onEmptyClick,
  onActivityClick,
  onAggregateClick,
  enrolledActivityIds = null,
}) {
  const totalMinutes = gridEndMinutes - gridStartMinutes
  const gridHeight = minutesToPx(totalMinutes) + GRID_PAD_Y * 2

  const startHour = Math.floor(gridStartMinutes / 60)
  const endHour = Math.ceil(gridEndMinutes / 60)
  const hours = []
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Day column headers */}
      <div className="flex shrink-0" style={{ paddingLeft: `${TIME_COL_WIDTH}px` }}>
        {weekDates.map((date, idx) => {
          const isoStr = formatDateISO(date)
          const schoolDay = schoolDaysByDate[isoStr]
          const rotationDay = schoolDay?.rotation_day
          const isNonSchool = schoolDay && !schoolDay.is_school_day

          return (
            <div
              key={isoStr}
              className={`flex-1 text-center text-sm py-2 border-b border-base-200 ${idx > 0 ? 'border-l border-base-200' : ''} ${isNonSchool ? 'text-base-content/40' : 'text-base-content/70'}`}
              style={{ minWidth: `${DAY_COL_MIN_WIDTH}px` }}
            >
              <span className="font-medium">{WEEKDAY_ABBR[date.getDay()]}</span>
              <span className="mx-1 text-base-content/40">&middot;</span>
              <span>{date.getDate()}</span>
              {rotationDay && (
                <>
                  <span className="mx-1 text-base-content/40">&middot;</span>
                  <span className="text-xs text-base-content/50">{rotationDay}</span>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Scrollable grid body */}
      <div
        className="flex overflow-x-auto overflow-y-auto border-b border-base-200 bg-base-100 flex-1"
        style={{ maxHeight: '70vh' }}
      >
        {/* Time axis */}
        <div
          className="shrink-0 border-r border-base-300 relative"
          style={{ width: `${TIME_COL_WIDTH}px`, height: `${gridHeight}px` }}
        >
          {hours.map((h) => {
            const offsetMin = h * 60 - gridStartMinutes
            if (offsetMin < 0) return null
            const top = minutesToPx(offsetMin) + GRID_PAD_Y
            return (
              <div
                key={h}
                className="absolute text-[10px] text-base-content/50 leading-none pr-1 text-right w-full"
                style={{ top: `${top}px`, transform: 'translateY(-50%)' }}
              >
                {formatHourLabel(h)}
              </div>
            )
          })}
        </div>

        {/* Day columns area */}
        <div className="flex flex-1 relative" style={{ height: `${gridHeight}px` }}>
          {/* Hour gridlines (z-index 1) */}
          {hours.map((h) => {
            const offsetMin = h * 60 - gridStartMinutes
            if (offsetMin <= 0) return null
            return (
              <div
                key={`line-${h}`}
                className="absolute left-0 right-0 border-t border-base-200"
                style={{ top: `${minutesToPx(offsetMin) + GRID_PAD_Y}px`, zIndex: 1 }}
              />
            )
          })}

          {/* Block overlay (z-index 0) */}
          <AgendaBlockOverlay
            blockDefinitions={blockDefinitions ?? []}
            gridStartMinutes={gridStartMinutes}
            blockLabels={blockLabels}
          />

          {/* Day columns */}
          {weekDates.map((date, idx) => {
            const isoStr = formatDateISO(date)
            const schoolDay = schoolDaysByDate[isoStr]
            return (
              <div
                key={isoStr}
                className={`flex-1 relative ${idx > 0 ? 'border-l border-base-200' : ''}`}
                style={{ minWidth: `${DAY_COL_MIN_WIDTH}px`, zIndex: 2 }}
              >
                <CalendarDayColumn
                  date={date}
                  schoolDay={schoolDay}
                  activities={activities}
                  enrollmentCountByActivity={enrollmentCountByActivity}
                  gridStartMinutes={gridStartMinutes}
                  onEmptyClick={onEmptyClick}
                  onActivityClick={onActivityClick}
                  onAggregateClick={onAggregateClick}
                  enrolledActivityIds={enrolledActivityIds}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
