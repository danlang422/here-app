import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { HandWaving, CheckCircle, NotePencil, SignOut, CaretCircleLeft, CaretCircleRight, CalendarBlank } from '@phosphor-icons/react'
import useAuthStore from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { useStudentAgenda } from '@/hooks/useStudentAgenda'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useStudentActions } from '@/hooks/useStudentActions'
import { useStreakData } from '@/hooks/useStreakData'
import { formatDateISO, addDays, subDays, isSameDay } from '@/lib/scheduleUtils'
import { getBlockLabel } from '@/lib/constants'
import { getCurrentPosition, validateGeofence } from '@/lib/geofenceUtils'
import SingleDayAgenda from '@/components/agenda/SingleDayAgenda'
import StudentActivityCard from '@/components/agenda/StudentActivityCard'
import StatusUpdateModal from '@/components/student/StatusUpdateModal'
import FreeformTagSelector from '@/components/student/FreeformTagSelector'
import ActivityDetailSheet from '@/components/student/ActivityDetailSheet'
import {
  timeToMinutes,
  floorToHour,
  ceilToHour,
  DEFAULT_GRID_START,
  DEFAULT_GRID_END,
} from '@/components/agenda/agendaUtils'
import { getDevNow, getDevToday } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production
import {
  ensureActivityInstances,
  createPresenceWave,
  createStatusUpdate,
  createCheckIn,
  deleteCheckIn,
  createCheckinTags,
  checkOut,
} from '@/api/agenda'

function TodayView() {
  const [date, setDate] = useState(getDevToday()) // DEV OVERRIDE
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id
  const studentId = profile?.id
  const queryClient = useQueryClient()

  // Data hooks
  const { activities, allActivities, schoolDay, isLoading, error } =
    useStudentAgenda(studentId, date, orgId)
  const { data: orgSettings } = useOrgSettings(orgId)
  const { data: actionData } = useStudentActions(studentId, activities, date, orgId)
  const { data: streakData } = useStreakData(studentId, allActivities ?? [], orgId)

  // Date navigation
  const goToPrev = () => setDate((d) => subDays(d, 1))
  const goToNext = () => setDate((d) => addDays(d, 1))
  const isToday = isSameDay(date, getDevNow()) // DEV OVERRIDE
  const dateStr = formatDateISO(date)

  // Ensure activity instances exist (fire-and-forget)
  useEffect(() => {
    if (activities.length > 0 && orgId) {
      ensureActivityInstances(
        activities.map((a) => a.id),
        orgId,
        formatDateISO(date)
      ).catch(console.error)
    }
  }, [activities, orgId, date])

  // Rotation day display
  const usesRotation =
    allActivities?.some((a) => a.rotation_day_type != null) ?? false
  const rotationLabel =
    usesRotation && schoolDay?.rotation_day
      ? schoolDay.rotation_day + ' Day'
      : null

  const blockLabels = orgSettings?.block_labels ?? []

  // Grid bounds
  const gridBounds = useMemo(() => {
    if (activities.length === 0) {
      return { start: DEFAULT_GRID_START, end: DEFAULT_GRID_END }
    }
    const starts = activities.map((a) => a.default_start_time).filter(Boolean)
    const ends = activities.map((a) => a.default_end_time).filter(Boolean)
    if (starts.length === 0) {
      return { start: DEFAULT_GRID_START, end: DEFAULT_GRID_END }
    }
    const minStart = starts.reduce((a, b) => (a < b ? a : b))
    const maxEnd = ends.reduce((a, b) => (a > b ? a : b))
    return {
      start: minStart < DEFAULT_GRID_START ? floorToHour(minStart) : DEFAULT_GRID_START,
      end: maxEnd > DEFAULT_GRID_END ? ceilToHour(maxEnd) : DEFAULT_GRID_END,
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

  const greeting = getGreeting()

  // --- Detail sheet state ---
  const [activeDetailActivity, setActiveDetailActivity] = useState(null)

  // --- Modal state ---
  const [statusModal, setStatusModal] = useState(null)
  const [freeformModal, setFreeformModal] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)
  // Transient check-in state for multi-step flow
  const [pendingCheckIn, setPendingCheckIn] = useState(null)

  const invalidateActions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['student-actions', studentId, dateStr] })
  }, [queryClient, studentId, dateStr])

  const invalidateStreaks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['streaks', studentId] })
  }, [queryClient, studentId])

  // --- Flow A: Presence Wave ---
  const handleWave = useCallback(async (activity) => {
    const instanceId = actionData?.instances?.get(activity.id)
    if (!instanceId) { console.warn('Wave skipped: no instanceId for activity', activity.id); return }
    try {
      await createPresenceWave(studentId, instanceId)
      useToastStore.getState().show('Hey!', <HandWaving size={16} />)
      invalidateActions()
      invalidateStreaks()
    } catch (err) {
      console.error('Wave failed:', err)
    }
  }, [studentId, actionData, invalidateActions, invalidateStreaks])

  // --- Flow B: Standalone Status Update ---
  const handleStatusUpdate = useCallback((activity) => {
    const instanceId = actionData?.instances?.get(activity.id)
    if (!instanceId) { console.warn('Status update skipped: no instanceId for activity', activity.id); return }
    setStatusModal({
      activityName: activity.name,
      instanceId,
      promptText: "What're you up to?",
      defaultType: 'reflection',
      allowTypeChange: true,
      checkinId: null,
      onComplete: () => {
        useToastStore.getState().show('Update saved', <NotePencil size={16} />)
        invalidateActions()
      },
    })
  }, [actionData, invalidateActions])

  // --- Flow C: Check-In ---
  const handleCheckIn = useCallback(async (activity) => {
    const instanceId = actionData?.instances?.get(activity.id)
    if (!instanceId) { console.warn('Check-in skipped: no instanceId for activity', activity.id); return }

    // Step 1: Geofence check (if required)
    let locationData = {}
    if (activity.requires_geofence) {
      try {
        const pos = await getCurrentPosition()
        const result = validateGeofence(pos.lat, pos.lng, activity)
        locationData = { lat: pos.lat, lng: pos.lng, validated: result.valid }
        if (!result.valid) {
          // Warn but allow proceeding
          alert(`You're ${result.distance}m away from the expected area (${result.radius}m radius). You can still check in.`)
        }
      } catch {
        // Permission denied or error — proceed without location
        locationData = {}
      }
    }

    // Step 2: Create check-in record
    try {
      const checkInRecord = await createCheckIn(studentId, instanceId, locationData)
      useToastStore.getState().show("You're here!", <CheckCircle weight="fill" size={16} />)
      invalidateActions()

      // Step 3: Freeform tagging (if applicable)
      if (activity.allows_freeform) {
        // Get taggable activities: today's other scheduled + unscheduled enrolled
        const taggableActivities = (allActivities ?? []).filter((a) => {
          if (a.id === activity.id) return false
          // Include today's scheduled activities
          const meetsToday = activities.some((ta) => ta.id === a.id)
          // Include unscheduled activities
          return meetsToday || a.is_not_scheduled
        })

        setPendingCheckIn({ checkInRecord, activity, instanceId })
        setFreeformModal({
          activityName: activity.name,
          availableActivities: taggableActivities,
          checkInRecord,
        })
        return
      }

      // Step 4: Status prompt (no freeform)
      setPendingCheckIn({ checkInRecord, activity, instanceId })
      setStatusModal({
        activityName: activity.name,
        instanceId,
        promptText: "What're your plans?",
        defaultType: 'plans',
        allowTypeChange: false,
        checkinId: checkInRecord.id,
        isCheckInFlow: true,
        onComplete: () => {
          setPendingCheckIn(null)
          invalidateActions()
        },
      })
    } catch (err) {
      console.error('Check-in failed:', err)
    }
  }, [studentId, actionData, activities, allActivities, invalidateActions])

  // Handle freeform tag selection → transition to status modal
  const handleFreeformConfirm = useCallback(async (activityIds) => {
    if (!pendingCheckIn) return
    const { checkInRecord, activity, instanceId } = pendingCheckIn

    try {
      await createCheckinTags(checkInRecord.id, activityIds)
    } catch (err) {
      console.error('Failed to save tags:', err)
    }

    setFreeformModal(null)

    // Open status modal for check-in
    setStatusModal({
      activityName: activity.name,
      instanceId,
      promptText: "What're your plans?",
      defaultType: 'plans',
      allowTypeChange: false,
      checkinId: checkInRecord.id,
      isCheckInFlow: true,
      onComplete: () => {
        setPendingCheckIn(null)
        invalidateActions()
      },
    })
  }, [pendingCheckIn, invalidateActions])

  // Handle freeform cancel → rollback check-in
  const handleFreeformCancel = useCallback(async () => {
    if (pendingCheckIn) {
      try {
        await deleteCheckIn(pendingCheckIn.checkInRecord.id)
      } catch (err) {
        console.error('Failed to rollback check-in:', err)
      }
      setPendingCheckIn(null)
      invalidateActions()
    }
    setFreeformModal(null)
  }, [pendingCheckIn, invalidateActions])

  // --- Flow D: Check-Out ---
  const handleCheckOut = useCallback((activity, checkInRecord) => {
    const instanceId = actionData?.instances?.get(activity.id)
    if (!instanceId || !checkInRecord) return

    setStatusModal({
      activityName: activity.name,
      instanceId,
      promptText: "What'd you accomplish?",
      defaultType: 'progress',
      allowTypeChange: false,
      checkinId: checkInRecord.id,
      isCheckOutFlow: true,
      checkInRecordId: checkInRecord.id,
      onComplete: () => {
        useToastStore.getState().show('See you later!', <SignOut size={16} />)
        invalidateActions()
      },
    })
  }, [actionData, invalidateActions])

  // --- Status modal save handler ---
  const handleStatusSave = useCallback(async (content, statusType) => {
    if (!statusModal) return
    setSavingStatus(true)

    try {
      await createStatusUpdate(
        studentId,
        statusModal.instanceId,
        statusType,
        content,
        statusModal.checkinId
      )

      // If check-out flow, write the checkout timestamp
      if (statusModal.isCheckOutFlow && statusModal.checkInRecordId) {
        await checkOut(statusModal.checkInRecordId)
      }

      statusModal.onComplete?.()
      setStatusModal(null)
    } catch (err) {
      console.error('Status update failed:', err)
    } finally {
      setSavingStatus(false)
    }
  }, [studentId, statusModal])

  // --- Status modal cancel handler ---
  const handleStatusCancel = useCallback(async () => {
    // If cancelling during check-in flow, rollback the check-in
    if (statusModal?.isCheckInFlow && pendingCheckIn) {
      try {
        await deleteCheckIn(pendingCheckIn.checkInRecord.id)
      } catch (err) {
        console.error('Failed to rollback check-in:', err)
      }
      setPendingCheckIn(null)
      invalidateActions()
    }
    setStatusModal(null)
  }, [statusModal, pendingCheckIn, invalidateActions])

  // Render card function for SingleDayAgenda
  const renderCard = (activity) => {
    const staffName = resolveStaffName(activity)

    return (
      <StudentActivityCard
        activity={activity}
        staffDisplayName={staffName}
        isToday={isToday}
        checkIn={actionData?.checkIns?.get(activity.id) ?? null}
        wave={actionData?.waves?.get(activity.id) ?? null}
        statusCount={actionData?.statusCounts?.get(activity.id) ?? 0}
        hasInstance={actionData?.instances?.has(activity.id) ?? false}
        streak={streakData?.get(activity.id) ?? 0}
        calendarColor={activity.calendar?.color}
        onWave={handleWave}
        onStatusUpdate={handleStatusUpdate}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        onTap={() => setActiveDetailActivity(activity)}
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
        <button
          className="btn btn-ghost btn-circle btn-sm"
          onClick={goToPrev}
          aria-label="Previous day"
        >
          <CaretCircleLeft size={20} />
        </button>
        <div className="text-center">
          {isToday && (
            <p className="text-xs text-base-content/50 mb-0.5">{greeting}</p>
          )}
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
          <CaretCircleRight size={20} />
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
      {!isLoading && activities.length > 0 && (
        <SingleDayAgenda
          activities={activities}
          gridStartMinutes={gridStartMinutes}
          gridEndMinutes={gridEndMinutes}
          renderCard={renderCard}
        />
      )}

      {/* Empty state */}
      {!isLoading && activities.length === 0 && (
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body items-center text-center py-16">
            <CalendarBlank size={40} weight="thin" className="text-base-content/30 mb-2" />
            <p className="text-base-content/50">
              {isToday ? "Nothing on your schedule today. Enjoy the break!" : "No classes scheduled for this date."}
            </p>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      <StatusUpdateModal
        isOpen={!!statusModal}
        onClose={handleStatusCancel}
        onSave={handleStatusSave}
        activityName={statusModal?.activityName ?? ''}
        promptText={statusModal?.promptText ?? ''}
        defaultType={statusModal?.defaultType ?? 'reflection'}
        allowTypeChange={statusModal?.allowTypeChange ?? true}
        saving={savingStatus}
      />

      {/* Freeform Tag Selector */}
      <FreeformTagSelector
        isOpen={!!freeformModal}
        onClose={handleFreeformCancel}
        onConfirm={handleFreeformConfirm}
        availableActivities={freeformModal?.availableActivities ?? []}
        activityName={freeformModal?.activityName ?? ''}
      />

      {/* Activity Detail Sheet */}
      <ActivityDetailSheet
        isOpen={!!activeDetailActivity}
        onClose={() => setActiveDetailActivity(null)}
        activity={activeDetailActivity}
        blockLabel={activeDetailActivity?.block?.length > 0
          ? activeDetailActivity.block.map(b => getBlockLabel(b, blockLabels)).join(', ')
          : null}
        staffDisplayName={activeDetailActivity ? resolveStaffName(activeDetailActivity) : null}
        isToday={isToday}
        checkIn={actionData?.checkIns?.get(activeDetailActivity?.id) ?? null}
        wave={actionData?.waves?.get(activeDetailActivity?.id) ?? null}
        statusCount={actionData?.statusCounts?.get(activeDetailActivity?.id) ?? 0}
        hasInstance={actionData?.instances?.has(activeDetailActivity?.id) ?? false}
        streak={streakData?.get(activeDetailActivity?.id) ?? 0}
        onWave={handleWave}
        onStatusUpdate={handleStatusUpdate}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
      />
    </div>
  )
}

function getGreeting() {
  const hour = getDevNow().getHours() // DEV OVERRIDE
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// Resolve staff display name: instructor_name > first teacher last name > null
function resolveStaffName(activity) {
  if (activity.instructor_name) return activity.instructor_name
  const teacher = (activity.activity_staff ?? []).find((s) => s.role === 'teacher')
  if (teacher?.user) {
    const t = teacher.user
    return t.preferred_name || t.last_name || `${t.first_name} ${t.last_name}`
  }
  return null
}

export default TodayView