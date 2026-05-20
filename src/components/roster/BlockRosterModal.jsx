import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRoster } from '@/hooks/useRoster'
import { upsertAttendanceRecord } from '@/api/agenda'
import { getBlockLabel } from '@/lib/constants'
import { getViewerRole } from '@/lib/staffRoles'
import { formatDateISO } from '@/lib/scheduleUtils'
import { formatTimeRange, formatTime } from '@/components/agenda/agendaUtils'
import { StudentRow } from './RosterRow'

const ROLE_BADGE = {
  teacher: { label: 'Teacher', className: 'bg-primary/15 text-primary' },
  monitor: { label: 'Monitor', className: 'bg-secondary/15 text-secondary' },
  prep:    { label: 'Prep',    className: 'bg-base-200 text-base-content/50' },
}

const ROLE_PRIORITY = { teacher: 0, prep: 1, monitor: 2 }

function RoleBadge({ role }) {
  const cfg = ROLE_BADGE[role] ?? ROLE_BADGE.teacher
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0 ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function deriveRole(activity, viewerId, enrollmentCounts) {
  const raw = getViewerRole(activity, viewerId)
  if (raw === 'teacher' && (enrollmentCounts?.get(activity.id) ?? 0) === 0) return 'prep'
  return raw
}

function ActivitySectionHeader({ activity, role, blockLabels, onMarkAllPresent }) {
  const timeRange = formatTimeRange(activity.default_start_time, activity.default_end_time)
  const blockLabel = activity.block?.length
    ? activity.block.map((b) => getBlockLabel(b, blockLabels)).join(', ')
    : null

  return (
    <div className="px-2 pb-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm">{activity.name}</span>
        {role && <RoleBadge role={role} />}
        <button
          className="text-xs text-primary underline-offset-2 hover:underline ml-auto"
          onClick={onMarkAllPresent}
        >
          Mark all P
        </button>
      </div>
      {(timeRange || blockLabel) && (
        <div className="flex items-center gap-1.5 text-xs text-base-content/50 mt-0.5">
          {timeRange && <span>{timeRange}</span>}
          {timeRange && blockLabel && <span>·</span>}
          {blockLabel && <span>{blockLabel}</span>}
        </div>
      )}
    </div>
  )
}

function BlockRosterModal({
  groupTitle,
  groupTimeRange,
  activities,
  date,
  orgId,
  teacherId,
  blockLabels,
  actionSummary,
  schoolDay = null,
  enrollmentCounts,
  onClose,
}) {
  const activityIds = activities.map((a) => a.id)
  const { todayStudents, allStudents, attendanceByStudent, instances, isLoading, error } =
    useRoster(activityIds, date, orgId, activities, schoolDay)

  const [pendingChanges, setPendingChanges] = useState(new Map())
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const orderedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      const priA = ROLE_PRIORITY[deriveRole(a, teacherId, enrollmentCounts)] ?? 3
      const priB = ROLE_PRIORITY[deriveRole(b, teacherId, enrollmentCounts)] ?? 3
      if (priA !== priB) return priA - priB
      const timeCmp = (a.default_start_time ?? '').localeCompare(b.default_start_time ?? '')
      if (timeCmp !== 0) return timeCmp
      return a.id.localeCompare(b.id)
    })
  }, [activities, teacherId, enrollmentCounts])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function getStudentStatus(studentId, activityId) {
    return (
      pendingChanges.get(`${studentId}::${activityId}`) ??
      attendanceByStudent.get(studentId)?.status ??
      null
    )
  }

  function toggleAttendance(studentId, activityId, status) {
    const key = `${studentId}::${activityId}`
    setPendingChanges((prev) => {
      const next = new Map(prev)
      const initial = attendanceByStudent.get(studentId)?.status ?? null
      const currentPending = next.get(key)
      if (currentPending === status || status === initial) {
        next.delete(key)
      } else {
        next.set(key, status)
      }
      return next
    })
  }

  function markSectionPresent(activityId) {
    const sectionStudents = todayStudents.filter((s) => s.activityId === activityId)
    setPendingChanges((prev) => {
      const next = new Map(prev)
      for (const student of sectionStudents) {
        if (!student.scheduledToday || !student.requiresAttendance) continue
        const key = `${student.studentId}::${activityId}`
        const existing = attendanceByStudent.get(student.studentId)?.status ?? null
        if (!existing && !next.has(key)) {
          next.set(key, 'present')
        }
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const upserts = []
      for (const [compositeKey, status] of pendingChanges) {
        const separatorIdx = compositeKey.indexOf('::')
        const studentId = compositeKey.slice(0, separatorIdx)
        const activityId = compositeKey.slice(separatorIdx + 2)
        const instanceId = instances.get(activityId)
        if (!instanceId) continue
        upserts.push(upsertAttendanceRecord(instanceId, studentId, status, teacherId))
      }
      await Promise.all(upserts)
      const dateStr = formatDateISO(date)
      queryClient.invalidateQueries({ queryKey: ['roster'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-agenda', teacherId, dateStr] })
      queryClient.invalidateQueries({ queryKey: ['teacher-action-summary'] })
      queryClient.invalidateQueries({ queryKey: ['agenda', 'visible-to-all', orgId, dateStr] })
      onClose()
    } catch (err) {
      console.error('Failed to save block attendance:', err)
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

  const subtitle = [groupTimeRange, `${orderedActivities.length} activit${orderedActivities.length === 1 ? 'y' : 'ies'}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
        >
          ✕
        </button>
        <div className="mb-4">
          <h3 className="font-bold text-lg">{groupTitle} attendance</h3>
          <p className="text-sm text-base-content/60">{subtitle}</p>
        </div>

        <div className="divider my-0" />

        <div className="py-4 max-h-[65vh] overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md" />
            </div>
          )}
          {error && (
            <div className="text-error text-center py-4">Failed to load roster.</div>
          )}
          {!isLoading && !error && orderedActivities.map((activity, actIdx) => {
            const role = deriveRole(activity, teacherId, enrollmentCounts)
            const sectionStudents = todayStudents.filter((s) => s.activityId === activity.id)
            const onTimeSectionStudents = sectionStudents.filter((s) => s.startTimeOverride == null)
            const lateSectionStudents = sectionStudents
              .filter((s) => s.startTimeOverride != null)
              .sort((a, b) => {
                const t = a.startTimeOverride.localeCompare(b.startTimeOverride)
                return t !== 0 ? t : a.lastName.localeCompare(b.lastName)
              })

            return (
              <div key={activity.id}>
                {actIdx > 0 && <div className="divider my-2" />}
                <ActivitySectionHeader
                  activity={activity}
                  role={role}
                  blockLabels={blockLabels}
                  onMarkAllPresent={() => markSectionPresent(activity.id)}
                />
                {sectionStudents.length === 0 && (
                  <p className="text-base-content/40 text-sm text-center py-4">No students scheduled today.</p>
                )}
                {onTimeSectionStudents.map((student, idx) => (
                  <StudentRow
                    key={`${student.studentId}-${student.activityId}`}
                    student={student}
                    isAggregate={false}
                    currentStatus={getStudentStatus(student.studentId, student.activityId)}
                    onToggle={(sId, status) => toggleAttendance(sId, activity.id, status)}
                    actionData={getActionData(student)}
                    onClick={() => {}}
                    isEven={idx % 2 === 1}
                    timeAnnotation={student.endTimeOverride ? `leaves ${formatTime(student.endTimeOverride)}` : null}
                  />
                ))}
                {lateSectionStudents.length > 0 && (
                  <>
                    <div className="divider my-1" />
                    <div className="px-2 py-1">
                      <span className="text-sm font-medium text-warning">Arriving later</span>
                    </div>
                    {lateSectionStudents.map((student, idx) => {
                      const annotation = student.endTimeOverride
                        ? `arrives ${formatTime(student.startTimeOverride)} · leaves ${formatTime(student.endTimeOverride)}`
                        : `arrives ${formatTime(student.startTimeOverride)}`
                      return (
                        <StudentRow
                          key={`${student.studentId}-${student.activityId}`}
                          student={student}
                          isAggregate={false}
                          currentStatus={getStudentStatus(student.studentId, student.activityId)}
                          onToggle={(sId, status) => toggleAttendance(sId, activity.id, status)}
                          actionData={getActionData(student)}
                          onClick={() => {}}
                          isEven={idx % 2 === 1}
                          timeAnnotation={annotation}
                        />
                      )
                    })}
                  </>
                )}
              </div>
            )
          })}
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={pendingChanges.size === 0 || saving}
            onClick={handleSave}
          >
            {saving && <span className="loading loading-spinner loading-xs" />}
            {pendingChanges.size > 0 ? `Save (${pendingChanges.size})` : 'Save'}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}

export default BlockRosterModal
