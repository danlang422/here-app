import { getViewerRole } from '@/lib/staffRoles'

// Agenda grid layout constants
export const PX_PER_HOUR = 200
export const TIME_COL_WIDTH = 48
export const DAY_COL_MIN_WIDTH = 140

// Vertical padding so first/last hour labels aren't clipped
export const GRID_PAD_Y = 12

// Default school-day bounds (grid always shows at least this range)
export const DEFAULT_GRID_START = '07:00'
export const DEFAULT_GRID_END = '16:00'

// Density thresholds (used by CalendarDayColumn)
export const DENSITY_FEW_MAX = 3
export const DENSITY_AGG_MIN = 4

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

// --- Teacher clustering ---

// Transforms a flat list of teacher activities into renderable units for SingleDayAgenda.
// Each unit is either a solo card or a cluster card.
// Activities sharing (start_time, end_time, role) collapse into a cluster.
// enrollmentCounts: Map<activityId, number> — from useTeacherAgenda
// lateArrivals: Map<activityId, { count, earliestTime }> — from useTeacherAgenda
export function buildTeacherRenderables(activities, enrollmentCounts, viewerId, lateArrivals) {
  if (!activities?.length) return []

  // Step 1: derive role per activity, apply prep detection
  const withRoles = []
  for (const activity of activities) {
    const rawRole = getViewerRole(activity, viewerId)
    if (!rawRole) continue
    const count = enrollmentCounts?.get(activity.id) ?? 0
    const role = rawRole === 'teacher' && count === 0 ? 'prep' : rawRole
    withRoles.push({ activity, role, enrollmentCount: count })
  }

  // Step 2: group by (start_time, end_time, role)
  const groups = new Map()
  for (const item of withRoles) {
    const key = `${item.activity.default_start_time}|${item.activity.default_end_time}|${item.role}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }

  // Step 3: emit renderable units
  const renderables = []
  for (const groupItems of groups.values()) {
    if (groupItems.length === 1) {
      const { activity, role, enrollmentCount } = groupItems[0]
      const late = lateArrivals?.get(activity.id)
      renderables.push({
        id: activity.id,
        default_start_time: activity.default_start_time,
        default_end_time: activity.default_end_time,
        role,
        isCluster: false,
        activity,
        enrollmentCount,
        lateCount: late?.count ?? 0,
        earliestArrival: late?.earliestTime ?? null,
      })
    } else {
      const { role } = groupItems[0]
      const clusterActivities = groupItems.map((g) => g.activity)
      const totalEnrollment = groupItems.reduce((sum, g) => sum + g.enrollmentCount, 0)
      const start = groupItems[0].activity.default_start_time
      const end = groupItems[0].activity.default_end_time
      const sortedIds = [...clusterActivities.map((a) => a.id)].sort()
      let totalLate = 0
      let clusterEarliest = null
      for (const { activity: a } of groupItems) {
        const late = lateArrivals?.get(a.id)
        if (late) {
          totalLate += late.count
          if (!clusterEarliest || late.earliestTime < clusterEarliest) clusterEarliest = late.earliestTime
        }
      }
      renderables.push({
        id: `cluster-${start}-${end}-${role}-${sortedIds.join(',')}`,
        default_start_time: start,
        default_end_time: end,
        role,
        isCluster: true,
        activities: clusterActivities,
        totalEnrollment,
        clusterTitle: computeClusterTitle(clusterActivities),
        memberCount: clusterActivities.length,
        block: [...new Set(clusterActivities.flatMap((a) => a.block ?? []))],
        lateCount: totalLate,
        earliestArrival: clusterEarliest,
      })
    }
  }

  return renderables
}

// Derives a display title for a cluster of activities.
// Homogeneous clusters: "3 Internships", "2 Advisory", "4 Independent Studies"
// Heterogeneous clusters: "3 activities"
export function computeClusterTitle(activities) {
  const count = activities.length
  const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'at', 'in', 'for'])

  const wordArrays = activities.map((a) =>
    a.name
      .trim()
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => /[a-z]/i.test(w) && !STOPWORDS.has(w))
  )

  const minLen = Math.min(...wordArrays.map((ws) => ws.length))
  let prefixLen = 0
  for (let i = 0; i < minLen; i++) {
    if (wordArrays.every((ws) => ws[i] === wordArrays[0][i])) prefixLen = i + 1
    else break
  }

  if (prefixLen >= 1) {
    const prefixWords = wordArrays[0].slice(0, prefixLen)
    const phrase = prefixWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    return `${count} ${pluralizePhrase(phrase)}`
  }

  return `${count} activities`
}

function pluralizePhrase(phrase) {
  const words = phrase.split(' ')
  const last = words[words.length - 1]
  const rest = words.slice(0, -1)
  return [...rest, pluralizeWord(last)].join(' ')
}

function pluralizeWord(word) {
  const lw = word.toLowerCase()
  if (lw === 'advisory') return word.slice(0, -1) + 'ies'
  if (lw.endsWith('y') && !/[aeiou]y$/.test(lw)) return word.slice(0, -1) + 'ies'
  if (/[sxz]$/.test(lw) || /[cs]h$/.test(lw)) return word + 'es'
  return word + 's'
}

// --- Calendar layout (used by CalendarDayColumn) ---

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
