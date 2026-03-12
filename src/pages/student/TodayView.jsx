import { useState, useEffect, useMemo } from 'react'
import useAuthStore from '@/store/authStore'
import { useStudentAgenda } from '@/hooks/useStudentAgenda'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
import { formatDateISO, addDays, subDays, isSameDay } from '@/lib/scheduleUtils'
import { getBlockLabel } from '@/lib/constants'
import SingleDayAgenda from '@/components/agenda/SingleDayAgenda'
import StudentActivityCard from '@/components/agenda/StudentActivityCard'
import {
  timeToMinutes,
  floorToHour,
  ceilToHour,
  DEFAULT_GRID_START,
  DEFAULT_GRID_END,
} from '@/components/agenda/agendaUtils'

function TodayView() {
  const [date, setDate] = useState(new Date())
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id
  const studentId = profile?.id

  // Data hooks
  const { activities, allActivities, schoolDay, isLoading, error } =
    useStudentAgenda(studentId, date, orgId)
  const { data: orgSettings } = useOrgSettings(orgId)
  const { data: template } = useDefaultScheduleTemplate(orgId)

  // Date navigation
  const goToPrev = () => setDate((d) => subDays(d, 1))
  const goToNext = () => setDate((d) => addDays(d, 1))
  const isToday = isSameDay(date, new Date())

  // Rotation day display — conditional on student having rotation-dependent activities
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

  // Grid bounds — expand from defaults to fit actual activity times
  const gridBounds = useMemo(() => {
    if (activities.length === 0) {
      return { start: DEFAULT_GRID_START, end: DEFAULT_GRID_END }
    }
    const starts = activities
      .map((a) => a.default_start_time)
      .filter(Boolean)
    const ends = activities
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
  }, [activities])

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

  // Render card function for SingleDayAgenda
  const renderCard = (activity) => {
    const staffName = resolveStaffName(activity)
    const label =
      activity.block != null
        ? getBlockLabel(activity.block, blockLabels)
        : null
    return (
      <StudentActivityCard
        activity={activity}
        staffDisplayName={staffName}
        blockLabel={label}
      />
    )
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
      {!isLoading && activities.length > 0 && (
        <SingleDayAgenda
          activities={activities}
          gridStartMinutes={gridStartMinutes}
          gridEndMinutes={gridEndMinutes}
          blockDefinitions={blockDefinitions}
          blockLabels={blockLabels}
          renderCard={renderCard}
        />
      )}

      {/* Empty state */}
      {!isLoading && activities.length === 0 && (
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body items-center text-center py-16">
            <p className="text-base-content/50">
              No classes scheduled for this date.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Resolve staff display name: instructor_name > teacher last name > null
function resolveStaffName(activity) {
  if (activity.instructor_name) return activity.instructor_name
  if (activity.teacher) {
    const t = activity.teacher
    return t.preferred_name || t.last_name || `${t.first_name} ${t.last_name}`
  }
  return null
}

export default TodayView
