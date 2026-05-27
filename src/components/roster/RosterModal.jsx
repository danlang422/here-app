import { useState, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Stack } from '@phosphor-icons/react'
import { useRoster } from '@/hooks/useRoster'
import { upsertAttendanceRecord } from '@/api/agenda'
import { getBlockLabel } from '@/lib/constants'
import { formatDateISO } from '@/lib/scheduleUtils'
import { formatTime } from '@/components/agenda/agendaUtils'
import StudentDetailOverlay from './StudentDetailOverlay'
import { StudentRow } from './RosterRow'
import { STATUS_OPTIONS } from './rosterUtils'

function RosterModal({
  activities,
  isAggregate,
  date,
  orgId,
  teacherId,
  blockLabels,
  actionSummary,
  schoolDay = null,
  onClose,
}) {
  const activityIds = activities.map((a) => a.id)
  const { todayStudents, allStudents, attendanceByStudent, instances, isLoading, error } =
    useRoster(activityIds, date, orgId, activities, schoolDay)

  const [pendingChanges, setPendingChanges] = useState(new Map())
  const [saving, setSaving] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showFullRoster, setShowFullRoster] = useState(false)
  const queryClient = useQueryClient()

  const hasFilteredStudents = todayStudents.length < allStudents.length

  // Split display list into on-time and arriving-later sections
  const displayStudents = showFullRoster ? allStudents : todayStudents
  const onTimeStudents = displayStudents.filter((s) => s.startTimeOverride == null)
  const lateStudents = displayStudents
    .filter((s) => s.startTimeOverride != null)
    .sort((a, b) => {
      const timeCmp = a.startTimeOverride.localeCompare(b.startTimeOverride)
      return timeCmp !== 0 ? timeCmp : a.lastName.localeCompare(b.lastName)
    })

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !selectedStudent) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, selectedStudent])

  const getStudentStatus = useCallback(
    (studentId) => {
      return (
        pendingChanges.get(studentId) ??
        attendanceByStudent.get(studentId)?.status ??
        null
      )
    },
    [pendingChanges, attendanceByStudent]
  )

  function toggleAttendance(studentId, status) {
    setPendingChanges((prev) => {
      const next = new Map(prev)
      const initial = attendanceByStudent.get(studentId)?.status ?? null
      const currentPending = next.get(studentId)
      if (currentPending === status || status === initial) {
        next.delete(studentId)
      } else {
        next.set(studentId, status)
      }
      return next
    })
  }

  function markAllPresent() {
    setPendingChanges((prev) => {
      const next = new Map(prev)
      for (const student of todayStudents) {
        if (!student.scheduledToday || !student.requiresAttendance) continue
        const existingStatus = attendanceByStudent.get(student.studentId)?.status ?? null
        if (!existingStatus && !next.has(student.studentId)) {
          next.set(student.studentId, 'present')
        }
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const upserts = []
      for (const [studentId, status] of pendingChanges) {
        const student = allStudents.find((s) => s.studentId === studentId)
        if (!student) continue
        const instanceId = instances.get(student.activityId)
        if (!instanceId) continue

        upserts.push(
          upsertAttendanceRecord(instanceId, studentId, status, teacherId)
        )
      }
      await Promise.all(upserts)

      const dateStr = formatDateISO(date)
      queryClient.invalidateQueries({ queryKey: ['roster'] })
      queryClient.invalidateQueries({
        queryKey: ['teacher-agenda', teacherId, dateStr],
      })
      queryClient.invalidateQueries({ queryKey: ['teacher-action-summary'] })

      onClose()
    } catch (err) {
      console.error('Failed to save attendance:', err)
      setSaving(false)
    }
  }

  function getActionData(student) {
    if (!actionSummary) return { wave: null, checkIn: null, statusCount: 0 }
    const key = `${student.studentId}-${student.activityId}`
    return {
      wave: actionSummary.waves?.get(key) ?? null,
      checkIn: actionSummary.checkIns?.get(key) ?? null,
      statusCount: actionSummary.statusCounts?.get(key) ?? 0,
    }
  }

  function handleRowClick(student) {
    const instanceId = actionSummary?.instances?.get(student.activityId) ?? instances.get(student.activityId)
    const activity = activities.find((a) => a.id === student.activityId) ?? activities[0]
    setSelectedStudent({
      ...student,
      instanceId,
      activity,
    })
  }

  // Header content
  const headerContent = buildHeader(activities, isAggregate, blockLabels, todayStudents.length, allStudents.length)

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        {/* Header */}
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
        >
          ✕
        </button>
        <div className="mb-4">
          <h3 className="font-bold text-lg flex items-center gap-1.5">
            {headerContent.icon}
            {headerContent.title}
          </h3>
          <p className="text-sm text-base-content/60">{headerContent.subtitle}</p>
          <div className="flex items-center gap-3">
            <p className="text-sm text-base-content/50">{headerContent.count}</p>
            <button
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={markAllPresent}
            >
              Mark all P
            </button>
            {hasFilteredStudents && (
              <button
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => setShowFullRoster((v) => !v)}
              >
                {showFullRoster
                  ? 'Show today only'
                  : `Show all ${allStudents.length} enrolled`}
              </button>
            )}
          </div>
        </div>

        <div className="divider my-0" />

        {/* Body */}
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md" />
            </div>
          )}

          {error && (
            <div className="text-error text-center py-4">
              Failed to load roster.
            </div>
          )}

          {!isLoading && !error && allStudents.length === 0 && (
            <p className="text-base-content/50 text-center py-8">
              No students enrolled.
            </p>
          )}

          {!isLoading && !error && allStudents.length > 0 && displayStudents.length === 0 && (
            <p className="text-base-content/50 text-center py-8">
              No students scheduled today.{' '}
              <button className="text-primary underline-offset-2 hover:underline" onClick={() => setShowFullRoster(true)}>
                Show all enrolled
              </button>
            </p>
          )}

          {!isLoading && !error && displayStudents.length > 0 && (
            <>
              {onTimeStudents.map((student, index) => (
                <StudentRow
                  key={`${student.studentId}-${student.activityId}`}
                  student={student}
                  isAggregate={isAggregate}
                  currentStatus={getStudentStatus(student.studentId)}
                  onToggle={toggleAttendance}
                  actionData={getActionData(student)}
                  onClick={() => handleRowClick(student)}
                  isEven={index % 2 === 1}
                  timeAnnotation={
                    student.endTimeOverride
                      ? `leaves ${formatTime(student.endTimeOverride)}`
                      : null
                  }
                />
              ))}

              {lateStudents.length > 0 && (
                <>
                  <div className="divider my-1" />
                  <div className="px-2 py-1">
                    <span className="text-sm font-medium text-warning">Arriving later</span>
                  </div>
                  {lateStudents.map((student, index) => {
                    const annotation = student.endTimeOverride
                      ? `arrives ${formatTime(student.startTimeOverride)} · leaves ${formatTime(student.endTimeOverride)}`
                      : `arrives ${formatTime(student.startTimeOverride)}`
                    return (
                      <StudentRow
                        key={`${student.studentId}-${student.activityId}`}
                        student={student}
                        isAggregate={isAggregate}
                        currentStatus={getStudentStatus(student.studentId)}
                        onToggle={toggleAttendance}
                        actionData={getActionData(student)}
                        onClick={() => handleRowClick(student)}
                        isEven={index % 2 === 1}
                        timeAnnotation={annotation}
                      />
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={pendingChanges.size === 0 || saving}
            onClick={handleSave}
          >
            {saving && <span className="loading loading-spinner loading-xs" />}
            {pendingChanges.size > 0
              ? `Save (${pendingChanges.size})`
              : 'Save'}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>

      {/* Student detail overlay */}
      {selectedStudent && (
        <StudentDetailOverlay
          isOpen={true}
          onClose={() => setSelectedStudent(null)}
          student={selectedStudent}
          instanceId={selectedStudent.instanceId}
          activity={selectedStudent.activity}
          orgId={orgId}
          blockLabels={blockLabels}
        />
      )}
    </dialog>
  )
}


function buildHeader(activities, isAggregate, blockLabels, todayCount, totalCount) {
  const countLabel = todayCount < totalCount
    ? `${todayCount} of ${totalCount} students today`
    : `${totalCount} student${totalCount !== 1 ? 's' : ''}`

  if (isAggregate) {
    const allBlocks = [...new Set(activities.flatMap(a => a.block ?? []))]
    const blockLabel = allBlocks.length > 0
      ? allBlocks.map(b => getBlockLabel(b, blockLabels)).join(', ')
      : 'Unassigned'

    const starts = activities.map((a) => a.default_start_time).filter(Boolean)
    const ends = activities.map((a) => a.default_end_time).filter(Boolean)
    const earliestStart = starts.length
      ? starts.reduce((a, b) => (a < b ? a : b))
      : null
    const latestEnd = ends.length
      ? ends.reduce((a, b) => (a > b ? a : b))
      : null

    const timeRange = formatTimeRange(earliestStart, latestEnd)
    const subtitleParts = [timeRange, `${activities.length} activities`].filter(Boolean)

    return {
      icon: <Stack size={16} />,
      title: blockLabel,
      subtitle: subtitleParts.join(' \u00b7 '),
      count: countLabel,
    }
  }

  const activity = activities[0]
  const timeRange = formatTimeRange(
    activity.default_start_time,
    activity.default_end_time
  )
  const blockLabel = activity.block?.length > 0
    ? activity.block.map(b => getBlockLabel(b, blockLabels)).join(', ')
    : null
  const metaParts = [timeRange, blockLabel, activity.location].filter(Boolean)

  return {
    icon: null,
    title: activity.name,
    subtitle: metaParts.join(' \u00b7 '),
    count: countLabel,
  }
}

function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return null
  return `${formatTime(startTime)} \u2013 ${formatTime(endTime)}`
}

export default RosterModal
