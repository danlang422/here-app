// Agenda grid layout constants
export const PX_PER_HOUR = 200
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

// Card column padding — matches current left-2 / right-5 Tailwind values
export const CARD_PAD_LEFT = 8    // px
export const CARD_PAD_RIGHT = 20  // px — preserves space for StudentActivityCard edge buttons
export const CARD_OVERLAP_GAP = 4 // px — gap between concurrent columns

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

// --- Overlap layout ---

// Returns an array of { activity, columnIndex, nColumns } descriptors, one per activity.
// nColumns === 1 means the activity is in a solo group and renders at full width.
export function computeOverlapLayout(activities) {
  if (activities.length === 0) return []

  const n = activities.length

  // Build adjacency: two activities overlap if a.start < b.end AND b.start < a.end
  const adj = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = activities[i], b = activities[j]
      if (!a.default_start_time || !a.default_end_time || !b.default_start_time || !b.default_end_time) continue
      const aStart = timeToMinutes(a.default_start_time)
      const aEnd   = timeToMinutes(a.default_end_time)
      const bStart = timeToMinutes(b.default_start_time)
      const bEnd   = timeToMinutes(b.default_end_time)
      if (aStart < bEnd && bStart < aEnd) {
        adj[i].push(j)
        adj[j].push(i)
      }
    }
  }

  // Find connected components (concurrency groups) via BFS
  const visited = new Array(n).fill(false)
  const groups = []
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    const group = []
    const queue = [i]
    visited[i] = true
    while (queue.length > 0) {
      const curr = queue.shift()
      group.push(curr)
      for (const nb of adj[curr]) {
        if (!visited[nb]) {
          visited[nb] = true
          queue.push(nb)
        }
      }
    }
    groups.push(group)
  }

  // Greedy interval coloring within each group
  const colIdx = new Array(n).fill(0)
  const nCols  = new Array(n).fill(1)

  for (const group of groups) {
    if (group.length === 1) continue

    const sorted = [...group].sort((ai, bi) => {
      const a = activities[ai], b = activities[bi]
      if (a.default_start_time !== b.default_start_time)
        return a.default_start_time.localeCompare(b.default_start_time)
      if (a.default_end_time !== b.default_end_time)
        return a.default_end_time.localeCompare(b.default_end_time)
      return String(a.id).localeCompare(String(b.id))
    })

    const colEnds = []
    for (const idx of sorted) {
      const start = activities[idx].default_start_time
      let assigned = colEnds.findIndex((end) => end <= start)
      if (assigned === -1) {
        assigned = colEnds.length
        colEnds.push(activities[idx].default_end_time)
      } else {
        colEnds[assigned] = activities[idx].default_end_time
      }
      colIdx[idx] = assigned
    }

    for (const idx of group) nCols[idx] = colEnds.length
  }

  return activities.map((activity, i) => ({
    activity,
    columnIndex: colIdx[i],
    nColumns: nCols[i],
  }))
}

export function groupActivitiesForLayout(activities, dayValue) {
  const map = new Map()
  const nullGroup = []

  for (const a of activities) {
    if (!activityMeetsDay(a, dayValue)) continue
    if (a.block?.length > 0) {
      const key = a.block[0]
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
