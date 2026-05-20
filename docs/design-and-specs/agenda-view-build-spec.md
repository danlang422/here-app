# Agenda View — Build Spec

**Created:** March 7, 2026
**Status:** Ready to build
**Design reference:** `docs/user-flows/admin-dashboard.md`
**Session decisions:** Session 8.1 (March 7) — resolved aggregate card interaction, tab behavior, dashboard architecture

---

## Scope

This spec covers:
- The `AgendaView` component and its sub-components
- Additions to `uiStore` for agenda filter/focus state
- The rebuilt `src/pages/admin/Dashboard.jsx`

This spec does not cover:
- Activity Panel (floating panel — separate spec)
- Enrollment Panel Entry B (separate spec)
- Conflict visualization (deferred — depends on enrollment panel real-world testing)
- Schedule template / block-derived times (requires Calendar Management)
- Toolbar polish, icon design, property toggle filters

---

## Architecture Decisions (Session 8.1)

**No tabs below the agenda.** Activity Management and User Management remain as their own pages, navigated to via the existing AdminLayout tab nav. The dashboard is `agenda + toolbar placeholder + floating panels`. The original "tabs below the agenda" concept was cut — it was motivated by filling space rather than workflow need.

**Agenda filter state lives in `uiStore`**, not local component state, because the enrollment panel and toolbar will eventually need to read/write the same filter state (for conflict visualization and coordinated filtering). Add two focused-state fields to the existing store.

**Time is the positioning axis.** Activities are positioned on the vertical axis by `default_start_time` / `default_end_time`. Block assignment is an organizational label shown as an overlay band — it does not control card placement. Block-derived times (from schedule templates) are deferred until Calendar Management is built.

**Only activities with explicit times appear on the agenda.** Activities where `default_start_time` is null cannot be positioned and are excluded from the grid. These are "unplaced" from the agenda's perspective regardless of whether they have a block assigned.

---

## Existing Infrastructure — Use These Exactly

### Hooks (no new hooks needed for v1)

```js
import { useActivities } from '@/hooks/useActivities'
import { useOrgEnrollments } from '@/hooks/useEnrollments'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import useAuthStore from '@/store/authStore'
```

- `useActivities(orgId)` — returns activities with `teacher` and `monitor` profiles already joined via the Supabase select. Fields available: `id`, `name`, `type`, `block`, `days_of_week`, `rotation_day_type`, `default_start_time`, `default_end_time`, `duration_minutes`, `is_active`, `is_not_scheduled`, `teacher.first_name`, `teacher.last_name`.
- `useOrgEnrollments(orgId)` — returns all active enrollments for the org. Use this to compute per-activity enrollment counts client-side (no new query needed).
- `useOrgSettings(orgId)` — returns org settings. Access `block_count` via `settings?.block_count`.
- `orgId` sourced via `useAuthStore((s) => s.profile?.organization_id)` — the established pattern used across all admin pages.

### Constants

```js
import { WEEKDAYS, getBlocks, getBlockLabel } from '@/lib/constants'
```

- `WEEKDAYS` — Mon–Fri array: `[{ value: 1, label: 'Mon', short: 'M' }, ...]`
- `getBlocks(blockCount)` — returns `[0, 1, 2, ...]` for the org's block count
- `getBlockLabel(n)` — returns `"Block N"`

### uiStore (extend, do not replace)

```js
import useUIStore from '@/store/uiStore'
```

Add the following to `src/store/uiStore.js` alongside existing state:

```js
// Agenda focus state — drives zoom/filter interactions
// null = show all; a value = filter to that block or day
agendaFocusedBlock: null,   // integer | null
agendaFocusedDay: null,     // DAYS_OF_WEEK value (1–5) | null
setAgendaFocusedBlock: (block) => set({ agendaFocusedBlock: block }),
setAgendaFocusedDay: (day) => set({ agendaFocusedDay: day }),
clearAgendaFocus: () => set({ agendaFocusedBlock: null, agendaFocusedDay: null }),

// Conflict visualization hook-in — not implemented yet
// agendaConflictState: null,  // future: set by EnrollmentPanel when active
```

---

## Data Derivations

All derived inside the Dashboard page or AgendaView — no new API calls.

### Enrollment count per activity

```js
const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)

// useMemo: Map<activityId, enrollmentCount>
const enrollmentCountByActivity = useMemo(() => {
  const map = new Map()
  for (const e of orgEnrollments) {
    map.set(e.activity_id, (map.get(e.activity_id) ?? 0) + 1)
  }
  return map
}, [orgEnrollments])
```

### Activities eligible for the agenda (have explicit times)

```js
const scheduledActivities = useMemo(() =>
  activities.filter(a =>
    a.is_active &&
    !a.is_not_scheduled &&
    a.default_start_time &&
    a.default_end_time
  ),
[activities])
```

### Time grid bounds (derived from activity data)

```js
// Returns "HH:MM" strings — used to set grid start/end
const gridBounds = useMemo(() => {
  if (scheduledActivities.length === 0) {
    return { start: '07:00', end: '16:00' }
  }
  const starts = scheduledActivities.map(a => a.default_start_time)
  const ends = scheduledActivities.map(a => a.default_end_time)
  // Floor start to nearest hour, ceil end to nearest hour, with padding
  const minStart = starts.reduce((a, b) => a < b ? a : b)
  const maxEnd = ends.reduce((a, b) => a > b ? a : b)
  return { start: floorToHour(minStart), end: ceilToHour(maxEnd) }
}, [scheduledActivities])
```

Write `floorToHour` and `ceilToHour` helpers in `agendaUtils.js` — they parse `"HH:MM"` strings and return floored/ceiled `"HH:00"` strings.

---

## Component Structure

```
src/components/agenda/
  AgendaView.jsx         — main component; receives orgId, enrollmentCountByActivity
  AgendaGrid.jsx         — renders the time axis + day columns
  AgendaDayColumn.jsx    — a single day column with positioned activity cards
  AgendaCard.jsx         — individual activity card (density-aware: single / few / aggregate)
  AgendaBlockOverlay.jsx — block band overlays across the full grid
  agendaUtils.js         — pure functions: timeToMinutes, minutesToPx, groupByBlock, getDensity

src/pages/admin/
  Dashboard.jsx          — rebuilt: toolbar placeholder + AgendaView + panel launch buttons
```

---

## Grid Layout & Positioning

### Constants (in `agendaUtils.js`)

```js
export const PX_PER_HOUR = 80        // pixels per 60 minutes
export const TIME_COL_WIDTH = 48     // px width of the left time axis column
export const DAY_COL_MIN_WIDTH = 140 // minimum px width of each day column
```

### Time-to-pixel helpers

```js
export function timeToMinutes(timeStr) {
  // "HH:MM" → integer minutes from midnight
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
```

### Grid rendering (AgendaGrid)

- Outer container: `flex` row — time axis column on left, day columns filling remaining width
- Time axis: fixed `TIME_COL_WIDTH` px wide, renders hour labels (7am, 8am, ...) at `minutesToPx(hour * 60)` from the top
- Day columns: `flex-1` each, minimum `DAY_COL_MIN_WIDTH`, rendered via `AgendaDayColumn`
- Total grid height: `minutesToPx(gridEndMinutes - gridStartMinutes)`
- Grid has `position: relative` — cards use `position: absolute` inside day columns

---

## Density Logic

Activities are grouped per day column by **block assignment**. Within each block group, the number of activities determines the card type rendered.

### Grouping (in `agendaUtils.js`)

```js
// Returns Map<blockKey, activity[]>
// blockKey: integer block number, or 'null' for activities with no block assigned
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

// Does this activity meet on the given day of week?
export function activityMeetsDay(activity, dayValue) {
  if (activity.days_of_week != null) {
    return activity.days_of_week.includes(dayValue)
  }
  // No days_of_week set: show on all weekdays (treat as meeting every day)
  return true
}
```

### Density thresholds

| Count in block group | Card type |
|---|---|
| 1 | `single` — full detail: name, teacher last name, enrollment count, time |
| 2–3 | `few` — name + enrollment count per card, side by side |
| 4+ | `aggregate` — summary card: "N Activities · M Students" |

These thresholds are exported constants in `agendaUtils.js` so they're easy to adjust:

```js
export const DENSITY_FEW_MAX = 3   // 2–3 = "few"
export const DENSITY_AGG_MIN = 4   // 4+ = aggregate
```

### Aggregate card position and height

- `top`: earliest `default_start_time` among activities in the group
- `height`: span from earliest start to latest end (minimum `PX_PER_HOUR * 1.5` for readability)
- Width: full day column width

### Few / single card layout

- `top` / `height`: each card uses its own activity times
- `width`: for `few`, divide column width equally among cards (Google Calendar simultaneous-event pattern)
- `left`: offset by slot index × card width

---

## Card Content by Density

### `single` (1 activity in block × day)
- Activity name (truncated if needed)
- Teacher last name
- Enrollment count (e.g., "12 students")
- Time range (e.g., "7:30–9:00")
- Block badge (e.g., "Block 2") — subtle, small pill

### `few` (2–3 activities)
- Activity name (truncated)
- Enrollment count
- No time (space is limited)

### `aggregate` (4+ activities)
- "N Activities" count
- "M Students" total enrollment across the group
- **Hover:** tooltip listing `[Activity Name — Teacher Last Name]` for each activity in the group
- **Click:** set `agendaFocusedBlock` and `agendaFocusedDay` in `uiStore` (zoom to block × day)

All card types:
- `cursor-pointer` — clicking a non-aggregate card is reserved for future use (activity detail modal — deferred)
- DaisyUI card classes as baseline; extend with Tailwind for absolute positioning

---

## Interaction Model

### Block label click (left margin)

- Clicking a block label toggles `agendaFocusedBlock` in `uiStore`
- If `agendaFocusedBlock === block` → clear it (restore full view)
- If different → set it (zoom to that block)

### Day column header click

- Clicking a day header toggles `agendaFocusedDay`
- Same toggle pattern as block labels

### Aggregate card

- **Hover** → tooltip listing `[Name — Last Name]` for each activity in the group
- **Click** → set both `agendaFocusedBlock` and `agendaFocusedDay` simultaneously (shortcut for clicking both the block label and day header)

### Zoomed state behavior

When `agendaFocusedBlock` and/or `agendaFocusedDay` are set:

| Focus | Behavior |
|---|---|
| Day only | All day columns visible; time range collapses to span of that day's activities |
| Block only | All day columns visible; aggregate cards in that block row expand to individual side-by-side cards |
| Both | Single day column shown; time range collapses to that block; all activities shown side by side |

In the side-by-side zoomed view:
- Cards arranged horizontally within the column
- If > 6 cards: horizontal scroll (`overflow-x: auto` on the day column)
- Each card shows `single`-density content (full detail) since there's space

### Focus state indicators

- Active block label: highlighted (`bg-primary text-primary-content`)
- Active day header: highlighted
- "Clear filters" button appears in the toolbar area when any focus is active → calls `clearAgendaFocus()`

---

## Block Overlay

Rendered by `AgendaBlockOverlay` — absolutely positioned across the full grid width, behind the cards.

**For v1:** Stub component — renders nothing but exists in the tree. No schedule template data is available yet (requires Calendar Management). Avoids a future structural refactor when template data becomes available.

Once schedule templates are available:
- Draw a horizontal band per block, from block start time to block end time
- Block labels on the left margin are `button` elements with click handlers for `setAgendaFocusedBlock`

Block labels in v1: render as a static list in the left margin (below the time axis), stacked evenly, as interactive buttons. They function as filter controls even without overlay bands.

---

## Dashboard Page (rebuilt)

`src/pages/admin/Dashboard.jsx` — replaces the current nav grid entirely.

```jsx
function Dashboard() {
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id

  const { data: activities = [], isLoading } = useActivities(orgId)
  const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)
  const { data: orgSettings = {} } = useOrgSettings(orgId)

  const enrollmentCountByActivity = useMemo(() => {
    const map = new Map()
    for (const e of orgEnrollments) {
      map.set(e.activity_id, (map.get(e.activity_id) ?? 0) + 1)
    }
    return map
  }, [orgEnrollments])

  const scheduledActivities = useMemo(() =>
    activities.filter(a =>
      a.is_active && !a.is_not_scheduled && a.default_start_time && a.default_end_time
    ),
  [activities])

  const { agendaFocusedBlock, agendaFocusedDay, clearAgendaFocus } = useUIStore()
  const hasFocus = agendaFocusedBlock != null || agendaFocusedDay != null

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar — placeholder for now */}
      <DashboardToolbar hasFocus={hasFocus} onClearFocus={clearAgendaFocus} />

      {/* Agenda view */}
      <AgendaView
        activities={scheduledActivities}
        enrollmentCountByActivity={enrollmentCountByActivity}
        blockCount={orgSettings?.settings?.block_count ?? 0}
      />
    </div>
  )
}
```

`DashboardToolbar` is a stub for this build — renders a row with:
- App/page title placeholder ("Here — Schedule")
- "Clear filters" button (visible only when `hasFocus`)
- Panel launch button stubs (placeholder icons, no functionality yet)

---

## Conflict Visualization — Placeholder Note

When the enrollment panel has an activity or students selected, the agenda will eventually highlight cells where conflicts exist. This requires shared state between `EnrollmentPanel` and `AgendaView`.

**Hook-in point:** `agendaConflictState` in `uiStore` (commented stub). The enrollment panel will set it when a selection is active; `AgendaView` will read it to apply visual treatment.

**Not implemented in this build.** Design deferred until the enrollment panel is tested with real City View data and we understand what conflict information is most useful to surface visually on the agenda.

---

## Build Sequence

Build bottom-up so each piece can be tested independently before wiring in.

1. **`agendaUtils.js`** — all pure helpers: `timeToMinutes`, `minutesToPx`, `activityTop`, `activityHeight`, `groupActivitiesByBlock`, `activityMeetsDay`, `floorToHour`, `ceilToHour`, density constants (`DENSITY_FEW_MAX`, `DENSITY_AGG_MIN`).

2. **`uiStore.js`** — add `agendaFocusedBlock`, `agendaFocusedDay`, `setAgendaFocusedBlock`, `setAgendaFocusedDay`, `clearAgendaFocus`. Add conflict state comment stub.

3. **`AgendaCard.jsx`** — three density variants (`single`, `few`, `aggregate`). Develop with hardcoded props first — no grid context needed.

4. **`AgendaDayColumn.jsx`** — positions cards absolutely within a fixed-height column. Props: `activities` (pre-filtered for the day), `enrollmentCountByActivity`, `gridStartMinutes`, `focusedBlock`.

5. **`AgendaBlockOverlay.jsx`** — stub that renders `null` for v1. Accept `blockCount` and `gridStartMinutes` props for future use.

6. **`AgendaGrid.jsx`** — composes time axis + `AgendaDayColumn` × 5 + `AgendaBlockOverlay`. Handles focused-day collapse (show one column vs. all).

7. **`AgendaView.jsx`** — derives `gridBounds`, maps `WEEKDAYS` to columns, applies focus state from `uiStore`, passes props down.

8. **`Dashboard.jsx`** — rebuild with `DashboardToolbar` stub + `AgendaView`. Wire data through from the three hooks.

---

## What's Deferred (Not in This Build)

- Activity card click → expanded detail modal
- Toolbar: property toggle filters, filter popover, panel-summon icons with functionality
- Block overlay visual rendering (needs schedule template data — Calendar Management)
- Conflict visualization
- Grade-level filter (requires joining through enrollments to student profiles)
- A/B day rotation handling (`rotation_day_type` awareness on the agenda)
- Per-column totals (activity count, student count per day column, responsive to filters)
- Mobile / responsive layout
