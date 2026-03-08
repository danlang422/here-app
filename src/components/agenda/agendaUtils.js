// Agenda grid layout constants
export const PX_PER_HOUR = 80
export const TIME_COL_WIDTH = 48
export const DAY_COL_MIN_WIDTH = 140

// Density thresholds
export const DENSITY_FEW_MAX = 3   // 2–3 = "few"
export const DENSITY_AGG_MIN = 4   // 4+ = aggregate

// --- Time helpers ---

export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

export function minutesToPx(minutes) {
  return (minutes / 60) * PX_PER_HOUR
}

export function activityTop(activity, gridStartMinutes) {
  const startMin = timeToMinutes(activity.default_start_time)
  return minutesToPx(startMin - gridStartMinutes)
}

export function activityHeight(activity) {
  const startMin = timeToMinutes(activity.default_start_time)
  const endMin = timeToMinutes(activity.default_end_time)
  return minutesToPx(endMin - startMin)
}

// --- Grid bounds helpers ---

export function floorToHour(timeStr) {
  const [h] = timeStr.split(':').map(Number)
  return `${String(h).padStart(2, '0')}:00`
}

export function ceilToHour(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const ceiled = m > 0 ? h + 1 : h
  return `${String(ceiled).padStart(2, '0')}:00`
}

// --- Grouping & filtering ---

export function activityMeetsDay(activity, dayValue) {
  if (activity.days_of_week != null) {
    return activity.days_of_week.includes(dayValue)
  }
  // No days_of_week set: show on all weekdays
  return true
}

export function groupActivitiesByBlock(activities, dayValue) {
  const map = new Map()
  for (const a of activities) {
    if (!activityMeetsDay(a, dayValue)) continue
    const key = a.block ?? 'null'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(a)
  }
  return map
}
