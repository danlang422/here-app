import { useMemo } from 'react'
import { CalendarEventCard } from './CalendarEventCard'
import { activityMeetsToday } from '@/lib/scheduleUtils'
import {
  groupActivitiesForLayout,
  activityTop,
  activityHeight,
  timeToMinutes,
  minutesToPx,
  DENSITY_FEW_MAX,
  DENSITY_AGG_MIN,
  PX_PER_HOUR,
  GRID_PAD_Y,
} from '@/components/agenda/agendaUtils'

export function CalendarDayColumn({
  date,
  schoolDay,
  activities,
  enrollmentCountByActivity,
  gridStartMinutes,
  onEmptyClick,
  onActivityClick,
  onAggregateClick,
  enrolledActivityIds = null,
}) {
  const todayActivities = useMemo(
    () =>
      activities.filter(
        (a) =>
          activityMeetsToday(a, date, schoolDay) &&
          a.default_start_time &&
          a.default_end_time
      ),
    [activities, date, schoolDay]
  )

  const blockGroups = useMemo(
    () => groupActivitiesForLayout(todayActivities, date.getDay()),
    [todayActivities, date]
  )

  const isNonSchoolDay = !schoolDay?.is_school_day

  function handleColumnClick(e) {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const clickMinutes = gridStartMinutes + (clickY / PX_PER_HOUR) * 60
    const snapped = Math.round(clickMinutes / 15) * 15
    const hours = Math.floor(snapped / 60).toString().padStart(2, '0')
    const mins = (snapped % 60).toString().padStart(2, '0')
    onEmptyClick(date, `${hours}:${mins}`)
  }

  // Compute horizontal column layout across all groups.
  // Groups whose time ranges overlap are assigned side-by-side columns so they
  // don't stack on top of each other. Non-overlapping groups stay full-width.
  const slotList = []
  for (const [blockKey, groupActivities] of blockGroups) {
    const starts = groupActivities
      .map((a) => timeToMinutes(a.default_start_time))
      .filter((v) => v !== null)
    const ends = groupActivities
      .map((a) => timeToMinutes(a.default_end_time))
      .filter((v) => v !== null)
    if (starts.length === 0) continue
    slotList.push({
      key: blockKey,
      startMin: Math.min(...starts),
      endMin: Math.max(...ends),
      col: 0,
    })
  }
  slotList.sort((a, b) => a.startMin - b.startMin)

  // Greedy interval coloring: assign each slot to the first column where
  // the previous occupant has already ended.
  const colEnds = []
  for (const slot of slotList) {
    let c = colEnds.findIndex((end) => end <= slot.startMin)
    if (c === -1) c = colEnds.length
    slot.col = c
    colEnds[c] = slot.endMin
  }

  // totalCols for each slot = max col index among all concurrent slots + 1
  const columnLayout = new Map()
  for (const slot of slotList) {
    const concurrent = slotList.filter(
      (s) => s.startMin < slot.endMin && s.endMin > slot.startMin
    )
    const maxCol = Math.max(...concurrent.map((s) => s.col))
    columnLayout.set(slot.key, { col: slot.col, totalCols: maxCol + 1 })
  }

  const cards = []

  for (const [blockKey, groupActivities] of blockGroups) {
    const { col = 0, totalCols = 1 } = columnLayout.get(blockKey) ?? {}
    const groupWidthFrac = 1 / totalCols
    const groupLeftFrac = col / totalCols

    const count = groupActivities.length

    if (count === 1) {
      const activity = groupActivities[0]
      const top = activityTop(activity, gridStartMinutes) + GRID_PAD_Y
      const height = activityHeight(activity)
      const enrollCount = enrollmentCountByActivity[activity.id] ?? 0
      const isDimmed = enrolledActivityIds !== null && !enrolledActivityIds.has(activity.id)

      cards.push(
        <div
          key={activity.id}
          className="absolute"
          style={{
            top: `${top}px`,
            height: `${Math.max(height, 24)}px`,
            width: `${groupWidthFrac * 100}%`,
            left: `${groupLeftFrac * 100}%`,
            zIndex: 2,
          }}
        >
          <CalendarEventCard
            activity={activity}
            enrollmentCount={enrollCount}
            mode="single"
            onClick={onActivityClick}
            isDimmed={isDimmed}
          />
        </div>
      )
    } else if (count >= 2 && count <= DENSITY_FEW_MAX) {
      groupActivities.forEach((activity, slotIndex) => {
        const top = activityTop(activity, gridStartMinutes) + GRID_PAD_Y
        const height = activityHeight(activity)
        const enrollCount = enrollmentCountByActivity[activity.id] ?? 0
        const isDimmed = enrolledActivityIds !== null && !enrolledActivityIds.has(activity.id)
        const cardWidthFrac = groupWidthFrac / count
        const cardLeftFrac = groupLeftFrac + slotIndex * cardWidthFrac

        cards.push(
          <div
            key={activity.id}
            className="absolute"
            style={{
              top: `${top}px`,
              height: `${Math.max(height, 24)}px`,
              width: `${cardWidthFrac * 100}%`,
              left: `${cardLeftFrac * 100}%`,
              zIndex: 2,
            }}
          >
            <CalendarEventCard
              activity={activity}
              enrollmentCount={enrollCount}
              mode="few"
              onClick={onActivityClick}
              isDimmed={isDimmed}
            />
          </div>
        )
      })
    } else if (count >= DENSITY_AGG_MIN) {
      const starts = groupActivities.map((a) => timeToMinutes(a.default_start_time))
      const ends = groupActivities.map((a) => timeToMinutes(a.default_end_time))
      const earliestStart = Math.min(...starts)
      const latestEnd = Math.max(...ends)

      const top = minutesToPx(earliestStart - gridStartMinutes) + GRID_PAD_Y
      const rawHeight = minutesToPx(latestEnd - earliestStart)
      const height = Math.max(rawHeight, PX_PER_HOUR * 1.5)

      const totalEnrollment = groupActivities.reduce(
        (sum, a) => sum + (enrollmentCountByActivity[a.id] ?? 0),
        0
      )
      const aggregateData = { count, totalEnrollment, activities: groupActivities }
      const isDimmed = enrolledActivityIds !== null && !groupActivities.some((a) => enrolledActivityIds.has(a.id))

      cards.push(
        <div
          key={`agg-${blockKey}`}
          className="absolute"
          style={{
            top: `${top}px`,
            height: `${height}px`,
            width: `${groupWidthFrac * 100}%`,
            left: `${groupLeftFrac * 100}%`,
            zIndex: 1,
          }}
        >
          <CalendarEventCard
            activity={groupActivities[0]}
            enrollmentCount={totalEnrollment}
            mode="aggregate"
            aggregateData={aggregateData}
            onClick={(e) => onAggregateClick(aggregateData, e)}
            isDimmed={isDimmed}
          />
        </div>
      )
    }
  }

  return (
    <div
      className={`relative h-full cursor-crosshair ${isNonSchoolDay ? 'opacity-40' : ''}`}
      onClick={handleColumnClick}
    >
      {isNonSchoolDay && (
        <div className="absolute top-1 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 3 }}>
          <span className="text-[10px] text-base-content/50 bg-base-100/80 px-1 rounded">No school</span>
        </div>
      )}
      {cards}
    </div>
  )
}
