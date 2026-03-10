// Rotation day calculation logic.
// Per-reason advancement: planned holidays pause the rotation,
// unscheduled cancellations (weather/emergency) advance it.

/**
 * Calculate the rotation day for a given date based on org settings and school days.
 *
 * @param {Object} orgSettings - organization.settings JSON
 * @param {Object[]} schoolDaysInRange - school_days records from term start through (but not including) target date
 * @param {Object} targetSchoolDay - the school_days record for the target date (may have explicit override)
 * @returns {string|null} - rotation day name (e.g., 'A', 'B') or null if org doesn't use rotation
 */
export function calculateRotationDay(orgSettings, schoolDaysInRange, targetSchoolDay) {
  if (!orgSettings?.uses_rotation_schedule) return null

  // Check for an explicit override on the target date
  if (targetSchoolDay?.rotation_day != null) {
    return targetSchoolDay.rotation_day
  }

  const rotationNames = orgSettings.rotation_day_names || ['A', 'B']

  // Count days that advance the rotation:
  // - School days (is_school_day = true) always count
  // - Unscheduled cancellations (weather/emergency) also count (rotation advances)
  // - Planned holidays do NOT count (rotation pauses)
  const countableDays = schoolDaysInRange.filter(d =>
    d.is_school_day ||
    d.override_reason === 'weather' ||
    d.override_reason === 'emergency'
  )

  const index = countableDays.length % rotationNames.length
  return rotationNames[index]
}

/**
 * Check if a school day is an unscheduled cancellation (weather or emergency).
 */
export function isUnscheduledCancellation(schoolDay) {
  return !schoolDay.is_school_day &&
    (schoolDay.override_reason === 'weather' || schoolDay.override_reason === 'emergency')
}

/**
 * Recalculate rotation days for all school days in a range.
 * Returns only the days whose rotation_day changed (for efficient batch update).
 *
 * @param {Object[]} schoolDays - all school_days in the term, sorted by date
 * @param {Object} orgSettings - organization.settings JSON
 * @returns {Object[]} - school_days records that need updating (rotation_day changed)
 */
export function recalculateRotationDays(schoolDays, orgSettings) {
  if (!orgSettings?.uses_rotation_schedule) return []

  const rotationNames = orgSettings.rotation_day_names || ['A', 'B']
  const changed = []
  let rotationIndex = 0

  for (const day of schoolDays) {
    if (!day.is_school_day && day.override_reason === 'planned_holiday') {
      // Planned holidays don't advance — rotation_day should be null
      if (day.rotation_day !== null) {
        changed.push({ ...day, rotation_day: null })
      }
      continue
    }

    // School days and unscheduled cancellations get a rotation label
    const expected = rotationNames[rotationIndex % rotationNames.length]
    if (day.rotation_day !== expected) {
      changed.push({ ...day, rotation_day: expected })
    }
    rotationIndex++
  }

  return changed
}
