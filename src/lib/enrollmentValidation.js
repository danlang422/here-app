// Enrollment validation and scheduling conflict detection
//
// Two modes of conflict checking:
//   - Block-based (wouldConflictByBlock): enrollment gatekeeper. Prevents a student
//     from being double-booked within a block. Hard gate on enrollment.
//   - Time-based (wouldConflictByTime): scheduling visibility. Shows whether two
//     activities overlap in actual time. Informational, never blocks enrollment.
//
// All functions are pure — they take activity/enrollment objects, not IDs.
// The calling code is responsible for loading data and passing it in.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether two arrays of day-of-week values share any common day.
 * Days use EXTRACT(DOW) convention: 0=Sun, 1=Mon, ..., 6=Sat.
 */
function daysOverlap(daysA, daysB) {
  if (!daysA || !daysB) return false
  const setB = new Set(daysB)
  return daysA.some((d) => setB.has(d))
}

/**
 * Parse a time string ("HH:MM" or "HH:MM:SS") into total minutes since midnight.
 * Returns null if the input is falsy or unparseable.
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null
  const parts = timeStr.split(':')
  if (parts.length < 2) return null
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  if (isNaN(hours) || isNaN(minutes)) return null
  return hours * 60 + minutes
}

/**
 * Calculate overlap or gap between two time ranges in minutes.
 * Returns { overlaps, overlapMinutes, gapMinutes }.
 *   - overlaps: true if the ranges share any time
 *   - overlapMinutes: how many minutes they overlap (0 if no overlap)
 *   - gapMinutes: how many minutes between them (0 if they overlap)
 */
function computeTimeOverlap(startA, endA, startB, endB) {
  const overlapStart = Math.max(startA, startB)
  const overlapEnd = Math.min(endA, endB)

  if (overlapStart < overlapEnd) {
    return {
      overlaps: true,
      overlapMinutes: overlapEnd - overlapStart,
      gapMinutes: 0,
    }
  }

  // No overlap — calculate the gap
  const gap = overlapStart - overlapEnd
  return {
    overlaps: false,
    overlapMinutes: 0,
    gapMinutes: gap,
  }
}

/**
 * Determine whether two activities could meet on any shared day,
 * considering days_of_week and rotation_day_type.
 *
 * NOTE: Does not account for recurrence_interval — two activities with different anchor
 * weeks will still be flagged as conflicting if they share a block and day-of-week.
 * This is intentionally conservative (false positives are safe). Layer 2 will refine this.
 *
 * Returns { couldMeetSameDay, reason }
 *   - couldMeetSameDay: true if there's any day both activities would meet
 *   - reason: human-readable explanation of why/why not
 */
function couldMeetOnSameDay(activityA, activityB) {
  const aHasDays = activityA.days_of_week != null && activityA.days_of_week.length > 0
  const bHasDays = activityB.days_of_week != null && activityB.days_of_week.length > 0
  const aHasRotation = activityA.rotation_day_type != null
  const bHasRotation = activityB.rotation_day_type != null

  // Case 1: Both use days_of_week — conflict if any shared day
  if (aHasDays && bHasDays) {
    const shared = daysOverlap(activityA.days_of_week, activityB.days_of_week)
    return {
      couldMeetSameDay: shared,
      reason: shared
        ? 'Both activities meet on overlapping weekdays'
        : 'Activities meet on different weekdays',
    }
  }

  // Case 2: Both use rotation_day_type — conflict only if same rotation day
  if (aHasRotation && bHasRotation) {
    const same = activityA.rotation_day_type === activityB.rotation_day_type
    return {
      couldMeetSameDay: same,
      reason: same
        ? `Both activities meet on ${activityA.rotation_day_type} days`
        : `Activities meet on different rotation days (${activityA.rotation_day_type} vs ${activityB.rotation_day_type})`,
    }
  }

  // Case 3: One uses days_of_week, the other uses rotation_day_type
  // A days-of-week activity meets on both rotation days, so it will always
  // collide with a rotation-day activity on that rotation day's occurrences.
  if ((aHasDays && bHasRotation) || (aHasRotation && bHasDays)) {
    return {
      couldMeetSameDay: true,
      reason:
        'One activity uses fixed weekdays and the other uses rotation days — ' +
        'the fixed-day activity meets on both rotation days, causing overlap',
    }
  }

  // Case 4: Neither has scheduling info — treat as conflict (data entry incomplete)
  return {
    couldMeetSameDay: true,
    reason: 'Neither activity has day/rotation scheduling info — assuming conflict',
  }
}

// ---------------------------------------------------------------------------
// Block-based conflict detection (enrollment gatekeeper)
// ---------------------------------------------------------------------------

/**
 * Check whether two activities conflict within the block system.
 * This is the enrollment gatekeeper — if this returns conflicts: true,
 * the enrollment should be rejected.
 *
 * @param {Object} activityA - Activity object with block, days_of_week, rotation_day_type
 * @param {Object} activityB - Activity object with block, days_of_week, rotation_day_type
 * @returns {{ conflicts: boolean, reason: string|null }}
 */
export function wouldConflictByBlock(activityA, activityB) {
  // Different blocks (or either is null) — no conflict possible
  if (activityA.block == null || activityB.block == null) {
    return { conflicts: false, reason: null }
  }
  if (activityA.block !== activityB.block) {
    return { conflicts: false, reason: null }
  }

  // Same block — check day/rotation overlap
  const { couldMeetSameDay, reason } = couldMeetOnSameDay(activityA, activityB)

  return {
    conflicts: couldMeetSameDay,
    reason: couldMeetSameDay
      ? `Both activities are in Block ${activityA.block}: ${reason}`
      : null,
  }
}

// ---------------------------------------------------------------------------
// Time-based conflict detection (scheduling visibility — informational)
// ---------------------------------------------------------------------------

/**
 * Check whether two activities overlap in actual time on any shared day.
 * This is informational — for scheduling visibility, not enrollment gatekeeping.
 *
 * Activities with no times (is_not_scheduled, or times not yet entered) are
 * treated as non-conflicting since there's nothing to compare.
 *
 * @param {Object} activityA - Activity object with default_start_time, default_end_time, days_of_week, rotation_day_type
 * @param {Object} activityB - Activity object with default_start_time, default_end_time, days_of_week, rotation_day_type
 * @returns {{ overlaps: boolean, overlapMinutes: number|null, gapMinutes: number|null, details: string }}
 */
export function wouldConflictByTime(activityA, activityB) {
  const noConflict = { overlaps: false, overlapMinutes: null, gapMinutes: null, details: '' }

  // If either activity has no times, we can't compare
  const startA = timeToMinutes(activityA.default_start_time)
  const endA = timeToMinutes(activityA.default_end_time)
  const startB = timeToMinutes(activityB.default_start_time)
  const endB = timeToMinutes(activityB.default_end_time)

  if (startA == null || endA == null || startB == null || endB == null) {
    return {
      ...noConflict,
      details: 'One or both activities have no scheduled times',
    }
  }

  // Check whether they could meet on the same day
  const { couldMeetSameDay, reason: dayReason } = couldMeetOnSameDay(activityA, activityB)

  if (!couldMeetSameDay) {
    return {
      ...noConflict,
      details: `No time conflict — ${dayReason}`,
    }
  }

  // They share days — check time overlap
  const { overlaps, overlapMinutes, gapMinutes } = computeTimeOverlap(
    startA,
    endA,
    startB,
    endB
  )

  if (overlaps) {
    return {
      overlaps: true,
      overlapMinutes,
      gapMinutes: 0,
      details: `Activities overlap by ${overlapMinutes} minutes on shared days`,
    }
  }

  return {
    overlaps: false,
    overlapMinutes: 0,
    gapMinutes,
    details: `Activities have a ${gapMinutes}-minute gap on shared days`,
  }
}

// ---------------------------------------------------------------------------
// Enrollment validation (public — what the enrollment flow calls)
// ---------------------------------------------------------------------------

/**
 * Validate whether a student can be enrolled in a new activity, given their
 * existing enrollments. Uses block-based conflict detection.
 *
 * Each enrollment in existingEnrollments must have its activity joined in,
 * i.e. enrollment.activity should be the full activity object.
 * (This matches the shape returned by getStudentEnrollments.)
 *
 * @param {Object} newActivity - The activity the student would be enrolled in
 * @param {Array} existingEnrollments - Student's current enrollments, each with .activity
 * @returns {{ valid: boolean, conflicts: Array<{ enrollment: Object, activity: Object, reason: string }> }}
 */
export function validateEnrollment(newActivity, existingEnrollments) {
  // Unscheduled activities (no block) can't conflict by block
  if (newActivity.block == null) {
    return { valid: true, conflicts: [] }
  }

  const conflicts = []

  for (const enrollment of existingEnrollments) {
    const existingActivity = enrollment.activity
    if (!existingActivity) continue

    // Only check active enrollments against activities in the same block
    if (existingActivity.block !== newActivity.block) continue

    const result = wouldConflictByBlock(newActivity, existingActivity)

    if (result.conflicts) {
      conflicts.push({
        enrollment,
        activity: existingActivity,
        reason: result.reason,
      })
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
  }
}

// ---------------------------------------------------------------------------
// Schedule analysis utilities
// ---------------------------------------------------------------------------

/**
 * Find which blocks are open (no enrollments) for a single student.
 *
 * @param {Array} studentEnrollments - Student's active enrollments, each with .activity
 * @param {Object} orgSettings - Organization settings with block_count
 * @returns {Array<{ block: number, label: string, isOpen: boolean, activities: Array }>}
 */
export function findAvailableBlocks(studentEnrollments, orgSettings) {
  const blockCount = orgSettings?.block_count
  if (!blockCount || blockCount < 1) return []

  // Build a map of block -> activities the student is enrolled in
  const blockMap = new Map()
  for (let i = 0; i < blockCount; i++) {
    blockMap.set(i, [])
  }

  for (const enrollment of studentEnrollments) {
    const activity = enrollment.activity
    if (!activity) continue
    if (activity.block != null && blockMap.has(activity.block)) {
      blockMap.get(activity.block).push(activity)
    }
  }

  return Array.from(blockMap.entries()).map(([block, activities]) => ({
    block,
    label: `Block ${block}`,
    isOpen: activities.length === 0,
    activities,
  }))
}

/**
 * Find all time-based conflicts between a given activity and a list of other
 * activities. Returns only pairs that actually overlap in time.
 *
 * Useful for scheduling visibility: "if I place this activity here, what
 * does it overlap with?"
 *
 * @param {Object} activity - The activity to check
 * @param {Array} otherActivities - Activities to compare against
 * @returns {Array<{ activity: Object, overlapMinutes: number, details: string }>}
 */
export function findTimeConflicts(activity, otherActivities) {
  const conflicts = []

  for (const other of otherActivities) {
    // Don't compare an activity to itself
    if (other.id === activity.id) continue

    const result = wouldConflictByTime(activity, other)

    if (result.overlaps) {
      conflicts.push({
        activity: other,
        overlapMinutes: result.overlapMinutes,
        details: result.details,
      })
    }
  }

  return conflicts
}
