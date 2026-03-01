// Rotation day calculation logic.
// Implements the algorithm from docs/business-logic/01-schedule-and-calendar.md

/**
 * Calculate the rotation day for a given date based on org settings and school days.
 *
 * @param {Object} orgSettings - organization.settings JSON
 * @param {Object[]} schoolDaysInRange - school_days records from term start through target date
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
  const mode = orgSettings.rotation_mode || 'continue'

  let countableDays
  if (mode === 'continue') {
    // Skip non-school days — rotation advances only on days school is in session
    countableDays = schoolDaysInRange.filter(d => d.is_school_day)
  } else {
    // "repeat" mode — cancelled days repeat, rotation doesn't advance
    countableDays = schoolDaysInRange
  }

  const index = countableDays.length % rotationNames.length
  return rotationNames[index]
}
