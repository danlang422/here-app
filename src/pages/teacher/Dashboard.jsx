import { useState, useEffect, useMemo } from 'react'
import { getDevNow, getDevToday } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production
import { CaretLeft, CaretRight, CalendarBlank } from '@phosphor-icons/react'
import useAuthStore from '@/store/authStore'
import { useTeacherAgenda } from '@/hooks/useTeacherAgenda'
import { useTeacherActionSummary } from '@/hooks/useTeacherActionSummary'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { ensureActivityInstances } from '@/api/agenda'
import { formatDateISO, addDays, subDays, isSameDay } from '@/lib/scheduleUtils'
import SingleDayAgenda from '@/components/agenda/SingleDayAgenda'
import TeacherActivityCard from '@/components/agenda/TeacherActivityCard'
import RosterModal from '@/components/roster/RosterModal'
import {
  timeToMinutes,
  floorToHour,
  ceilToHour,
  DEFAULT_GRID_START,
  DEFAULT_GRID_END,
} from '@/components/agenda/agendaUtils'

function Dashboard() {
  const [date, setDate] = useState(getDevToday()) // DEV OVERRIDE
  const [rosterTarget, setRosterTarget] = useState(null)
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id
  const teacherId = profile?.id

  // Data hooks
  const { activities, allActivities, enrollmentCounts, schoolDay, isLoading, error } =
    useTeacherAgenda(teacherId, date, orgId)
  const { data: orgSettings } = useOrgSettings(orgId)

  // Action summary for wave counts on cards and icons in roster
  const allActivityIds = useMemo(
    () => activities.map((a) => a.id),
    [activities]
  )
  const { data: actionSummary } = useTeacherActionSummary(allActivityIds, date, orgId)

  // Instance upsert (fire-and-forget)
  useEffect(() => {
    if (activities.length > 0 && orgId) {
      ensureActivityInstances(
        activities.map((a) => a.id),
        orgId,
        formatDateISO(date)
      ).catch(console.error)
    }
  }, [activities, orgId, date])

  // Date navigation
  const goToPrev = () => setDate((d) => subDays(d, 1))
  const goToNext = () => setDate((d) => addDays(d, 1))
  const isToday = isSameDay(date, getDevNow()) // DEV OVERRIDE

  // Rotation day display
  const usesRotation =
    allActivities?.some((a) => a.rotation_day_type != null) ?? false
  const rotationLabel =
    usesRotation && schoolDay?.rotation_day
      ? schoolDay.rotation_day + ' Day'
      : null

  const blockLabels = orgSettings?.block_labels ?? []

  // Block grouping with simplified two-tier density
  const displayItems = useMemo(() => {
    const blockGroups = groupByBlock(activities)
    const items = []

    for (const [blockKey, groupActivities] of blockGroups) {
      if (groupActivities.length === 1) {
        const activity = groupActivities[0]
        items.push({
          ...activity,
          isAggregate: false,
          enrollmentCount: enrollmentCounts.get(activity.id) ?? 0,
        })
      } else {
        const starts = groupActivities
          .map((a) => a.default_start_time)
          .filter(Boolean)
        const ends = groupActivities
          .map((a) => a.default_end_time)
          .filter(Boolean)
        const earliestStart = starts.reduce((a, b) => (a < b ? a : b))
        const latestEnd = ends.reduce((a, b) => (a > b ? a : b))
        const totalEnrollment = groupActivities.reduce(
          (sum, a) => sum + (enrollmentCounts.get(a.id) ?? 0),
          0
        )

        items.push({
          id: `agg-${blockKey}`,
          isAggregate: true,
          block: blockKey === 'null' ? null : Number(blockKey),
          activities: groupActivities.map((a) => ({
            ...a,
            enrollmentCount: enrollmentCounts.get(a.id) ?? 0,
          })),
          activityCount: groupActivities.length,
          totalEnrollment,
          default_start_time: earliestStart,
          default_end_time: latestEnd,
        })
      }
    }

    return items.sort((a, b) => {
      if (!a.default_start_time || !b.default_start_time) return 0
      return a.default_start_time.localeCompare(b.default_start_time)
    })
  }, [activities, enrollmentCounts])

  // Grid bounds
  const gridBounds = useMemo(() => {
    if (displayItems.length === 0) {
      return { start: DEFAULT_GRID_START, end: DEFAULT_GRID_END }
    }
    const starts = displayItems
      .map((a) => a.default_start_time)
      .filter(Boolean)
    const ends = displayItems
      .map((a) => a.default_end_time)
      .filter(Boolean)
    if (starts.length === 0) {
      return { start: DEFAULT_GRID_START, end: DEFAULT_GRID_END }
    }
    const minStart = starts.reduce((a, b) => (a < b ? a : b))
    const maxEnd = ends.reduce((a, b) => (a > b ? a : b))
    return {
      start:
        minStart < DEFAULT_GRID_START
          ? floorToHour(minStart)
          : DEFAULT_GRID_START,
      end:
        maxEnd > DEFAULT_GRID_END ? ceilToHour(maxEnd) : DEFAULT_GRID_END,
    }
  }, [displayItems])

  const gridStartMinutes = timeToMinutes(gridBounds.start)
  const gridEndMinutes = timeToMinutes(gridBounds.end)

  // Date header formatting
  const fullDateLabel = isToday
    ? `Today, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
    : date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })

  // Render card function with wave counts and attendance indicator
  const renderCard = (item) => {
    const waveCount = item.isAggregate
      ? item.activities.reduce(
          (sum, a) => sum + (actionSummary?.waveCounts?.get(a.id) ?? 0),
          0
        )
      : (actionSummary?.waveCounts?.get(item.id) ?? 0)

    const hasAttendanceRecords = item.isAggregate
      ? item.activities.some((a) => actionSummary?.hasAttendanceRecords?.get(a.id))
      : (actionSummary?.hasAttendanceRecords?.get(item.id) ?? false)

    return (
      <TeacherActivityCard
        item={item}
        blockLabels={blockLabels}
        waveCount={waveCount}
        hasAttendanceRecords={hasAttendanceRecords}
        onClick={() => handleCardClick(item)}
      />
    )
  }

  function handleCardClick(item) {
    if (item.isAggregate) {
      setRosterTarget({ activities: item.activities, isAggregate: true })
    } else {
      setRosterTarget({ activities: [item], isAggregate: false })
    }
  }

  if (error) {
    return (
      <div className="text-error text-center py-8">
        Failed to load schedule. Please try again.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Date navigation header */}
      <div className="flex items-center justify-between mb-4">
        <button
          className="btn btn-ghost btn-circle btn-sm"
          onClick={goToPrev}
          aria-label="Previous day"
        >
          <CaretLeft size={16} />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-semibold flex items-center gap-2 justify-center">
            {fullDateLabel}
            {rotationLabel && (
              <span className="badge badge-sm bg-base-200 border-base-300 text-base-content/60 font-normal">
                {rotationLabel}
              </span>
            )}
          </h1>
        </div>
        <button
          className="btn btn-ghost btn-circle btn-sm"
          onClick={goToNext}
          aria-label="Next day"
        >
          <CaretRight size={16} />
        </button>
      </div>

      {/* Today shortcut when navigated away */}
      {!isToday && (
        <div className="text-center mb-3">
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => setDate(getDevToday())} // DEV OVERRIDE
          >
            Back to today
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-md" />
        </div>
      )}

      {/* Content */}
      {!isLoading && displayItems.length > 0 && (
        <SingleDayAgenda
          activities={displayItems}
          gridStartMinutes={gridStartMinutes}
          gridEndMinutes={gridEndMinutes}
          renderCard={renderCard}
        />
      )}

      {/* Empty state */}
      {!isLoading && displayItems.length === 0 && (
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body items-center text-center py-16">
            <CalendarBlank size={40} weight="thin" className="text-base-content/30 mb-2" />
            <p className="text-base-content/50">
              {isToday ? "Nothing scheduled for today. Clear day!" : "No activities scheduled for this date."}
            </p>
          </div>
        </div>
      )}

      {/* Roster modal */}
      {rosterTarget && (
        <RosterModal
          activities={rosterTarget.activities}
          isAggregate={rosterTarget.isAggregate}
          date={date}
          orgId={orgId}
          teacherId={teacherId}
          blockLabels={blockLabels}
          actionSummary={actionSummary}
          schoolDay={schoolDay}
          onClose={() => setRosterTarget(null)}
        />
      )}
    </div>
  )
}

// Simple group-by-block — activityMeetsToday has already filtered,
// so no need to re-check days_of_week like groupActivitiesByBlock does.
function groupByBlock(activities) {
  const map = new Map()
  for (const a of activities) {
    const key = a.block?.length > 0 ? String(a.block[0]) : 'null'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(a)
  }
  return map
}

export default Dashboard
