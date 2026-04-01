import { useState, useMemo, useCallback } from 'react'
import { useActivities, useCreateActivity } from '@/hooks/useActivities'
import { useStudents } from '@/hooks/useUsers'
import {
  useOrgEnrollments,
  useBulkEnrollStudents,
  useBulkUnenrollStudents,
} from '@/hooks/useEnrollments'
import { validateEnrollment } from '@/lib/enrollmentValidation'
import { formatUserName } from '@/api/users'
import { getBlockLabel } from '@/lib/constants'

/**
 * EnrollmentPanel — manages enrolling/unenrolling students for an activity.
 *
 * NOTE: This component is dormant — no longer mounted in ActivityManagement after
 * inline enrollment was added to ActivityDetail (issue #51). It will be revived for
 * student-centric enrollment (Entry B, issue #7) which needs the activity dropdown.
 *
 * Props:
 *   orgId             - organization ID
 *   initialActivityId - pre-select this activity (from activity row click)
 */
export default function EnrollmentPanel({ orgId, initialActivityId = null }) {
  // --- Data queries ---
  const { data: activities = [] } = useActivities(orgId)
  const { data: students = [] } = useStudents(orgId)
  const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)

  // --- Internal state ---
  const [selectedActivityId, setSelectedActivityId] = useState(initialActivityId)
  const [stagedStudentIds, setStagedStudentIds] = useState(new Set())
  const [unstagedEnrollmentIds, setUnstagedEnrollmentIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [submitPhase, setSubmitPhase] = useState('ready') // 'ready' | 'confirm' | 'done'
  const [submitResult, setSubmitResult] = useState(null)

  // --- Mutations ---
  const enrollMutation = useBulkEnrollStudents()
  const unenrollMutation = useBulkUnenrollStudents()

  // --- Derived data ---
  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === selectedActivityId) || null,
    [activities, selectedActivityId]
  )

  // Activity enrollments from org cache (students currently enrolled in selected activity)
  const activityEnrollments = useMemo(() => {
    if (!selectedActivityId) return []
    return orgEnrollments.filter((e) => e.activity_id === selectedActivityId)
  }, [orgEnrollments, selectedActivityId])

  // Set of student IDs currently enrolled in the selected activity (from DB)
  const enrolledStudentIds = useMemo(
    () => new Set(activityEnrollments.map((e) => e.student_id)),
    [activityEnrollments]
  )

  // Map enrollment ID by student ID for the current activity
  const enrollmentByStudentId = useMemo(() => {
    const map = new Map()
    for (const e of activityEnrollments) {
      map.set(e.student_id, e)
    }
    return map
  }, [activityEnrollments])

  // Conflict map: studentId → { hasConflict, conflicts }
  const conflictMap = useMemo(() => {
    const map = new Map()
    if (!selectedActivity) return map

    for (const student of students) {
      // Get this student's existing enrollments (with activity data)
      const studentEnrollments = orgEnrollments
        .filter((e) => e.student_id === student.id && e.activity_id !== selectedActivityId)

      const result = validateEnrollment(selectedActivity, studentEnrollments)
      if (result.conflicts.length > 0) {
        map.set(student.id, {
          hasConflict: true,
          conflicts: result.conflicts,
        })
      }
    }
    return map
  }, [selectedActivity, selectedActivityId, orgEnrollments, students])

  // --- Grade levels for filter ---
  const gradeOptions = useMemo(() => {
    const grades = new Set(students.map((s) => s.grade_level).filter(Boolean))
    return Array.from(grades).sort((a, b) => a - b)
  }, [students])

  // --- Filter students ---
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const name = `${s.first_name} ${s.last_name} ${s.preferred_name || ''}`.toLowerCase()
        if (!name.includes(q)) return false
      }
      if (gradeFilter && String(s.grade_level) !== gradeFilter) return false
      return true
    })
  }, [students, searchQuery, gradeFilter])

  // --- Partition students into staged and available ---
  const { stagedStudents, availableStudents } = useMemo(() => {
    const staged = []
    const available = []

    for (const student of filteredStudents) {
      const isEnrolled = enrolledStudentIds.has(student.id)
      const isNewlyStaged = stagedStudentIds.has(student.id)
      const enrollment = enrollmentByStudentId.get(student.id)
      const isPendingUnenroll = enrollment && unstagedEnrollmentIds.has(enrollment.id)

      if (isPendingUnenroll) {
        // Was enrolled, admin moved them below — show in available with unenroll marker
        available.push({ ...student, pendingUnenroll: true, enrollmentId: enrollment.id })
      } else if (isEnrolled || isNewlyStaged) {
        // In the staged zone
        staged.push({ ...student, isNewlyStaged: !isEnrolled })
      } else {
        available.push({ ...student, pendingUnenroll: false })
      }
    }

    // Sort staged: existing enrollments first, then newly staged; alpha within each
    staged.sort((a, b) => {
      if (a.isNewlyStaged !== b.isNewlyStaged) return a.isNewlyStaged ? 1 : -1
      return (a.last_name || '').localeCompare(b.last_name || '')
    })

    available.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))

    return { stagedStudents: staged, availableStudents: available }
  }, [filteredStudents, enrolledStudentIds, stagedStudentIds, unstagedEnrollmentIds, enrollmentByStudentId])

  // --- Counts for footer ---
  const pendingEnrollCount = stagedStudentIds.size
  const pendingUnenrollCount = unstagedEnrollmentIds.size
  const hasChanges = pendingEnrollCount > 0 || pendingUnenrollCount > 0

  // --- Handlers ---

  function handleActivityChange(newActivityId) {
    if (newActivityId === selectedActivityId) return

    // Confirm if there are staged changes
    if (hasChanges && !window.confirm('Changing activity will reset your staged changes. Continue?')) {
      return
    }

    setSelectedActivityId(newActivityId || null)
    setStagedStudentIds(new Set())
    setUnstagedEnrollmentIds(new Set())
    setSubmitPhase('ready')
    setSubmitResult(null)
  }

  const handleStageStudent = useCallback((studentId) => {
    setStagedStudentIds((prev) => {
      const next = new Set(prev)
      next.add(studentId)
      return next
    })
    setSubmitPhase('ready')
  }, [])

  const handleUnstageStudent = useCallback((studentId) => {
    const enrollment = enrollmentByStudentId.get(studentId)
    if (enrollment) {
      // Already enrolled in DB — mark for unenrollment
      setUnstagedEnrollmentIds((prev) => {
        const next = new Set(prev)
        next.add(enrollment.id)
        return next
      })
    } else {
      // Newly staged — just remove from staged set
      setStagedStudentIds((prev) => {
        const next = new Set(prev)
        next.delete(studentId)
        return next
      })
    }
    setSubmitPhase('ready')
  }, [enrollmentByStudentId])

  const handleRestageStudent = useCallback((enrollmentId) => {
    // Undo pending unenrollment
    setUnstagedEnrollmentIds((prev) => {
      const next = new Set(prev)
      next.delete(enrollmentId)
      return next
    })
    setSubmitPhase('ready')
  }, [])

  // --- Submit flow ---

  // Partition new enrollments into clean vs. conflicted
  const submitSummary = useMemo(() => {
    const clean = []
    const conflicted = []

    for (const studentId of stagedStudentIds) {
      const conflict = conflictMap.get(studentId)
      if (conflict?.hasConflict) {
        conflicted.push({ studentId, conflicts: conflict.conflicts })
      } else {
        clean.push(studentId)
      }
    }

    return {
      clean,
      conflicted,
      unenrollIds: Array.from(unstagedEnrollmentIds),
    }
  }, [stagedStudentIds, conflictMap, unstagedEnrollmentIds])

  function handleSubmitClick() {
    if (submitPhase === 'ready') {
      setSubmitPhase('confirm')
    }
  }

  async function handleConfirm() {
    const { clean, conflicted, unenrollIds } = submitSummary

    try {
      // Fire mutations
      const promises = []

      if (clean.length > 0) {
        const enrollments = clean.map((studentId) => ({
          student_id: studentId,
          activity_id: selectedActivityId,
          block: selectedActivity?.block ?? null,
        }))
        promises.push(enrollMutation.mutateAsync(enrollments))
      }

      if (unenrollIds.length > 0) {
        promises.push(unenrollMutation.mutateAsync(unenrollIds))
      }

      await Promise.all(promises)

      setSubmitResult({
        enrolled: clean.length,
        skipped: conflicted.length,
        unenrolled: unenrollIds.length,
        skippedStudents: conflicted,
      })

      // Reset staged state
      setStagedStudentIds(new Set())
      setUnstagedEnrollmentIds(new Set())
      setSubmitPhase('done')
    } catch {
      // Mutations surface errors via their own state — keep confirm phase
    }
  }

  function handleBack() {
    setSubmitPhase('ready')
  }

  // --- Render ---

  const isSubmitting = enrollMutation.isPending || unenrollMutation.isPending
  const submitError = enrollMutation.error || unenrollMutation.error

  return (
    <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      {/* Activity dropdown */}
      <div className="px-3 pt-3 pb-2">
        <select
          className="select select-bordered select-sm w-full"
          value={selectedActivityId || ''}
          onChange={(e) => handleActivityChange(e.target.value)}
        >
          <option value="">Select an activity...</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Search/filter bar */}
      {selectedActivityId && (
        <div className="flex gap-2 px-3 pb-2">
          <input
            type="text"
            className="input input-bordered input-sm flex-1"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {gradeOptions.length > 0 && (
            <select
              className="select select-bordered select-sm"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
            >
              <option value="">All grades</option>
              {gradeOptions.map((g) => (
                <option key={g} value={String(g)}>Grade {g}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Scrollable student list */}
      {selectedActivityId && (
        <div className="flex-1 overflow-y-auto min-h-0 px-1">
          {/* Staged zone */}
          {stagedStudents.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs font-semibold text-base-content/50 uppercase tracking-wide">
                Enrolled ({stagedStudents.length})
              </div>
              {stagedStudents.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  zone="staged"
                  conflict={conflictMap.get(student.id)}
                  onClick={() => handleUnstageStudent(student.id)}
                  disabled={submitPhase !== 'ready'}
                />
              ))}
            </div>
          )}

          {/* Divider */}
          {stagedStudents.length > 0 && availableStudents.length > 0 && (
            <div className="divider my-1 px-2" />
          )}

          {/* Available zone */}
          {availableStudents.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs font-semibold text-base-content/50 uppercase tracking-wide">
                Available ({availableStudents.length})
              </div>
              {availableStudents.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  zone="available"
                  conflict={conflictMap.get(student.id)}
                  onClick={() =>
                    student.pendingUnenroll
                      ? handleRestageStudent(student.enrollmentId)
                      : handleStageStudent(student.id)
                  }
                  disabled={submitPhase !== 'ready'}
                />
              ))}
            </div>
          )}

          {filteredStudents.length === 0 && (
            <div className="text-center py-8 text-base-content/40 text-sm">
              No students found
            </div>
          )}
        </div>
      )}

      {/* Placeholder when no activity selected */}
      {!selectedActivityId && (
        <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm py-12">
          Select an activity to manage enrollment
        </div>
      )}

      {/* Action footer */}
      {selectedActivityId && (
        <ActionFooter
          submitPhase={submitPhase}
          hasChanges={hasChanges}
          submitSummary={submitSummary}
          submitResult={submitResult}
          submitError={submitError}
          isSubmitting={isSubmitting}
          students={students}
          onSubmit={handleSubmitClick}
          onConfirm={handleConfirm}
          onBack={handleBack}
          selectedActivity={selectedActivity}
          orgId={orgId}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StudentRow — a single student in the staged or available zone
// ---------------------------------------------------------------------------

function StudentRow({ student, zone, conflict, onClick, disabled }) {
  const isPendingUnenroll = student.pendingUnenroll

  return (
    <button
      className={`
        w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 transition-colors
        ${disabled ? 'opacity-60 cursor-default' : 'cursor-pointer hover:bg-base-200'}
        ${isPendingUnenroll ? 'bg-error/10' : ''}
      `}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {/* Conflict dot (available zone only) */}
          {zone === 'available' && !isPendingUnenroll && conflict?.hasConflict && (
            <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" title="Has scheduling conflict" />
          )}
          <span className="text-sm truncate">
            {formatUserName(student)}
          </span>
          {student.grade_level && (
            <span className="text-xs text-base-content/40 flex-shrink-0">
              {student.grade_level}
            </span>
          )}
        </div>

        {/* Conflict detail (staged zone only) */}
        {zone === 'staged' && conflict?.hasConflict && (
          <div className="text-xs text-warning mt-0.5">
            {conflict.conflicts.map((c, i) => (
              <div key={i}>
                Conflicts with {c.activity.name}
                {c.activity.block != null && ` — ${getBlockLabel(c.activity.block)}`}
              </div>
            ))}
          </div>
        )}

        {/* Pending unenroll label */}
        {isPendingUnenroll && (
          <div className="text-xs text-error mt-0.5">Will be unenrolled</div>
        )}
      </div>

      {/* Directional hint */}
      <span className="text-base-content/30 text-xs flex-shrink-0">
        {zone === 'available' && !isPendingUnenroll && '+'}
        {zone === 'staged' && '−'}
        {isPendingUnenroll && '↩'}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// ActionFooter — submit flow with ready / confirm / done phases
// ---------------------------------------------------------------------------

function ActionFooter({
  submitPhase,
  hasChanges,
  submitSummary,
  submitResult,
  submitError,
  isSubmitting,
  students,
  onSubmit,
  onConfirm,
  onBack,
  selectedActivity,
  orgId,
}) {
  if (submitPhase === 'done' && submitResult) {
    return (
      <DoneSummary
        result={submitResult}
        students={students}
        selectedActivity={selectedActivity}
        orgId={orgId}
      />
    )
  }

  if (submitPhase === 'confirm') {
    return (
      <div className="border-t border-base-300 px-3 py-2 bg-base-200/50">
        <div className="text-sm mb-2">
          {submitSummary.clean.length > 0 && (
            <div>{submitSummary.clean.length} student{submitSummary.clean.length !== 1 ? 's' : ''} to enroll</div>
          )}
          {submitSummary.conflicted.length > 0 && (
            <div className="text-warning">
              {submitSummary.conflicted.length} student{submitSummary.conflicted.length !== 1 ? 's' : ''} will be skipped (conflicts)
            </div>
          )}
          {submitSummary.unenrollIds.length > 0 && (
            <div className="text-error">
              {submitSummary.unenrollIds.length} student{submitSummary.unenrollIds.length !== 1 ? 's' : ''} to unenroll
            </div>
          )}
        </div>

        {submitError && (
          <div className="text-error text-xs mb-2">{submitError.message}</div>
        )}

        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm flex-1" onClick={onBack} disabled={isSubmitting}>
            Back
          </button>
          <button className="btn btn-primary btn-sm flex-1" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? <span className="loading loading-spinner loading-xs" /> : 'Confirm'}
          </button>
        </div>
      </div>
    )
  }

  // Ready state
  return (
    <div className="border-t border-base-300 px-3 py-2">
      {hasChanges ? (
        <div className="flex items-center justify-between">
          <div className="text-sm text-base-content/60">
            {submitSummary.clean.length + submitSummary.conflicted.length > 0 && (
              <span>{submitSummary.clean.length + submitSummary.conflicted.length} to enroll</span>
            )}
            {submitSummary.unenrollIds.length > 0 && (
              <span>
                {submitSummary.clean.length + submitSummary.conflicted.length > 0 && ', '}
                {submitSummary.unenrollIds.length} to unenroll
              </span>
            )}
          </div>
          <button className="btn btn-primary btn-sm" onClick={onSubmit}>
            {submitSummary.unenrollIds.length > 0 && submitSummary.clean.length + submitSummary.conflicted.length > 0
              ? 'Save Changes'
              : submitSummary.unenrollIds.length > 0
                ? 'Unenroll'
                : 'Enroll'
            }
          </button>
        </div>
      ) : (
        <div className="text-sm text-base-content/40 text-center py-1">
          Click students to stage enrollment changes
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DoneSummary — post-submit results with optional create-activity action
// ---------------------------------------------------------------------------

function DoneSummary({ result, students, selectedActivity, orgId }) {
  return (
    <div className="border-t border-base-300 px-3 py-2 bg-base-200/50">
      <div className="text-sm space-y-0.5">
        {result.enrolled > 0 && (
          <div className="text-success">
            {result.enrolled} enrolled
          </div>
        )}
        {result.skipped > 0 && (
          <div className="text-warning">
            {result.skipped} skipped (conflicts)
          </div>
        )}
        {result.unenrolled > 0 && (
          <div className="text-error">
            {result.unenrolled} unenrolled
          </div>
        )}
      </div>

      {/* Phase 5 will add "Create activity with these students" action here */}
      {result.skipped > 0 && (
        <CreateConflictActivity
          skippedStudents={result.skippedStudents}
          selectedActivity={selectedActivity}
          students={students}
          orgId={orgId}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CreateConflictActivity — post-conflict convenience action
// Creates an unplaced bucket activity and enrolls skipped students into it
// ---------------------------------------------------------------------------

function CreateConflictActivity({ skippedStudents, selectedActivity, orgId }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'creating' | 'done'
  const [createdName, setCreatedName] = useState(null)

  const createActivity = useCreateActivity(orgId)
  const enrollStudents = useBulkEnrollStudents()

  async function handleCreate() {
    if (!selectedActivity || !skippedStudents?.length) return
    setStatus('creating')

    try {
      const newName = `${selectedActivity.name} - Enrollment Conflict`

      // 1. Create unplaced activity
      const newActivity = await createActivity.mutateAsync({
        name: newName,
        type: selectedActivity.type || 'class',
      })

      // 2. Enroll the skipped students
      const enrollments = skippedStudents.map(({ studentId }) => ({
        student_id: studentId,
        activity_id: newActivity.id,
        block: null, // unplaced
      }))

      await enrollStudents.mutateAsync(enrollments)

      setCreatedName(newName)
      setStatus('done')
    } catch {
      // Reset so admin can retry
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <div className="mt-2 text-xs text-success">
        "{createdName}" created with {skippedStudents.length} student{skippedStudents.length !== 1 ? 's' : ''}
      </div>
    )
  }

  return (
    <button
      className="mt-2 text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
      onClick={handleCreate}
      disabled={status === 'creating'}
    >
      {status === 'creating'
        ? 'Creating activity...'
        : `Create activity with ${skippedStudents.length} skipped student${skippedStudents.length !== 1 ? 's' : ''}`
      }
    </button>
  )
}
