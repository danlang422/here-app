import AgendaBlockOverlay from './AgendaBlockOverlay'
import {
  minutesToPx,
  activityTop,
  activityHeight,
  TIME_COL_WIDTH,
  GRID_PAD_Y,
} from './agendaUtils'

function SingleDayAgenda({
  activities,
  gridStartMinutes,
  gridEndMinutes,
  blockDefinitions,
  blockLabels,
  renderCard,
}) {
  const totalMinutes = gridEndMinutes - gridStartMinutes
  const gridHeight = minutesToPx(totalMinutes) + GRID_PAD_Y * 2

  // Generate hour labels between grid start and end
  const startHour = Math.floor(gridStartMinutes / 60)
  const endHour = Math.ceil(gridEndMinutes / 60)
  const hours = []
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h)
  }

  return (
    <div className="flex border border-base-300 rounded-lg bg-base-100 overflow-hidden">
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

      {/* Card column */}
      <div className="flex-1 relative" style={{ height: `${gridHeight}px` }}>
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

        {/* Block overlay bands */}
        <AgendaBlockOverlay
          blockDefinitions={blockDefinitions}
          gridStartMinutes={gridStartMinutes}
          blockLabels={blockLabels}
        />

        {/* Positioned activity cards */}
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="absolute left-2 right-2"
            style={{
              top: `${activityTop(activity, gridStartMinutes) + GRID_PAD_Y}px`,
              height: `${activityHeight(activity)}px`,
              zIndex: 10,
            }}
          >
            {renderCard(activity)}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatHourLabel(hour) {
  if (hour === 0 || hour === 24) return '12a'
  if (hour === 12) return '12p'
  if (hour < 12) return `${hour}a`
  return `${hour - 12}p`
}

export default SingleDayAgenda
