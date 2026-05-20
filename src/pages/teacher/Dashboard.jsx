import { useState, useEffect, useMemo } from 'react'
import { getDevNow, getDevToday } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production
import { CaretLeft, CaretRight, CalendarBlank } from '@phosphor-icons/react'
import useAuthStore from '@/store/authStore'
import { useTeacherAgenda } from '@/hooks/useTeacherAgenda'
import { useTeacherActionSummary } from '@/hooks/useTeacherActionSummary'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
import { ensureActivityInstances } from '@/api/agenda'
import { formatDateISO, addDays, subDays, isSameDay } from '@/lib/scheduleUtils'
import SingleDayAgenda from '@/components/agenda/SingleDayAgenda'
import TeacherActivityCard from '@/components/agenda/TeacherActivityCard'
import ClusterPopover from '@/components/agenda/ClusterPopover'
import RosterModal from '@/components/roster/RosterModal'
import BlockRosterModal from '@/components/roster/BlockRosterModal'
import AgendaSidebar from '@/components/agenda/AgendaSidebar'
import { useSidebarActivities } from '@/hooks/useSidebarActivities'
import { getBlockLabel } from '@/lib/constants'
import {
  timeToMinutes,
  floorToHour,
  ceilToHour,
  DEFAULT_GRID_START,
  DEFAULT_GRID_END,
  buildTeacherRenderables,
  formatTimeRange,
} from '@/components/agenda/agendaUtils'

function Dashboard() {
  const [date, setDate] = useState(getDevToday()) // DEV OVERRIDE
  const [rosterTarget, setRosterTarget] = useState(null)
  const [clusterPopover, setClusterPopover] = useState(null) // { renderable, anchorRect }
  const [blockRosterTarget, setBlockRosterTarget] = useState(null) // blockNum | null
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id
  const teacherId = profile?.id

  // Data hooks
  const { activities, allActivities, enrollmentCounts, lateArrivals, schoolDay, isLoading, error } =
    useTeacherAgenda(teacherId, date, orgId)
  const { data: orgSettings } = useOrgSettings(orgId)
  const { data: defaultTemplate } = useDefaultScheduleTemplate(orgId)

  const {
    yours: sidebarYours,
    others: sidebarOthers,
    enrollmentCounts: sidebarEnrollmentCounts,
    lateArrivals: sidebarLateArrivals,
    isLoading: sidebarLoading,
  } = useSidebarActivities(orgId, date, teacherId, schoolDay)

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

  const visibleBlocks = useMemo(() => {
    const blockSet = new Set(activities.flatMap((a) => a.block ?? []))
    return [...blockSet].sort((a, b) => a - b)
  }, [activities])

  // Role-aware time clustering — replaces block aggregation
  const renderables = useMemo(
    () => buildTeacherRenderables(activities, enrollmentCounts, teacherId, lateArrivals),
    [activities, enrollmentCounts, teacherId, lateArrivals]
  )

  // Grid bounds
  const gridBounds = useMemo(() => {
    if (renderables.length === 0) {
      return { start: DEFAULT_GRID_START, end: DEFAULT_GRID_END }
    }
    const starts = renderables
      .map((a) => a.default_start_time)
      .filter(Boolean)
    const ends = renderables
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
  }, [renderables])

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

  const renderCard = (item) => {
    const waveCount = item.isCluster
      ? item.activities.reduce((sum, a) => sum + (actionSummary?.waveCounts?.get(a.id) ?? 0), 0)
      : (actionSummary?.waveCounts?.get(item.id) ?? 0)

    const hasAttendanceRecords = item.isCluster
      ? item.activities.some((a) => actionSummary?.hasAttendanceRecords?.get(a.id))
      : (actionSummary?.hasAttendanceRecords?.get(item.id) ?? false)

    return (
      <TeacherActivityCard
        item={item}
        blockLabels={blockLabels}
        waveCount={waveCount}
        hasAttendanceRecords={hasAttendanceRecords}
        onClick={(e) => handleCardClick(item, e)}
      />
    )
  }

  function handleCardClick(item, e) {
    if (item.isCluster) {
      const anchorRect = e.currentTarget.getBoundingClientRect()
      setClusterPopover({ renderable: item, anchorRect })
    } else {
      setRosterTarget(item.activity)
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
    <div className="max-w-5xl mx-auto">
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

      {/* Two-column layout: agenda + sidebar */}
      <div className="flex gap-5 items-start">
        {/* Agenda column */}
        <div className="flex-1 min-w-0">
          {/* Block attendance buttons */}
          {!isLoading && visibleBlocks.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {visibleBlocks.map((blockNum) => {
                const label = getBlockLabel(blockNum, blockLabels)
                const def = defaultTemplate?.block_definitions?.find((d) => d.block === blockNum)
                const timeRange = def?.start_time && def?.end_time
                  ? formatTimeRange(def.start_time, def.end_time)
                  : null
                return (
                  <button
                    key={blockNum}
                    className="btn btn-outline btn-sm flex flex-col items-start gap-0 h-auto py-1.5 px-3 min-w-[80px]"
                    onClick={() => setBlockRosterTarget(blockNum)}
                  >
                    <span className="font-semibold text-xs leading-tight">{label}</span>
                    {timeRange && (
                      <span className="text-[10px] text-base-content/50 font-normal leading-tight">{timeRange}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-md" />
            </div>
          )}

          {/* Content */}
          {!isLoading && renderables.length > 0 && (
            <SingleDayAgenda
              activities={renderables}
              gridStartMinutes={gridStartMinutes}
              gridEndMinutes={gridEndMinutes}
              renderCard={renderCard}
            />
          )}

          {/* Empty state */}
          {!isLoading && renderables.length === 0 && (
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body items-center text-center py-16">
                <CalendarBlank size={40} weight="thin" className="text-base-content/30 mb-2" />
                <p className="text-base-content/50">
                  {isToday ? "Nothing scheduled for today. Clear day!" : "No activities scheduled for this date."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar column — hidden on narrow viewports */}
        {!sidebarLoading && (
          <div className="hidden lg:block w-56 shrink-0">
            <AgendaSidebar
              yours={sidebarYours}
              others={sidebarOthers}
              enrollmentCounts={sidebarEnrollmentCounts}
              lateArrivals={sidebarLateArrivals}
              teacherId={teacherId}
              date={date}
              orgId={orgId}
              blockLabels={blockLabels}
              actionSummary={actionSummary}
              schoolDay={schoolDay}
              onOpenRoster={(activity) => setRosterTarget(activity)}
            />
          </div>
        )}
      </div>

      {/* Cluster popover */}
      {clusterPopover && (
        <ClusterPopover
          renderable={clusterPopover.renderable}
          anchorRect={clusterPopover.anchorRect}
          blockLabels={blockLabels}
          lateArrivals={lateArrivals}
          onMemberClick={(activity) => {
            setClusterPopover(null)
            setRosterTarget(activity)
          }}
          onClose={() => setClusterPopover(null)}
        />
      )}

      {/* Block roster modal */}
      {blockRosterTarget !== null && (
        <BlockRosterModal
          groupTitle={getBlockLabel(blockRosterTarget, blockLabels)}
          groupTimeRange={(() => {
            const def = defaultTemplate?.block_definitions?.find((d) => d.block === blockRosterTarget)
            return def?.start_time && def?.end_time ? formatTimeRange(def.start_time, def.end_time) : null
          })()}
          activities={activities.filter((a) => a.block?.includes(blockRosterTarget))}
          date={date}
          orgId={orgId}
          teacherId={teacherId}
          blockLabels={blockLabels}
          actionSummary={actionSummary}
          schoolDay={schoolDay}
          enrollmentCounts={enrollmentCounts}
          onClose={() => setBlockRosterTarget(null)}
        />
      )}

      {/* Roster modal */}
      {rosterTarget && (
        <RosterModal
          activities={[rosterTarget]}
          isAggregate={false}
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

export default Dashboard
