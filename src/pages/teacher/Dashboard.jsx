import { useState, useEffect, useMemo } from 'react'
import useAuthStore from '@/store/authStore'
import { useTeacherAgenda } from '@/hooks/useTeacherAgenda'
import { useTeacherActionSummary } from '@/hooks/useTeacherActionSummary'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
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
  const [date, setDate] = useState(new Date())
  const [rosterTarget, setRosterTarget] = useState(null)
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id
  const teacherId = profile?.id

  // Data hooks
  const { activities, allActivities, enrollmentCounts, schoolDay, isLoading, error } =
    useTeacherAgenda(teacherId, date, orgId)
  const { data: orgSettings } = useOrgSettings(orgId)
  const { data: template } = useDefaultScheduleTemplate(orgId)

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
  const isToday = isSameDay(date, new Date())

  // Rotation day display
  const usesRotation =
    allActivities?.some((a) => a.rotation_day_type != null) ?? false
  const rotationLabel =
    usesRotation && schoolDay?.rotation_day
      ? schoolDay.rotation_day + ' Day'
      : null

  // Block overlay data
  const blockDefinitions = useMemo(
    () =>
      (template?.block_definitions ?? []).filter(
        (d) => d.start_time && d.end_time
      ),
    [template]
  )
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

  // Render card function with wave counts
  const renderCard = (item) => {
    const waveCount = item.isAggregate
      ? item.activities.reduce(
          (sum, a) => sum + (actionSummary?.waveCounts?.get(a.id) ?? 0),
          0
        )
      : (actionSummary?.waveCounts?.get(item.id) ?? 0)

    return (
      <TeacherActivityCard
        item={item}
        blockLabels={blockLabels}
        waveCount={waveCount}
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
        <button className="btn btn-ghost btn-sm" onClick={goToPrev}>
          &#8249;
        </button>
        <div className="text-center">
          <h1 className="text-lg font-semibold">
            {fullDateLabel}
            {rotationLabel && (
              <span className="text-base-content/60 font-normal">
                {' \u2014 '}{rotationLabel}
              </span>
            )}
          </h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={goToNext}>
          &#8250;
        </button>
      </div>

      {/* Today shortcut when navigated away */}
      {!isToday && (
        <div className="text-center mb-3">
          <button
            className="btn btn-ghost btn-xs text-primary"
            onClick={() => setDate(new Date())}
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
          blockDefinitions={blockDefinitions}
          blockLabels={blockLabels}
          renderCard={renderCard}
        />
      )}

      {/* Empty state */}
      {!isLoading && displayItems.length === 0 && (
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body items-center text-center py-16">
            <p className="text-base-content/50">
              No activities scheduled for this date.
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
    const key = String(a.block ?? 'null')
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(a)
  }
  return map
}

export default Dashboard
