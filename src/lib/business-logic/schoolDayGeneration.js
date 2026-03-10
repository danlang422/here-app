// School day generation logic.
// Generates school_days rows for weekdays within a term date range,
// calculating rotation labels using the per-reason algorithm.

import { isUnscheduledCancellation } from './rotation'

/**
 * Get all weekday dates (Mon-Fri) in a date range, inclusive.
 * Returns ISO date strings (YYYY-MM-DD).
 */
export function getWeekdaysInRange(startDate, endDate) {
  const dates = []
  const current = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  while (current <= end) {
    const dow = current.getDay()
    if (dow >= 1 && dow <= 5) {
      dates.push(current.toISOString().slice(0, 10))
    }
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Generate school_days rows for a term date range.
 * Skips dates that already have existing rows. Calculates rotation labels
 * using the per-reason algorithm (planned holidays pause, weather/emergency advance).
 *
 * @param {string} orgId - organization ID
 * @param {string} startDate - term start date (YYYY-MM-DD)
 * @param {string} endDate - term end date (YYYY-MM-DD)
 * @param {Object} orgSettings - organization.settings JSON
 * @param {Object[]} existingSchoolDays - existing school_days in this range (sorted by date)
 * @returns {Object[]} - new school_days rows to upsert
 */
export function generateSchoolDays(orgId, startDate, endDate, orgSettings, existingSchoolDays = []) {
  const weekdays = getWeekdaysInRange(startDate, endDate)
  const existingByDate = new Map(existingSchoolDays.map(d => [d.date, d]))
  const rotationNames = orgSettings?.rotation_day_names || ['A', 'B']
  const usesRotation = orgSettings?.uses_rotation_schedule ?? false

  const newDays = []
  let rotationIndex = 0

  for (const date of weekdays) {
    if (existingByDate.has(date)) {
      // Day already exists — count it for rotation but don't overwrite
      const existing = existingByDate.get(date)
      if (existing.is_school_day || isUnscheduledCancellation(existing)) {
        rotationIndex++
      }
      continue
    }

    const rotationDay = usesRotation
      ? rotationNames[rotationIndex % rotationNames.length]
      : null

    newDays.push({
      organization_id: orgId,
      date,
      is_school_day: true,
      rotation_day: rotationDay,
    })

    rotationIndex++
  }

  return newDays
}
