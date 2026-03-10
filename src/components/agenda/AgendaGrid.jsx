import { WEEKDAYS, getBlocks, getBlockLabel } from '@/lib/constants'
import useUIStore from '@/store/uiStore'
import AgendaDayColumn from './AgendaDayColumn'
import AgendaBlockOverlay from './AgendaBlockOverlay'
import {
  minutesToPx,
  TIME_COL_WIDTH,
  DAY_COL_MIN_WIDTH,
  GRID_PAD_Y,
} from './agendaUtils'

function AgendaGrid({
  activities,
  enrollmentCountByActivity,
  gridStartMinutes,
  gridEndMinutes,
  blockCount,
  blockLabels,
}) {
  const agendaFocusedBlock = useUIStore((s) => s.agendaFocusedBlock)
  const agendaFocusedDay = useUIStore((s) => s.agendaFocusedDay)
  const setAgendaFocusedBlock = useUIStore((s) => s.setAgendaFocusedBlock)
  const setAgendaFocusedDay = useUIStore((s) => s.setAgendaFocusedDay)

  const totalMinutes = gridEndMinutes - gridStartMinutes
  const gridHeight = minutesToPx(totalMinutes) + GRID_PAD_Y * 2

  // Generate hour labels between grid start and end
  const startHour = Math.floor(gridStartMinutes / 60)
  const endHour = Math.ceil(gridEndMinutes / 60)
  const hours = []
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h)
  }

  // Filter columns by focused day
  const visibleDays = agendaFocusedDay != null
    ? WEEKDAYS.filter((d) => d.value === agendaFocusedDay)
    : WEEKDAYS

  // Block labels for left margin
  const blocks = getBlocks(blockCount)

  const handleBlockClick = (block) => {
    if (agendaFocusedBlock === block) {
      setAgendaFocusedBlock(null)
    } else {
      setAgendaFocusedBlock(block)
    }
  }

  const handleDayClick = (dayValue) => {
    if (agendaFocusedDay === dayValue) {
      setAgendaFocusedDay(null)
    } else {
      setAgendaFocusedDay(dayValue)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Day column headers */}
      <div className="flex" style={{ paddingLeft: `${TIME_COL_WIDTH}px` }}>
        {visibleDays.map((day) => (
          <button
            key={day.value}
            className={`flex-1 text-center text-sm font-medium py-2 cursor-pointer transition-colors ${
              agendaFocusedDay === day.value
                ? 'bg-primary text-primary-content rounded-t-lg'
                : 'text-base-content/70 hover:bg-base-200 rounded-t-lg'
            }`}
            style={{ minWidth: `${DAY_COL_MIN_WIDTH}px` }}
            onClick={() => handleDayClick(day.value)}
          >
            {day.label}
          </button>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex overflow-x-auto overflow-y-auto border border-base-300 rounded-b-lg bg-base-100" style={{ maxHeight: '70vh' }}>
        {/* Time axis + block labels column */}
        <div
          className="flex-shrink-0 border-r border-base-300 relative"
          style={{ width: `${TIME_COL_WIDTH}px`, height: `${gridHeight}px` }}
        >
          {hours.map((h) => {
            const offsetMin = h * 60 - gridStartMinutes
            if (offsetMin < 0) return null
            const top = minutesToPx(offsetMin) + GRID_PAD_Y
            const label = formatHourLabel(h)
            return (
              <div
                key={h}
                className="absolute text-[10px] text-base-content/50 leading-none pr-1 text-right w-full"
                style={{ top: `${top}px`, transform: 'translateY(-50%)' }}
              >
                {label}
              </div>
            )
          })}
        </div>

        {/* Day columns */}
        <div className="flex flex-1 relative" style={{ height: `${gridHeight}px` }}>
          {/* Hour grid lines */}
          {hours.map((h) => {
            const offsetMin = h * 60 - gridStartMinutes
            if (offsetMin <= 0) return null
            return (
              <div
                key={`line-${h}`}
                className="absolute left-0 right-0 border-t border-base-200"
                style={{ top: `${minutesToPx(offsetMin) + GRID_PAD_Y}px` }}
              />
            )
          })}

          {/* Block overlay (stub in v1) */}
          <AgendaBlockOverlay
            blockCount={blockCount}
            gridStartMinutes={gridStartMinutes}
          />

          {/* Day columns with vertical separators */}
          {visibleDays.map((day, idx) => (
            <div
              key={day.value}
              className={`flex-1 relative ${idx > 0 ? 'border-l border-base-200' : ''}`}
              style={{ minWidth: `${DAY_COL_MIN_WIDTH}px` }}
            >
              <AgendaDayColumn
                activities={activities}
                enrollmentCountByActivity={enrollmentCountByActivity}
                gridStartMinutes={gridStartMinutes}
                focusedBlock={agendaFocusedBlock}
                dayValue={day.value}
                gridPadY={GRID_PAD_Y}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Block labels row */}
      {blocks.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {blocks.map((block) => (
            <button
              key={block}
              className={`btn btn-xs ${
                agendaFocusedBlock === block
                  ? 'btn-primary'
                  : 'btn-ghost'
              }`}
              onClick={() => handleBlockClick(block)}
            >
              {getBlockLabel(block, blockLabels)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatHourLabel(hour) {
  if (hour === 0 || hour === 24) return '12a'
  if (hour === 12) return '12p'
  if (hour < 12) return `${hour}a`
  return `${hour - 12}p`
}

export default AgendaGrid
