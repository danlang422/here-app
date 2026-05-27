// Schedule utility functions — pure, reusable by student and teacher agenda hooks.

// --- Date helpers (lightweight, no external library) ---

export function formatDateISO(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function subDays(date, days) {
  return addDays(date, -days)
}

export function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Mon = day 1
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isSameDay(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

// Extract day-of-week matching EXTRACT(DOW): 0=Sun, 1=Mon, ..., 6=Sat
export function extractDOW(date) {
  return new Date(date).getDay()
}

// --- Core scheduling predicate ---
// See docs/business-logic/01-schedule-and-calendar.md for the full algorithm.

export function activityMeetsToday(activity, date, schoolDay) {
  // Inactive activities never meet
  if (!activity.is_active) return false

  // Not-scheduled activities don't appear on the daily schedule
  if (activity.is_not_scheduled) return false

  const dateStr = formatDateISO(date)

  // Check date range (if set)
  if (activity.start_date && dateStr < activity.start_date) return false
  if (activity.end_date && dateStr > activity.end_date) return false

  // Must be a school day
  if (!schoolDay || !schoolDay.is_school_day) return false

  // Check rotation day constraint
  if (activity.rotation_day_type != null) {
    if (schoolDay.rotation_day !== activity.rotation_day_type) return false
  }

  // Check day of week (INTEGER[] using EXTRACT(DOW) values: 0=Sun..6=Sat)
  if (activity.days_of_week != null) {
    const dayNumber = extractDOW(date)
    if (!activity.days_of_week.includes(dayNumber)) return false
  }

  // Recurrence interval (every-other-week, every-third-week, etc.)
  if (activity.recurrence_interval > 1 && activity.recurrence_anchor_date) {
    // Compute how many whole weeks have passed since the anchor date
    const anchor = new Date(activity.recurrence_anchor_date + 'T00:00:00')
    const target = new Date(formatDateISO(date) + 'T00:00:00')
    const msPerDay = 24 * 60 * 60 * 1000
    const daysDiff = Math.round((target - anchor) / msPerDay)
    const weeksSinceAnchor = Math.floor(daysDiff / 7)

    // Dates before the anchor are always off-weeks
    if (weeksSinceAnchor < 0) return false

    // Only return true for weeks that are multiples of the interval
    if (weeksSinceAnchor % activity.recurrence_interval !== 0) return false
  }

  return true
}

// --- Enrollment-level scheduling ---

/**
 * Merges enrollment-level scheduling constraints with the parent activity's schedule.
 * Null enrollment fields fall through to the activity value.
 * Returns the effective schedule shape used by enrollmentMeetsToday and conflict detection.
 *
 * @param {{ days_of_week?, rotation_day_type?, recurrence_interval?, recurrence_anchor_date? }} enrollment
 * @param {object} activity
 * @returns {{ days_of_week, rotation_day_type, recurrence_interval, recurrence_anchor_date, block }}
 */
export function getEffectiveSchedule(enrollment, activity) {
  return {
    days_of_week:           enrollment.days_of_week          ?? activity.days_of_week,
    rotation_day_type:      enrollment.rotation_day_type     ?? activity.rotation_day_type,
    recurrence_interval:    enrollment.recurrence_interval   ?? activity.recurrence_interval ?? 1,
    recurrence_anchor_date: enrollment.recurrence_anchor_date ?? activity.recurrence_anchor_date,
    block:                  activity.block,
  }
}

/**
 * Per-student scheduling gate. Runs after activityMeetsToday — if the activity
 * itself doesn't meet today, no enrollment in it can meet either.
 * Null enrollment fields mean "follow the activity" and pass through transparently.
 *
 * @param {{ days_of_week?, rotation_day_type?, recurrence_interval?, recurrence_anchor_date? }} enrollment
 * @param {object} activity
 * @param {Date} date
 * @param {object} schoolDay
 * @returns {boolean}
 */
export function enrollmentMeetsToday(enrollment, activity, date, schoolDay) {
  // Gate: activity itself must meet today
  if (!activityMeetsToday(activity, date, schoolDay)) return false

  // Enrollment-level rotation narrowing
  if (enrollment.rotation_day_type != null) {
    if (schoolDay.rotation_day !== enrollment.rotation_day_type) return false
  }

  // Enrollment-level day-of-week narrowing
  if (enrollment.days_of_week != null) {
    const dayNumber = extractDOW(date)
    if (!enrollment.days_of_week.includes(dayNumber)) return false
  }

  // Enrollment-level recurrence narrowing
  if (
    enrollment.recurrence_interval != null &&
    enrollment.recurrence_interval > 1 &&
    enrollment.recurrence_anchor_date != null
  ) {
    const anchor = new Date(enrollment.recurrence_anchor_date + 'T00:00:00')
    const target = new Date(formatDateISO(date) + 'T00:00:00')
    const msPerDay = 24 * 60 * 60 * 1000
    const daysDiff = Math.round((target - anchor) / msPerDay)
    const weeksSinceAnchor = Math.floor(daysDiff / 7)

    if (weeksSinceAnchor < 0) return false
    if (weeksSinceAnchor % enrollment.recurrence_interval !== 0) return false
  }

  return true
}
