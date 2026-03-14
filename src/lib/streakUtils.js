import { formatDateISO, subDays } from '@/lib/scheduleUtils'

/**
 * Calculate the current wave streak for an activity.
 * Walks backward from asOfDate, skipping non-school days and days the
 * activity doesn't meet (by day-of-week). Streak breaks on the first
 * school day where the activity meets but no wave exists.
 */
export function calculateStreak(activity, waveDates, schoolDaySet, asOfDate) {
  let streak = 0
  let checkDate = new Date(asOfDate)

  for (let i = 0; i < 365; i++) {
    const dateStr = formatDateISO(checkDate)

    if (!schoolDaySet.has(dateStr)) {
      // Non-school day — skip without breaking
      checkDate = subDays(checkDate, 1)
      continue
    }

    // Check if activity meets on this day (day-of-week check)
    if (activity.days_of_week != null) {
      const dow = checkDate.getDay()
      if (!activity.days_of_week.includes(dow)) {
        checkDate = subDays(checkDate, 1)
        continue
      }
    }

    // School day, activity meets — did the student wave?
    if (!waveDates.has(dateStr)) {
      break // Streak broken
    }

    streak += 1
    checkDate = subDays(checkDate, 1)
  }

  return streak
}
