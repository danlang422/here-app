# Teacher Agenda 86.2 — Dashboard Rewrite, Cluster Cards, Cluster Popover (Build Spec)

**Date:** May 20, 2026
**Status:** Implemented
**Issue:** Core of #86. Depends on #86.1.
**Design doc:** `teacher-agenda-86.2-dashboard-and-clustering-design.md`
**Depends on:** #86.1 committed.

---

## What this changes

Replaces block-based aggregation in `Dashboard.jsx` with role-aware time clustering. Activities position by their own times; concurrent same-role same-time activities collapse into a cluster card with a popover. Introduces the role badge, the cluster card visual, and the cluster popover component. Widens the teacher Dashboard layout.

**No change** to `TodayView.jsx` or `SingleDayAgenda.jsx`. The student view is unaffected.

---

## Files changed

| File | Change |
|------|--------|
| `src/components/agenda/agendaUtils.js` | Add `buildTeacherRenderables`, `computeClusterTitle`. Delete `groupActivitiesForLayout`, `DENSITY_FEW_MAX`, `DENSITY_AGG_MIN`. |
| `src/pages/teacher/Dashboard.jsx` | Replace `displayItems`/`groupByBlock` pipeline. Update `renderCard`, `handleCardClick`. Add cluster popover state. Widen layout. |
| `src/components/agenda/TeacherActivityCard.jsx` | Full redesign: role badge, solo card shape, cluster card shape. Remove `AggregateCard`. |
| `src/components/agenda/ClusterPopover.jsx` | **New file.** Floating popover with member cards, header + footer. |

`RosterModal.jsx` requires no changes in this spec — the solo-card header already shows activity name as title and time+block as subtitle.

---

## 1. `agendaUtils.js` — delete dead code first

Remove entirely:
- `DENSITY_FEW_MAX` and `DENSITY_AGG_MIN` constants (unused since block aggregation is gone)
- `groupActivitiesForLayout` function (unused; Dashboard has its own `groupByBlock` which is also being removed)

---

## 2. `agendaUtils.js` — add `buildTeacherRenderables`

Add this import at the top of the file:
```js
import { getViewerRole } from '@/lib/staffRoles'
```

Add these two new exported functions at the end of the file (after `computeOverlapLayout`):

```js
// --- Teacher clustering ---

// Transforms a flat list of teacher activities into renderable units for SingleDayAgenda.
// Each unit is either a solo card or a cluster card.
// Activities sharing (start_time, end_time, role) collapse into a cluster.
// enrollmentCounts: Map<activityId, number> — from useTeacherAgenda
export function buildTeacherRenderables(activities, enrollmentCounts, viewerId) {
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
      renderables.push({
        id: activity.id,
        default_start_time: activity.default_start_time,
        default_end_time: activity.default_end_time,
        role,
        isCluster: false,
        activity,
        enrollmentCount,
      })
    } else {
      const { role } = groupItems[0]
      const clusterActivities = groupItems.map((g) => g.activity)
      const totalEnrollment = groupItems.reduce((sum, g) => sum + g.enrollmentCount, 0)
      const start = groupItems[0].activity.default_start_time
      const end = groupItems[0].activity.default_end_time
      // Stable id: sorted activity ids joined
      const sortedIds = [...clusterActivities.map((a) => a.id)].sort()
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

  // Build per-activity word arrays: lowercase, alphabetic tokens only, stopwords stripped
  const wordArrays = activities.map((a) =>
    a.name
      .trim()
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => /[a-z]/i.test(w) && !STOPWORDS.has(w))
  )

  // Longest common prefix (word-level)
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
  const pluralized = pluralizeWord(last)
  return [...rest, pluralized].join(' ')
}

function pluralizeWord(word) {
  const lw = word.toLowerCase()
  if (lw === 'advisory') return word.slice(0, -1) + 'ies' // Advisory → Advisories
  if (lw.endsWith('y') && !/[aeiou]y$/.test(lw)) return word.slice(0, -1) + 'ies'
  if (/[sxz]$/.test(lw) || /[cs]h$/.test(lw)) return word + 'es'
  return word + 's'
}
```

---

## 3. `src/components/agenda/TeacherActivityCard.jsx` — full redesign

Replace the entire file. New structure: `SoloCard` and `ClusterCard` inner components, both sharing a `RoleBadge` helper.

```jsx
import { Stack, CheckCircle, HandWaving } from '@phosphor-icons/react'
import { formatTimeRange } from './agendaUtils'
import { getBlockLabel } from '@/lib/constants'

// Role color config
const ROLE_BADGE = {
  teacher: { label: 'Teacher', className: 'bg-primary/15 text-primary' },
  monitor: { label: 'Monitor', className: 'bg-secondary/15 text-secondary' },
  prep:    { label: 'Prep',    className: 'bg-base-200 text-base-content/50' },
}

function RoleBadge({ role }) {
  const cfg = ROLE_BADGE[role] ?? ROLE_BADGE.teacher
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0 ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function BlockBadges({ block, blockLabels }) {
  if (!block?.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {block.map((b) => (
        <span key={b} className="text-[10px] text-base-content/40 bg-base-200 rounded px-1 py-0.5">
          {getBlockLabel(b, blockLabels)}
        </span>
      ))}
    </div>
  )
}

function TeacherActivityCard({ item, blockLabels, waveCount = 0, hasAttendanceRecords = false, onClick }) {
  if (item.isCluster) {
    return (
      <ClusterCard
        item={item}
        blockLabels={blockLabels}
        waveCount={waveCount}
        hasAttendanceRecords={hasAttendanceRecords}
        onClick={onClick}
      />
    )
  }
  return (
    <SoloCard
      item={item}
      blockLabels={blockLabels}
      waveCount={waveCount}
      hasAttendanceRecords={hasAttendanceRecords}
      onClick={onClick}
    />
  )
}

function SoloCard({ item, blockLabels, waveCount, hasAttendanceRecords, onClick }) {
  const { activity, role, enrollmentCount } = item
  const isPrepLike = role === 'prep'
  const calendarColor = activity.calendar?.color

  return (
    <div
      className={`border rounded-2xl shadow-sm h-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden ${
        isPrepLike ? 'bg-base-200/60 border-base-300' : 'bg-base-100 border-base-300 border-l-4'
      }`}
      style={!isPrepLike && calendarColor ? { borderLeftColor: calendarColor } : undefined}
      onClick={onClick}
    >
      <div className="p-2.5 flex flex-col gap-1 h-full">
        {/* Row 1: role badge + time */}
        <div className="flex items-center justify-between gap-1">
          <RoleBadge role={role} />
          <span className="text-[11px] text-base-content/50 shrink-0 tabular-nums">
            {formatTimeRange(activity.default_start_time, activity.default_end_time)}
          </span>
        </div>

        {/* Row 2: title */}
        <div className="font-medium text-sm leading-tight truncate">{activity.name}</div>

        {/* Row 3: block badges + indicators */}
        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
          <BlockBadges block={activity.block} blockLabels={blockLabels} />
          {hasAttendanceRecords && (
            <CheckCircle size={13} weight="fill" className="text-success/60 shrink-0" />
          )}
          {waveCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-base-content/40 shrink-0">
              <HandWaving size={13} />
              <span className="text-[11px]">{waveCount}</span>
            </span>
          )}
          {!isPrepLike && (
            <span className="text-[11px] text-base-content/40 shrink-0 ml-auto">{enrollmentCount}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ClusterCard({ item, blockLabels, waveCount, hasAttendanceRecords, onClick }) {
  return (
    <div
      className="bg-base-100 border border-base-300 rounded-2xl shadow-sm h-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      onClick={onClick}
    >
      <div className="p-2.5 flex flex-col gap-1 h-full">
        {/* Row 1: role badge + stack icon + time */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <RoleBadge role={item.role} />
            <Stack size={12} className="text-base-content/40 shrink-0" />
          </div>
          <span className="text-[11px] text-base-content/50 shrink-0 tabular-nums">
            {formatTimeRange(item.default_start_time, item.default_end_time)}
          </span>
        </div>

        {/* Row 2: cluster title */}
        <div className="font-medium text-sm leading-tight truncate">{item.clusterTitle}</div>

        {/* Row 3: block badges + indicators */}
        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
          <BlockBadges block={item.block} blockLabels={blockLabels} />
          {hasAttendanceRecords && (
            <CheckCircle size={13} weight="fill" className="text-success/60 shrink-0" />
          )}
          {waveCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-base-content/40 shrink-0">
              <HandWaving size={13} />
              <span className="text-[11px]">{waveCount}</span>
            </span>
          )}
          <span className="text-[11px] text-base-content/40 shrink-0 ml-auto">{item.totalEnrollment}</span>
        </div>
      </div>
    </div>
  )
}

export default TeacherActivityCard
```

---

## 4. `src/components/agenda/ClusterPopover.jsx` — new file

Floating popover anchored above (or below) the source card. Click-outside and Escape dismiss.

```jsx
import { useEffect, useRef } from 'react'
import { X } from '@phosphor-icons/react'
import { formatTimeRange } from './agendaUtils'
import { getBlockLabel } from '@/lib/constants'

const POPOVER_WIDTH = 560 // px, adjust if needed
const POPOVER_GAP = 8    // px between popover edge and anchor

function ClusterPopover({ renderable, anchorRect, blockLabels, onMemberClick, onClose }) {
  const ref = useRef(null)

  // Click-outside dismiss
  useEffect(() => {
    function handleMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  // Escape dismiss
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Position: above anchor by default, flip below if not enough room
  const popoverHeight = 200 // rough estimate; actual height is auto
  const fitsAbove = anchorRect.top - POPOVER_GAP - popoverHeight > 0
  const top = fitsAbove
    ? anchorRect.top - POPOVER_GAP   // will use transform: translateY(-100%)
    : anchorRect.bottom + POPOVER_GAP

  // Horizontal: center on anchor, clamped to viewport
  const viewportWidth = window.innerWidth
  let left = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2
  left = Math.max(8, Math.min(left, viewportWidth - POPOVER_WIDTH - 8))

  const blockLabelsUnion = renderable.block?.length
    ? renderable.block.map((b) => getBlockLabel(b, blockLabels)).join(', ')
    : null

  const timeRange = formatTimeRange(renderable.default_start_time, renderable.default_end_time)

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-base-100 border border-base-300 rounded-2xl shadow-xl overflow-hidden"
      style={{
        width: POPOVER_WIDTH,
        left,
        top,
        transform: fitsAbove ? 'translateY(-100%)' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-base-200">
        <div>
          <div className="font-semibold">{renderable.clusterTitle}</div>
          <div className="text-sm text-base-content/50 flex items-center gap-1.5 mt-0.5">
            <span>{timeRange}</span>
            {blockLabelsUnion && <><span>·</span><span>{blockLabelsUnion}</span></>}
          </div>
        </div>
        <button className="btn btn-ghost btn-xs btn-circle ml-2" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      {/* Member cards */}
      <div
        className="p-3 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${renderable.memberCount}, 1fr)` }}
      >
        {renderable.activities.map((activity) => (
          <MemberCard
            key={activity.id}
            activity={activity}
            blockLabels={blockLabels}
            onClick={() => {
              onClose()
              onMemberClick(activity)
            }}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-base-200 text-xs text-base-content/40 flex items-center gap-1.5">
        <span>{renderable.clusterTitle}</span>
        <span>·</span>
        <span>{renderable.totalEnrollment} student{renderable.totalEnrollment !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

function MemberCard({ activity, blockLabels, onClick }) {
  const timeRange = formatTimeRange(activity.default_start_time, activity.default_end_time)
  const blockLabel = activity.block?.length
    ? activity.block.map((b) => getBlockLabel(b, blockLabels)).join(', ')
    : null

  return (
    <div
      className="bg-base-200/50 border border-base-300 rounded-xl p-2.5 cursor-pointer hover:bg-base-200 transition-colors"
      onClick={onClick}
    >
      <div className="font-medium text-sm leading-tight truncate">{activity.name}</div>
      <div className="text-xs text-base-content/50 mt-0.5">{timeRange}</div>
      {blockLabel && <div className="text-xs text-base-content/40 mt-0.5">{blockLabel}</div>}
    </div>
  )
}

export default ClusterPopover
```

---

## 5. `src/pages/teacher/Dashboard.jsx` — pipeline replacement

### Imports to add
```js
import ClusterPopover from '@/components/agenda/ClusterPopover'
import { buildTeacherRenderables } from '@/components/agenda/agendaUtils'
```

### Imports to remove
```js
// Remove:
import { groupActivitiesForLayout } from '@/components/agenda/agendaUtils'  // (wasn't imported, just confirming)
// Remove from agendaUtils imports (no longer needed):
//   nothing new to remove here — timeToMinutes, floorToHour, ceilToHour, DEFAULT_GRID_START, DEFAULT_GRID_END stay
```

### State: replace `rosterTarget`, add `clusterPopover`

```js
// Replace:
const [rosterTarget, setRosterTarget] = useState(null)

// With:
const [rosterTarget, setRosterTarget] = useState(null)    // activity object
const [clusterPopover, setClusterPopover] = useState(null) // { renderable, anchorRect }
```

### Replace `displayItems` memo

Remove the entire `displayItems` useMemo (lines 67–113 in original) and the `groupByBlock` function at the bottom of the file. Replace with:

```js
const renderables = useMemo(
  () => buildTeacherRenderables(activities, enrollmentCounts, teacherId),
  [activities, enrollmentCounts, teacherId]
)
```

### Update `gridBounds` to use `renderables`

Change `displayItems` → `renderables` in the `gridBounds` useMemo (both the length check and the start/end extraction).

### Update `renderCard`

```js
const renderCard = (item) => {
  const waveCount = item.isCluster
    ? item.activities.reduce((sum, a) => sum + (actionSummary?.waveCounts?.get(a.id) ?? 0), 0)
    : (actionSummary?.waveCounts?.get(item.id) ?? 0)

  const hasAttendanceRecords = item.isCluster
    ? item.activities.some((a) => actionSummary?.hasAttendanceRecords?.get(a.id))
    : (actionSummary?.hasAttendanceRecords?.get(item.id) ?? false)

  return (
    <TeacherActivityCard
      item={item}
      blockLabels={blockLabels}
      waveCount={waveCount}
      hasAttendanceRecords={hasAttendanceRecords}
      onClick={(e) => handleCardClick(item, e)}
    />
  )
}
```

### Update `handleCardClick`

```js
function handleCardClick(item, e) {
  if (item.isCluster) {
    const anchorRect = e.currentTarget.getBoundingClientRect()
    setClusterPopover({ renderable: item, anchorRect })
  } else {
    setRosterTarget(item.activity)
  }
}
```

### Update content rendering and `SingleDayAgenda` call

Replace `displayItems` with `renderables` throughout:

```jsx
{!isLoading && renderables.length > 0 && (
  <SingleDayAgenda
    activities={renderables}
    gridStartMinutes={gridStartMinutes}
    gridEndMinutes={gridEndMinutes}
    renderCard={renderCard}
  />
)}

{!isLoading && renderables.length === 0 && (
  /* empty state unchanged */
)}
```

### Update `RosterModal` call

```jsx
{rosterTarget && (
  <RosterModal
    activities={[rosterTarget]}
    isAggregate={false}
    date={date}
    orgId={orgId}
    teacherId={teacherId}
    blockLabels={blockLabels}
    actionSummary={actionSummary}
    schoolDay={schoolDay}
    onClose={() => setRosterTarget(null)}
  />
)}
```

### Add `ClusterPopover` render

```jsx
{clusterPopover && (
  <ClusterPopover
    renderable={clusterPopover.renderable}
    anchorRect={clusterPopover.anchorRect}
    blockLabels={blockLabels}
    onMemberClick={(activity) => {
      setClusterPopover(null)
      setRosterTarget(activity)
    }}
    onClose={() => setClusterPopover(null)}
  />
)}
```

### Widen layout

Change `max-w-2xl` → `max-w-4xl` on the outermost `div` in the Dashboard return. The student `TodayView.jsx` keeps `max-w-2xl` unchanged.

### Remove `groupByBlock` function

Delete the `groupByBlock` function at the bottom of `Dashboard.jsx` entirely.

---

## 6. `allActivityIds` memo — update to use `renderables`

The existing `allActivityIds` memo in Dashboard feeds `useTeacherActionSummary`. It currently maps over `activities` (the flat list from the hook). Keep it mapped over `activities` — not over `renderables` — because the action summary needs all individual activity IDs, including those inside clusters.

```js
// This stays unchanged — still uses raw activities, not renderables
const allActivityIds = useMemo(
  () => activities.map((a) => a.id),
  [activities]
)
```

---

## 7. `ensureActivityInstances` call — update

The `useEffect` that calls `ensureActivityInstances` should stay mapped over `activities` (raw list), not `renderables`. No change needed.

---

## Verification

1. **Non-overlapping teacher day:** Trevor's normal day (Advisory solo, block-based classes). All cards render as solo cards with role badges. No clusters. Clicking any card opens the roster modal directly.

2. **Clustering — monitor activities:** Trevor's Monday 12:15–1:15pm slot has 4+ internship activities he monitors simultaneously. They should cluster into one cluster card titled "N Internships" (or "N activities" if the prefix logic doesn't match). Clicking the cluster card opens the popover. Each member card in the popover is clickable and opens its roster modal.

3. **Prep detection:** An activity where Trevor is `teacher_id` and enrollment count is 0 should render with the gray prep treatment.

4. **Role badge display:** Teacher activities show blue badge, monitor activities show purple, prep shows gray.

5. **Cluster popover positioning:** Clicking a cluster card near the bottom of the viewport should flip the popover to render below the anchor (not above).

6. **Click-outside + Escape dismiss:** Both dismiss the popover.

7. **Roster modal after popover:** Click cluster card → popover opens → click member card → popover closes → roster modal opens for that member's activity.

8. **Action summary invalidation:** Mark attendance via the roster modal → close modal → the agenda card's attendance indicator updates (existing invalidation pattern should cover this).

9. **Student view non-regression:** Allison's student TodayView is unchanged — no clustering, no role badges, just the overlap layout from 86.1.

10. **Layout width:** Teacher Dashboard is wider (`max-w-4xl`). Student TodayView unchanged (`max-w-2xl`).
