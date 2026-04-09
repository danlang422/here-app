// =============================================================
// DEV DATE/TIME OVERRIDE
// Flip DEV_OVERRIDE_ENABLED to true and set DEV_DATE/DEV_TIME
// to simulate a specific date and time across the app.
// Set both back to false/null before deploying to production.
// =============================================================

const DEV_OVERRIDE_ENABLED = false

// Date to simulate (YYYY-MM-DD format). Only used when DEV_OVERRIDE_ENABLED = true.
const DEV_DATE = '2026-04-08'

// Time to simulate (HH:MM 24h format). Only used when DEV_OVERRIDE_ENABLED = true.
// Set to null to use the real current time on the fake date.
const DEV_TIME = '09:30'

// =============================================================

/**
 * Returns a Date object representing "right now" — either the real
 * current moment or the dev override, depending on the toggle.
 *
 * Use this anywhere you'd normally write `new Date()` to mean
 * "the current date and time."
 */
export function getDevNow() {
  if (!DEV_OVERRIDE_ENABLED) return new Date()

  const [year, month, day] = DEV_DATE.split('-').map(Number)

  if (DEV_TIME) {
    const [hours, minutes] = DEV_TIME.split(':').map(Number)
    return new Date(year, month - 1, day, hours, minutes, 0, 0)
  }

  // Use real time on the fake date
  const now = new Date()
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds())
}

/**
 * Returns a Date object representing "today" — midnight of the
 * overridden date, or real today. Use for initializing date state
 * (e.g. `useState(getDevToday())`).
 */
export function getDevToday() {
  if (!DEV_OVERRIDE_ENABLED) return new Date()

  const [year, month, day] = DEV_DATE.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Whether the dev override is currently active.
 * Used for conditional UI (e.g. showing a banner).
 */
export function isDevOverrideActive() {
  return DEV_OVERRIDE_ENABLED
}
