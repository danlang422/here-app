import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FaLayerGroup } from 'react-icons/fa6'
import { useRoster } from '@/hooks/useRoster'
import { upsertAttendanceRecord } from '@/api/agenda'
import { getBlockLabel } from '@/lib/constants'
import { formatDateISO } from '@/lib/scheduleUtils'

const STATUS_OPTIONS = [
  { key: 'present', label: 'P', fullLabel: 'Present', btnClass: 'btn-success' },
  { key: 'absent', label: 'A', fullLabel: 'Absent', btnClass: 'btn-error' },
  { key: 'excused', label: 'E', fullLabel: 'Excused', btnClass: 'btn-warning' },
  { key: 'tardy', label: 'T', fullLabel: 'Tardy', btnClass: 'btn-info' },
]

function RosterModal({
  activities,
  isAggregate,
  date,
  orgId,
  teacherId,
  blockLabels,
  onClose,
}) {
  const activityIds = activities.map((a) => a.id)
  const { students, attendanceByStudent, instances, isLoading, error } =
    useRoster(activityIds, date, orgId, activities)

  const [pendingChanges, setPendingChanges] = useState(new Map())
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

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
      if (status === initial) {
        next.delete(studentId)
      } else {
        next.set(studentId, status)
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const upserts = []
      for (const [studentId, status] of pendingChanges) {
        // Find the activity this student belongs to
        const student = students.find((s) => s.studentId === studentId)
        if (!student) continue
        const instanceId = instances.get(student.activityId)
        if (!instanceId) continue

        upserts.push(
          upsertAttendanceRecord(instanceId, studentId, status, teacherId)
        )
      }
      await Promise.all(upserts)

      // Invalidate queries
      const dateStr = formatDateISO(date)
      queryClient.invalidateQueries({ queryKey: ['roster'] })
      queryClient.invalidateQueries({
        queryKey: ['teacher-agenda', teacherId, dateStr],
      })

      onClose()
    } catch (err) {
      console.error('Failed to save attendance:', err)
      setSaving(false)
    }
  }

  // Header content
  const headerContent = buildHeader(activities, isAggregate, blockLabels)

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
          <p className="text-sm text-base-content/50">{headerContent.count}</p>
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

          {!isLoading && !error && students.length === 0 && (
            <p className="text-base-content/50 text-center py-8">
              No students enrolled.
            </p>
          )}

          {!isLoading &&
            !error &&
            students.map((student) => (
              <StudentRow
                key={`${student.studentId}-${student.activityId}`}
                student={student}
                isAggregate={isAggregate}
                currentStatus={getStudentStatus(student.studentId)}
                onToggle={toggleAttendance}
              />
            ))}
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
    </dialog>
  )
}

function StudentRow({ student, isAggregate, currentStatus, onToggle }) {
  const displayName = student.preferredName
    ? `${student.preferredName} ${student.lastName}`
    : `${student.firstName} ${student.lastName}`

  const activityLabel = student.activityLocation
    ? `${student.activityName} \u00b7 ${student.activityLocation}`
    : student.activityName

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-1">
      <div className="flex-1 min-w-0">
        <span className="truncate block">{displayName}</span>
        {isAggregate && (
          <span className="text-sm text-base-content/50 italic truncate block">
            {activityLabel}
          </span>
        )}
      </div>

      {student.requiresAttendance ? (
        <div className="join shrink-0">
          {STATUS_OPTIONS.map(({ key, label, fullLabel, btnClass }) => (
            <button
              key={key}
              className={`btn btn-xs join-item ${
                currentStatus === key ? btnClass : 'btn-ghost'
              }`}
              title={fullLabel}
              onClick={() => onToggle(student.studentId, key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <span className="text-sm text-base-content/40 shrink-0">
          No attendance
        </span>
      )}
    </div>
  )
}

function buildHeader(activities, isAggregate, blockLabels) {
  if (isAggregate) {
    const block = activities[0]?.block
    const blockLabel =
      block != null ? getBlockLabel(block, blockLabels) : 'Unassigned'

    const starts = activities.map((a) => a.default_start_time).filter(Boolean)
    const ends = activities.map((a) => a.default_end_time).filter(Boolean)
    const earliestStart = starts.length
      ? starts.reduce((a, b) => (a < b ? a : b))
      : null
    const latestEnd = ends.length
      ? ends.reduce((a, b) => (a > b ? a : b))
      : null

    const timeRange = formatTimeRange(earliestStart, latestEnd)
    const subtitleParts = [timeRange, `${activities.length} activities`].filter(
      Boolean
    )

    const totalStudents = activities.reduce(
      (sum, a) => sum + (a.enrollmentCount ?? 0),
      0
    )

    return {
      icon: <FaLayerGroup size={16} />,
      title: blockLabel,
      subtitle: subtitleParts.join(' \u00b7 '),
      count: `${totalStudents} students`,
    }
  }

  const activity = activities[0]
  const timeRange = formatTimeRange(
    activity.default_start_time,
    activity.default_end_time
  )
  const blockLabel =
    activity.block != null
      ? getBlockLabel(activity.block, blockLabels)
      : null
  const metaParts = [timeRange, blockLabel, activity.location].filter(Boolean)

  return {
    icon: null,
    title: activity.name,
    subtitle: metaParts.join(' \u00b7 '),
    count: `${activity.enrollmentCount ?? 0} students`,
  }
}

function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return null
  return `${formatTime(startTime)} \u2013 ${formatTime(endTime)}`
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'p' : 'a'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0
    ? `${hour12}${suffix}`
    : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

export default RosterModal
