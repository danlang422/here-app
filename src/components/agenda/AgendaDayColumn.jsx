import { useMemo } from 'react'
import AgendaCard from './AgendaCard'
import {
  groupActivitiesByBlock,
  activityTop,
  activityHeight,
  timeToMinutes,
  minutesToPx,
  DENSITY_FEW_MAX,
  DENSITY_AGG_MIN,
  PX_PER_HOUR,
} from './agendaUtils'

function AgendaDayColumn({
  activities,
  enrollmentCountByActivity,
  gridStartMinutes,
  focusedBlock,
  dayValue,
  gridPadY = 0,
}) {
  const blockGroups = useMemo(
    () => groupActivitiesByBlock(activities, dayValue),
    [activities, dayValue],
  )

  const cards = []

  for (const [blockKey, groupActivities] of blockGroups) {
    const count = groupActivities.length

    // When a specific block is focused, expand that block's aggregate to individual cards
    const isFocusedBlock =
      focusedBlock != null &&
      (blockKey === focusedBlock || (blockKey === 'null' && focusedBlock === null))
    const shouldExpand = isFocusedBlock && count >= DENSITY_AGG_MIN

    if (count === 1 || shouldExpand) {
      // Single cards or expanded aggregate — each activity gets its own card
      const slotCount = shouldExpand ? groupActivities.length : 1
      groupActivities.forEach((activity, slotIndex) => {
        const top = activityTop(activity, gridStartMinutes) + gridPadY
        const height = activityHeight(activity)
        const enrollCount = enrollmentCountByActivity.get(activity.id) ?? 0

        const widthPercent = 100 / slotCount
        const leftPercent = slotIndex * widthPercent

        cards.push(
          <div
            key={activity.id}
            className="absolute card bg-base-100 border border-base-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
            style={{
              top: `${top}px`,
              height: `${Math.max(height, 24)}px`,
              width: `${widthPercent}%`,
              left: `${leftPercent}%`,
            }}
          >
            <AgendaCard
              density="single"
              activity={activity}
              enrollmentCount={enrollCount}
            />
          </div>,
        )
      })
    } else if (count >= 2 && count <= DENSITY_FEW_MAX) {
      // Few — side by side, each with its own positioning
      groupActivities.forEach((activity, slotIndex) => {
        const top = activityTop(activity, gridStartMinutes) + gridPadY
        const height = activityHeight(activity)
        const enrollCount = enrollmentCountByActivity.get(activity.id) ?? 0

        const widthPercent = 100 / count
        const leftPercent = slotIndex * widthPercent

        cards.push(
          <div
            key={activity.id}
            className="absolute card bg-base-100 border border-base-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
            style={{
              top: `${top}px`,
              height: `${Math.max(height, 24)}px`,
              width: `${widthPercent}%`,
              left: `${leftPercent}%`,
            }}
          >
            <AgendaCard
              density="few"
              activity={activity}
              enrollmentCount={enrollCount}
            />
          </div>,
        )
      })
    } else if (count >= DENSITY_AGG_MIN) {
      // Aggregate — single summary card spanning the group
      const starts = groupActivities.map((a) => timeToMinutes(a.default_start_time))
      const ends = groupActivities.map((a) => timeToMinutes(a.default_end_time))
      const earliestStart = Math.min(...starts)
      const latestEnd = Math.max(...ends)

      const top = minutesToPx(earliestStart - gridStartMinutes) + gridPadY
      const rawHeight = minutesToPx(latestEnd - earliestStart)
      const minHeight = PX_PER_HOUR * 1.5
      const height = Math.max(rawHeight, minHeight)

      const totalEnrollment = groupActivities.reduce(
        (sum, a) => sum + (enrollmentCountByActivity.get(a.id) ?? 0),
        0,
      )

      cards.push(
        <div
          key={`agg-${blockKey}`}
          className="absolute card bg-base-200 border border-base-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          style={{
            top: `${top}px`,
            height: `${height}px`,
            width: '100%',
            left: '0%',
          }}
        >
          <AgendaCard
            density="aggregate"
            activities={groupActivities}
            totalEnrollment={totalEnrollment}
            block={blockKey}
            dayValue={dayValue}
          />
        </div>,
      )
    }
  }

  return (
    <div className="relative flex-1" style={{ minWidth: '0' }}>
      {cards}
    </div>
  )
}

export default AgendaDayColumn
