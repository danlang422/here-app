# Layer 2 Build Spec — Null-Block Clustering, Aggregate Expansion, Filter Bar, Conflict Refinement

**Design doc:** `docs/user-flows/admin-calendar-redesign-design-doc.md`
**Design notes:** `docs/user-flows/layer-2-design-notes.md`
**Status:** Ready to build (requires Layer 1 complete)
**Depends on:** Layer 1 (calendar view fully functional)

---

## What This Layer Delivers

- Null-block activities cluster by time overlap instead of collapsing into one giant aggregate card
- Aggregate cards are clickable — opens a popover listing the grouped activities, each clickable to open the full detail popover
- Filter bar is functional — text search across activity and teacher names
- Enrollment conflict detection no longer flags false positives for alternating-week activities

---

## Build Order

1. Time-slot clustering in `agendaUtils.js` + rename import in `CalendarDayColumn.jsx`
2. Aggregate card expansion (`CalendarEventCard`, `CalendarDayColumn`, `CalendarWeekGrid`, `CalendarView`, new `CalendarAggregatePopover`)
3. Filter bar (`CalendarFilterBar`, `CalendarView`)
4. Recurrence-aware conflict detection (`enrollmentValidation.js`)

Items 3 and 4 are independent of each other and can be done in any order after item 1.

---

## 1. Time-Slot Clustering — `agendaUtils.js`

### Problem

`groupActivitiesByBlock` puts all `block === null` activities into a single `'null'` group. Nine null-block activities across different times collapse into one aggregate card spanning the full day.

### Change

**File:** `src/components/agenda/agendaUtils.js`

**Rename:** `groupActivitiesByBlock` → `groupActivitiesForLayout`

**New behavior:** After grouping by block, process the `'null'` group separately. Split it into time-based clusters using a merge scan. Replace the `'null'` entry in the returned Map with one entry per cluster (`'time-0'`, `'time-1'`, etc.).

Activities with a non-null `block` are unaffected — they continue to group by block as before.

**Full replacement for `groupActivitiesForLayout`:**

```javascript
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

    let clusterIndex = 0
    let clusterEnd = sorted[0].default_end_time ?? sorted[0].default_start_time ?? ''
    let currentCluster = [sorted[0]]

    const GAP_TOLERANCE_MINUTES = 15

    for (let i = 1; i < sorted.length; i++) {
      const activity = sorted[i]
      const actStart = activity.default_start_time ?? ''
      const clusterEndMin = timeToMinutes(clusterEnd)
      const actStartMin = timeToMinutes(actStart)

      if (
        clusterEndMin !== null &&
        actStartMin !== null &&
        actStartMin <= clusterEndMin + GAP_TOLERANCE_MINUTES
      ) {
        // Merge into current cluster
        currentCluster.push(activity)
        const actEnd = activity.default_end_time ?? ''
        if (actEnd > clusterEnd) clusterEnd = actEnd
      } else {
        // Finalize current cluster, start new one
        map.set(`time-${clusterIndex}`, currentCluster)
        clusterIndex++
        currentCluster = [activity]
        clusterEnd = activity.default_end_time ?? activity.default_start_time ?? ''
      }
    }
    // Finalize last cluster
    map.set(`time-${clusterIndex}`, currentCluster)
  }

  return map
}
```

**Also update the import in `CalendarDayColumn.jsx`** (line 5):
```javascript
// Before:
import { groupActivitiesByBlock, ... } from '@/components/agenda/agendaUtils'

// After:
import { groupActivitiesForLayout, ... } from '@/components/agenda/agendaUtils'
```

And the call site in `CalendarDayColumn.jsx` (line 37):
```javascript
// Before:
const blockGroups = useMemo(
  () => groupActivitiesByBlock(todayActivities, date.getDay()),
  [todayActivities, date]
)

// After:
const blockGroups = useMemo(
  () => groupActivitiesForLayout(todayActivities, date.getDay()),
  [todayActivities, date]
)
```

No other changes to `CalendarDayColumn` are needed for this item — the density logic already iterates over `blockGroups` entries and handles each group independently.

---

## 2. Aggregate Card Expansion

### Problem

Aggregate cards (`mode="aggregate"` in `CalendarEventCard`) have a stubbed `onClick={() => {}}`. Clicking them does nothing.

### New behavior

Clicking an aggregate card opens `CalendarAggregatePopover` — a small popover listing the grouped activities. Each activity row is clickable and opens the existing `CalendarEventPopover` flow for that activity.

### Changes

**2a. `CalendarEventCard.jsx` — wire `onClick` in aggregate mode**

The aggregate `div` currently has no click handler. Add one:

```jsx
// Before (line 13–24):
<div
  className="absolute inset-0 rounded bg-base-200 overflow-hidden flex flex-col items-center justify-center"
  title={titleStr}
>

// After:
<div
  className="absolute inset-0 rounded bg-base-200 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:bg-base-300 transition-colors"
  title={titleStr}
  onClick={(e) => onClick(e)}
>
```

The `onClick` prop signature for aggregate mode becomes `onClick(event)` so the caller can use click coordinates for popover positioning.

**2b. `CalendarDayColumn.jsx` — add `onAggregateClick` prop, wire aggregate card**

Add `onAggregateClick` to the component's props destructuring (alongside `onActivityClick`):

```javascript
export function CalendarDayColumn({
  date,
  schoolDay,
  activities,
  enrollmentCountByActivity,
  gridStartMinutes,
  onEmptyClick,
  onActivityClick,
  onAggregateClick,   // new
})
```

Replace the stubbed `onClick` on the aggregate `CalendarEventCard` (line 150):

```jsx
// Before:
onClick={() => {}}

// After:
onClick={(e) => onAggregateClick(aggregateData, e)}
```

**2c. `CalendarWeekGrid.jsx` — pass `onAggregateClick` through to `CalendarDayColumn`**

Add `onAggregateClick` to `CalendarWeekGrid`'s props and pass it to each `CalendarDayColumn`:

```javascript
export function CalendarWeekGrid({
  // ... existing props ...
  onAggregateClick,   // new
})
```

```jsx
<CalendarDayColumn
  // ... existing props ...
  onAggregateClick={onAggregateClick}
/>
```

**2d. `CalendarView.jsx` — add aggregate popover state**

Add a separate state slot for the aggregate popover (keep it separate from the activity popover to allow both to coexist if needed):

```javascript
const [aggregatePopover, setAggregatePopover] = useState(null)
// null | { aggregateData: { count, totalEnrollment, activities }, position: { x, y } }
```

Add handler:

```javascript
function handleAggregateClick(aggregateData, event) {
  setAggregatePopover({
    aggregateData,
    position: { x: event.clientX, y: event.clientY },
  })
}
```

Pass to `CalendarWeekGrid`:

```jsx
<CalendarWeekGrid
  // ... existing props ...
  onAggregateClick={handleAggregateClick}
/>
```

Render the aggregate popover (below the existing `CalendarEventPopover` render):

```jsx
{aggregatePopover && (
  <CalendarAggregatePopover
    aggregateData={aggregatePopover.aggregateData}
    position={aggregatePopover.position}
    onClose={() => setAggregatePopover(null)}
    onActivityClick={(activity) => {
      setAggregatePopover(null)
      handleActivityClick(activity)
    }}
    enrollmentCountByActivity={enrollmentCountByActivity}
  />
)}
```

**2e. New `src/components/schedule-calendar/CalendarAggregatePopover.jsx`**

A lightweight fixed-position popover. Renders a list of the aggregated activities. Closes on backdrop click or Escape.

```jsx
import { useEffect, useRef } from 'react'

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'p' : 'a'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

export function CalendarAggregatePopover({
  aggregateData,
  position,
  onClose,
  onActivityClick,
  enrollmentCountByActivity,
}) {
  const ref = useRef(null)

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Position: snap to keep within viewport
  const style = {
    position: 'fixed',
    top: position.y,
    left: position.x,
    zIndex: 50,
    maxWidth: '280px',
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover */}
      <div
        ref={ref}
        className="bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden"
        style={style}
      >
        <div className="px-3 py-2 border-b border-base-200 text-xs font-semibold text-base-content/70">
          {aggregateData.count} activities · {aggregateData.totalEnrollment} students
        </div>
        <ul className="divide-y divide-base-200">
          {aggregateData.activities.map((activity) => {
            const enrollCount = enrollmentCountByActivity[activity.id] ?? 0
            const borderColor = activity.calendar?.color ?? '#94a3b8'
            return (
              <li
                key={activity.id}
                className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-base-200 transition-colors"
                onClick={() => onActivityClick(activity)}
              >
                <div
                  className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: borderColor }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{activity.name}</span>
                  <span className="text-xs text-base-content/60">
                    {formatTime(activity.default_start_time)}–{formatTime(activity.default_end_time)}
                    {activity.teacher?.last_name && ` · ${activity.teacher.last_name}`}
                    {` · ${enrollCount} student${enrollCount !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
```

**Z-index note:** Aggregate cards render at `zIndex: 1` (behind individual cards at `zIndex: 2`). After time-slot clustering, aggregates will be smaller and focused on a specific time range, reducing the chance that an individual card fully covers the aggregate. This is acceptable for Layer 2.

---

## 3. Filter Bar Implementation

### Problem

`CalendarFilterBar` is a disabled placeholder.

### Change

**File:** `src/components/schedule-calendar/CalendarFilterBar.jsx`

Rewrite to a controlled input that fires `onFilterChange`:

```jsx
export function CalendarFilterBar({ filterText, onFilterChange }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-base-200">
      <input
        type="text"
        className="input input-bordered input-sm w-64"
        placeholder="Filter activities..."
        value={filterText}
        onChange={(e) => onFilterChange(e.target.value)}
      />
      {filterText && (
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => onFilterChange('')}
        >
          ✕
        </button>
      )}
    </div>
  )
}
```

**File:** `src/components/schedule-calendar/CalendarView.jsx`

Add filter state and apply it to the visible activities pipeline:

```javascript
const [filterText, setFilterText] = useState('')
```

Add a `filteredActivities` derived value after `visibleActivities`:

```javascript
const filteredActivities = useMemo(() => {
  if (!filterText.trim()) return visibleActivities
  const lower = filterText.trim().toLowerCase()
  return visibleActivities.filter((a) => {
    if (a.name?.toLowerCase().includes(lower)) return true
    if (a.teacher?.first_name?.toLowerCase().includes(lower)) return true
    if (a.teacher?.last_name?.toLowerCase().includes(lower)) return true
    return false
  })
}, [visibleActivities, filterText])
```

Pass `filterText` and `setFilterText` to `CalendarFilterBar`, and `filteredActivities` (instead of `visibleActivities`) to `CalendarWeekGrid`. The `gridBounds` computation should stay based on `visibleActivities` (not `filteredActivities`) so the grid height doesn't jump when filtering.

```jsx
<CalendarFilterBar filterText={filterText} onFilterChange={setFilterText} />
```

```jsx
<CalendarWeekGrid
  // ...
  activities={filteredActivities}   // was: visibleActivities
  // ...
/>
```

---

## 4. Recurrence-Aware Conflict Detection

### Problem

`couldMeetOnSameDay` in `enrollmentValidation.js` does not account for `recurrence_interval`. Two every-other-week activities whose anchor dates land on alternating weeks will never actually share a school day, but the current code flags them as conflicting. This is a false positive — safe, but noisy and will confuse admins building alternating-week schedules.

### Constraint

False positives (flagging a non-conflict as a conflict) are acceptable. False negatives (missing a real conflict) are not. The fix should only skip a conflict if it can prove the activities never land on the same week — if uncertain, preserve the existing conservative behavior.

### Change

**File:** `src/lib/enrollmentValidation.js`
**Function:** `couldMeetOnSameDay`

After the `aHasDays && bHasDays` check (Case 1), before returning `shared`, add a recurrence refinement:

```javascript
// Case 1: Both use days_of_week — conflict if any shared day
if (aHasDays && bHasDays) {
  const shared = daysOverlap(activityA.days_of_week, activityB.days_of_week)
  if (!shared) {
    return {
      couldMeetSameDay: false,
      reason: 'Activities meet on different weekdays',
    }
  }

  // Both share at least one weekday — check whether recurrence intervals
  // guarantee they never land on the same week.
  //
  // Only apply when BOTH activities have interval > 1 AND anchor dates.
  // If either is missing this data, fall through conservatively.
  const aInterval = activityA.recurrence_interval ?? 1
  const bInterval = activityB.recurrence_interval ?? 1
  const aAnchor = activityA.recurrence_anchor_date
  const bAnchor = activityB.recurrence_anchor_date

  if (aInterval > 1 && bInterval > 1 && aAnchor && bAnchor) {
    // Only handle the equal-interval case — most common at City View
    if (aInterval === bInterval) {
      // Compute which phase each activity falls in (week number modulo interval)
      const EPOCH = '2024-01-01'  // Arbitrary fixed Monday
      const msPerWeek = 7 * 24 * 60 * 60 * 1000
      const epochMs = new Date(EPOCH).getTime()
      const aWeekOffset = Math.round((new Date(aAnchor).getTime() - epochMs) / msPerWeek)
      const bWeekOffset = Math.round((new Date(bAnchor).getTime() - epochMs) / msPerWeek)
      const aPhase = ((aWeekOffset % aInterval) + aInterval) % aInterval
      const bPhase = ((bWeekOffset % bInterval) + bInterval) % bInterval

      if (aPhase !== bPhase) {
        return {
          couldMeetSameDay: false,
          reason: `Activities meet on the same weekday(s) but on alternating weeks (interval ${aInterval}, different phases)`,
        }
      }
    }
    // If intervals differ, we can't easily determine overlap — fall through conservatively
  }

  return {
    couldMeetSameDay: true,
    reason: 'Both activities meet on overlapping weekdays',
  }
}
```

Update the existing NOTE comment on `couldMeetOnSameDay` (line 73) to reflect that Layer 2 has been implemented:

```javascript
// NOTE: Recurrence interval awareness handles the equal-interval alternating-week case.
// Unequal intervals or missing anchor dates fall through conservatively (false positive).
```

---

## Verification

### Time-slot clustering
1. Open a week where null-block activities exist across different time ranges (e.g., a Tuesday with activities at 7:30–9:00 and 12:00–2:00).
2. Verify the calendar shows two separate groups instead of one giant aggregate card.
3. Verify each cluster applies density logic independently — a cluster of 1 shows a single card, a cluster of 4+ shows an aggregate.

### Aggregate card expansion
1. Find or create a week day with 4+ activities in the same null-block time cluster (or same named block).
2. Click the aggregate card.
3. Verify the popover appears near the click point listing each activity with name, time, teacher (if any), and enrollment count.
4. Click an activity row in the popover.
5. Verify the popover closes and `CalendarEventPopover` opens for that activity.
6. Verify pressing Escape closes the aggregate popover without opening the event popover.
7. Verify clicking the backdrop closes the popover.

### Filter bar
1. Type a partial activity name in the filter bar.
2. Verify only matching activities render in the week grid.
3. Type a teacher last name.
4. Verify matching activities appear; unmatched activities disappear.
5. Click the ✕ clear button.
6. Verify all activities return.
7. Verify the grid height does not jump when filtering (grid bounds are based on all visible activities, not the filtered subset).

### Recurrence-aware conflict detection
1. Create two activities: both every-other-week (`recurrence_interval = 2`), same day-of-week, same block, with anchor dates one week apart.
2. Attempt to enroll a student in both.
3. Verify no conflict warning is raised.
4. Create two activities: same interval, same anchor week phase (both would meet the same weeks).
5. Attempt to enroll in both.
6. Verify the conflict warning is raised correctly.

---

## File Reference

| File | Change |
|------|--------|
| `src/components/agenda/agendaUtils.js` | Rename `groupActivitiesByBlock` → `groupActivitiesForLayout`, add time-clustering for null-block activities |
| `src/components/schedule-calendar/CalendarDayColumn.jsx` | Update import name; add `onAggregateClick` prop; wire aggregate card click |
| `src/components/schedule-calendar/CalendarEventCard.jsx` | Add `onClick` to aggregate mode div |
| `src/components/schedule-calendar/CalendarWeekGrid.jsx` | Add `onAggregateClick` prop, pass to `CalendarDayColumn` |
| `src/components/schedule-calendar/CalendarView.jsx` | Add `aggregatePopover` state + handler; add `filterText` state; wire `filteredActivities` to grid |
| `src/components/schedule-calendar/CalendarFilterBar.jsx` | Implement controlled input + clear button |
| New: `src/components/schedule-calendar/CalendarAggregatePopover.jsx` | New component — popover listing aggregated activities |
| `src/lib/enrollmentValidation.js` | Refine `couldMeetOnSameDay` with equal-interval recurrence phase check |
