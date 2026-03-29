import { useMemo } from 'react'
import { CalendarEventCard } from './CalendarEventCard'
import { activityMeetsToday } from '@/lib/scheduleUtils'
import {
  groupActivitiesByBlock,
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
    () => groupActivitiesByBlock(todayActivities, date.getDay()),
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

  const cards = []

  for (const [blockKey, groupActivities] of blockGroups) {
    const count = groupActivities.length

    if (count === 1) {
      const activity = groupActivities[0]
      const top = activityTop(activity, gridStartMinutes) + GRID_PAD_Y
      const height = activityHeight(activity)
      const enrollCount = enrollmentCountByActivity[activity.id] ?? 0

      cards.push(
        <div
          key={activity.id}
          className="absolute"
          style={{
            top: `${top}px`,
            height: `${Math.max(height, 24)}px`,
            width: '100%',
            left: '0%',
            zIndex: 2,
          }}
        >
          <CalendarEventCard
            activity={activity}
            enrollmentCount={enrollCount}
            mode="single"
            onClick={onActivityClick}
          />
        </div>
      )
    } else if (count >= 2 && count <= DENSITY_FEW_MAX) {
      groupActivities.forEach((activity, slotIndex) => {
        const top = activityTop(activity, gridStartMinutes) + GRID_PAD_Y
        const height = activityHeight(activity)
        const enrollCount = enrollmentCountByActivity[activity.id] ?? 0
        const widthPercent = 100 / count
        const leftPercent = slotIndex * widthPercent

        cards.push(
          <div
            key={activity.id}
            className="absolute"
            style={{
              top: `${top}px`,
              height: `${Math.max(height, 24)}px`,
              width: `${widthPercent}%`,
              left: `${leftPercent}%`,
              zIndex: 2,
            }}
          >
            <CalendarEventCard
              activity={activity}
              enrollmentCount={enrollCount}
              mode="few"
              onClick={onActivityClick}
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

      cards.push(
        <div
          key={`agg-${blockKey}`}
          className="absolute"
          style={{
            top: `${top}px`,
            height: `${height}px`,
            width: '100%',
            left: '0%',
            zIndex: 1,
          }}
        >
          <CalendarEventCard
            activity={groupActivities[0]}
            enrollmentCount={totalEnrollment}
            mode="aggregate"
            aggregateData={{
              count,
              totalEnrollment,
              activities: groupActivities,
            }}
            onClick={() => {}}
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
