// Scheduling logic — "does this activity meet today?" and related queries.
// Implements the algorithms from docs/business-logic/01-schedule-and-calendar.md

import { getDayOfWeek } from '@/lib/date'

/**
 * Determine whether an activity occurs on a given date.
 *
 * @param {Object} activity - The activity record
 * @param {string} date - 'YYYY-MM-DD' date string
 * @param {Object} schoolDay - The school_days record for this date (or null)
 * @returns {boolean}
 */
export function activityMeetsToday(activity, date, schoolDay) {
  // Inactive activities never meet
  if (!activity.is_active) return false

  // Unscheduled activities don't appear on the daily schedule
  if (activity.is_not_scheduled) return false

  // Check date range
  if (activity.start_date && date < activity.start_date) return false
  if (activity.end_date && date > activity.end_date) return false

  // Must be a school day
  if (!schoolDay || !schoolDay.is_school_day) return false

  // Check rotation day constraint
  if (activity.rotation_day_type != null) {
    if (schoolDay.rotation_day !== activity.rotation_day_type) return false
  }

  // Check day of week
  if (activity.days_of_week != null) {
    const dayNumber = getDayOfWeek(date)
    if (!activity.days_of_week.includes(dayNumber)) return false
  }

  return true
}

/**
 * Resolve an activity's effective start/end times for a specific date.
 *
 * Block-linked activities shift with the schedule template.
 * Fixed-time activities (external courses) always use their own times.
 *
 * @param {Object} activity - The activity record
 * @param {Object} scheduleTemplate - The schedule_templates record for this date
 * @returns {{ start: string, end: string } | null}
 */
export function getActivityEffectiveTimes(activity, scheduleTemplate) {
  if (activity.is_not_scheduled) return null

  // Block-linked: resolve from today's schedule template
  if (activity.block != null && scheduleTemplate?.block_definitions) {
    const blockDef = scheduleTemplate.block_definitions.find(
      b => b.block === activity.block
    )
    if (blockDef) {
      return { start: blockDef.start_time, end: blockDef.end_time }
    }
    // Block not in today's template (e.g., early dismissal drops late blocks)
    // Fall through to fixed times
  }

  // Fixed-time: use the activity's own times
  if (activity.default_start_time && activity.default_end_time) {
    return { start: activity.default_start_time, end: activity.default_end_time }
  }

  return null
}

/**
 * Check whether two activities would conflict if a student were enrolled in both.
 * Used for enrollment validation.
 *
 * See docs/business-logic/05-conflict-resolution.md for the full algorithm.
 *
 * @param {Object} activityA
 * @param {Object} activityB
 * @returns {boolean} true if they conflict
 */
export function wouldConflict(activityA, activityB) {
  // Must be the same block
  if (activityA.block == null || activityB.block == null) return false
  if (activityA.block !== activityB.block) return false

  const aHasDays = activityA.days_of_week != null
  const bHasDays = activityB.days_of_week != null
  const aHasRotation = activityA.rotation_day_type != null
  const bHasRotation = activityB.rotation_day_type != null

  // Case 1: Both use days_of_week — conflict if any shared day
  if (aHasDays && bHasDays) {
    const setB = new Set(activityB.days_of_week)
    return activityA.days_of_week.some(d => setB.has(d))
  }

  // Case 2: Both use rotation_day_type — conflict if same rotation day
  if (aHasRotation && bHasRotation) {
    return activityA.rotation_day_type === activityB.rotation_day_type
  }

  // Case 3: Mixed modes — always conflicts
  // A days-of-week activity meets on both rotation days
  if ((aHasDays && bHasRotation) || (aHasRotation && bHasDays)) {
    return true
  }

  // Case 4: Neither has scheduling info — treat as conflict
  return true
}
