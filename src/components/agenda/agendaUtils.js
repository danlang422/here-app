// Agenda grid layout constants
export const PX_PER_HOUR = 100
export const TIME_COL_WIDTH = 48
export const DAY_COL_MIN_WIDTH = 140

// Vertical padding so first/last hour labels aren't clipped
export const GRID_PAD_Y = 12

// Default school-day bounds (grid always shows at least this range)
export const DEFAULT_GRID_START = '07:00'
export const DEFAULT_GRID_END = '16:00'

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

// --- Time formatting ---

export function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return null
  return `${formatTime(startTime)} – ${formatTime(endTime)}`
}

export function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'p' : 'a'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

// --- Grouping & filtering ---

export function activityMeetsDay(activity, dayValue) {
  if (activity.days_of_week != null) {
    return activity.days_of_week.includes(dayValue)
  }
  // No days_of_week set: show on all weekdays
  return true
}

export function groupActivitiesForLayout(activities, dayValue) {
  const map = new Map()
  const nullGroup = []

  for (const a of activities) {
    if (!activityMeetsDay(a, dayValue)) continue
    if (a.block != null) {
      const key = a.block
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(a)
    } else {
      nullGroup.push(a)
    }
  }

  // Cluster null-block activities by time overlap (gap tolerance: 15 minutes)
  if (nullGroup.length > 0) {
    const sorted = [...nullGroup].sort((a, b) =>
      (a.default_start_time ?? '').localeCompare(b.default_start_time ?? '')
    )

    const GAP_TOLERANCE_MINUTES = 15
    let clusterIndex = 0
    let clusterEnd = sorted[0].default_end_time ?? sorted[0].default_start_time ?? ''
    let currentCluster = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const activity = sorted[i]
      const actStart = activity.default_start_time ?? ''
      const clusterEndMin = timeToMinutes(clusterEnd)
      const actStartMin = timeToMinutes(actStart)

      if (
        clusterEndMin !== null &&
        actStartMin !== null &&
        actStartMin < clusterEndMin + GAP_TOLERANCE_MINUTES &&
        actStartMin !== clusterEndMin
      ) {
        currentCluster.push(activity)
        const actEnd = activity.default_end_time ?? ''
        if (actEnd > clusterEnd) clusterEnd = actEnd
      } else {
        map.set(`time-${clusterIndex}`, currentCluster)
        clusterIndex++
        currentCluster = [activity]
        clusterEnd = activity.default_end_time ?? activity.default_start_time ?? ''
      }
    }
    map.set(`time-${clusterIndex}`, currentCluster)
  }

  return map
}
