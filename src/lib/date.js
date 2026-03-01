// Date utilities for the Here app.
// Uses native Date/Intl APIs — no date library dependency for now.

// Format a Date object as 'YYYY-MM-DD' (the format Supabase/Postgres expects)
export function toDateString(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Parse a 'YYYY-MM-DD' string into a local Date (avoids timezone shift from new Date('YYYY-MM-DD'))
export function parseDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Get today's date as a 'YYYY-MM-DD' string in a given timezone
export function getTodayInTimezone(timezone = 'America/Chicago') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
}

// Get the day-of-week number matching EXTRACT(DOW): 0=Sun, 1=Mon, ..., 6=Sat
export function getDayOfWeek(date) {
  return new Date(date).getDay()
}

// Format a TIME string ('HH:MM' or 'HH:MM:SS') for display
export function formatTime(timeString) {
  if (!timeString) return ''
  const [hours, minutes] = timeString.split(':')
  const d = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes))
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Format a Date or TIMESTAMPTZ string for display
export function formatDateTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Format a date for display (e.g., "Mon, Mar 1")
export function formatDateDisplay(date) {
  return new Date(date).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Format a date for display with year (e.g., "March 1, 2026")
export function formatDateLong(date) {
  return new Date(date).toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Check if two date strings represent the same calendar date
export function isSameDate(a, b) {
  return toDateString(a) === toDateString(b)
}

// Add days to a date, returns a new Date
export function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Get all dates between start and end (inclusive), returns array of 'YYYY-MM-DD' strings
export function getDateRange(startDate, endDate) {
  const dates = []
  let current = parseDate(startDate)
  const end = parseDate(endDate)

  while (current <= end) {
    dates.push(toDateString(current))
    current = addDays(current, 1)
  }

  return dates
}

// Check if a date falls on a weekday (Mon-Fri)
export function isWeekday(date) {
  const day = getDayOfWeek(date)
  return day >= 1 && day <= 5
}
