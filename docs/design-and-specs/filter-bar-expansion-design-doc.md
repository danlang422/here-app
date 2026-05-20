# Calendar Filter Bar Expansion — Design Document

**Created:** March 31, 2026
**Status:** Design complete — ready for build spec
**Context:** The admin schedule-calendar view (Layer 2) ships with a functional text search filter (activity name / teacher name). This doc designs the next layer of filtering: block, time range, and student. These are independent additions to the existing filter pipeline in `CalendarView`.

**Design doc for prior layers:** `docs/user-flows/admin-calendar-redesign-design-doc.md`

---

## What This Adds

Three new filter dimensions, each independent:

1. **Block filter** — dropdown to show only activities assigned to a specific block
2. **Time range filter** — from/to time dropdowns to constrain the visible time window
3. **Student filter** — search-and-select one or more students; calendar dims non-enrolled activities

All filters live in the existing `CalendarFilterBar` component (expanded into a single wider row). All filters are optional and independently toggleable. When multiple filters are active, they AND together — an activity must pass all active filters to remain visible.

---

## Filter Placement — Single Row Expansion

The current filter bar is one row:
```
[ Filter activities... input ]  [✕]
```

Expanded target layout (all in one row, left to right):
```
[ Filter activities... ]  [✕]  |  Block: [All ▾]  |  Time: [All day ▾] to [▾]  |  Students: [Search students...] [chip] [chip]
```

- A visual separator (`|` or a subtle `border-l`) between the text search and the new controls gives breathing room without a second row.
- The student section sits at the right end of the bar since it's the most complex and benefits from being furthest from the text input.
- On narrower screens, the bar wraps gracefully — this is an admin-only view and City View likely uses this on a laptop or desktop, so overflow isn't a priority concern for now.

---

## 1. Block Filter

### Behavior

- A `<select>` dropdown (or DaisyUI `select`) with options: "All blocks" (default) + one option per block.
- When a block is selected, only activities with `block === selectedBlock` are shown. Activities with `block === null` are hidden.
- Selecting "All blocks" (resetting) restores null-block activities.
- Block labels use `getBlockLabel(blockNum, blockLabels)` from `src/lib/constants.js` — never hardcoded.
- Block options are derived from `orgSettings.block_count` using `getBlocks(blockCount)`.

### Data already available

`CalendarView` already has `orgSettings` (from `useOrgSettings`) which provides `block_count` and `block_labels`. No new data fetching needed.

### State

```javascript
const [selectedBlock, setSelectedBlock] = useState(null) // null = All
```

### Filter logic addition to `filteredActivities` pipeline

```javascript
// After existing text filter, before returning:
.filter((a) => selectedBlock === null || a.block === selectedBlock)
```

---

## 2. Time Range Filter

### Behavior

- Two time dropdowns: "From" and "To", each with options in 15-minute increments across the school day range.
- Default: "All day" (both null — no time filtering).
- When "From" is set: hide activities whose `default_end_time` is at or before the "From" time (i.e., they end before the window opens).
- When "To" is set: hide activities whose `default_start_time` is at or after the "To" time (i.e., they start after the window closes).
- Either bound can be set independently — From without To means "show activities that are still running after X." To without From means "show activities that start before Y."
- Activities with no time data (`default_start_time` is null) pass the time filter regardless — they're already floating in terms of layout, and hiding them silently would be confusing.

### UI detail

Dropdown options: 15-minute increments from 6:00 AM to 6:00 PM (or the org's effective schedule range). Format: `8:00 AM`, `8:15 AM`, etc. The "From" and "To" selects can be plain DaisyUI selects. A small label "Time:" precedes the pair.

A clear button for the time range (resets both to null) appears only when either bound is set, consistent with how the text filter's ✕ works.

### State

```javascript
const [timeFrom, setTimeFrom] = useState(null) // '08:00' or null
const [timeTo, setTimeTo] = useState(null)     // '11:00' or null
```

### Filter logic addition

```javascript
.filter((a) => {
  if (timeFrom === null && timeTo === null) return true
  if (!a.default_start_time && !a.default_end_time) return true // no time = pass through
  if (timeFrom && a.default_end_time && a.default_end_time <= timeFrom) return false
  if (timeTo && a.default_start_time && a.default_start_time >= timeTo) return false
  return true
})
```

### Grid bounds interaction

The time filter should NOT affect `gridBounds` computation — the grid height stays anchored to the full set of visible activities (same pattern as the text filter). If it did change, the grid would reflow every time you adjusted the time filter, which would be jarring.

---

## 3. Student Filter

### Behavior and UX

- A text input that searches students by name (first, last, or preferred name).
- Selecting a student adds them as a chip in the filter bar.
- Multiple students can be added (chips stack horizontally, each with an ✕ to remove).
- When one or more students are selected:
  - Activities that any selected student is enrolled in are shown at **full opacity** ("enrolled" state).
  - Activities that no selected student is enrolled in are shown at **reduced opacity** ("dimmed" state — suggesting `opacity-30` or similar).
  - The admin can still see the full grid structure, which is the point: gaps (blocks with no enrolled activity for this student) are visible in context of what's happening that block.
- "Hide non-enrolled" is a secondary toggle that appears only when a student filter is active. Default off. When on, non-enrolled activities are fully hidden rather than dimmed. This gives the admin the clean view when they want it without it being the default.

### Why dim rather than hide (by default)

The primary diagnostic question when viewing a student's schedule is "what gaps does this student have?" — and gaps only make sense against the backdrop of the full schedule. If you hide everything non-enrolled, empty blocks are just empty — you can't tell if the student is free during a block that has lots of options vs. a block where nothing is offered. Dimming preserves that context.

### Multi-student stacking

When multiple students are selected, an activity is "enrolled" if **any** of the selected students is enrolled in it. This is a union view — you see everything that any of them are in. Activities enrolled by all selected students appear identically to activities enrolled by one.

Visual distinction per student (e.g., color-coded chips or card annotations showing which student is in which activity) is explicitly out of scope for this feature. That's a meaningfully more complex rendering change. The union view is still useful for "show me what these two students' weeks overlap on."

### Student search data

Student search runs against the user roster. `CalendarView` currently fetches `staffUsers` but not students. Two options:

**Option A — Fetch all students once at CalendarView level.** Add `useStudentUsers(orgId)` (or `useRoster(orgId)`) to `CalendarView`'s data fetching. Filter client-side as the admin types. Clean and simple — City View's student count is small enough that this is fine.

**Option B — Lazy fetch on search input.** Fetch students only when the student search input is focused/typed into. Avoids loading roster data until needed.

**Recommendation: Option A.** City View is a small school. The roster hook likely already exists (check `useRoster` or `useUsers` with a role filter). Loading students alongside other CalendarView data keeps the implementation simple and avoids loading state complexity in the filter bar.

### Enrollment lookup

`orgEnrollments` (already fetched in `CalendarView`) has the shape:
```
{ id, student_id, activity_id, is_active, activity: { ... } }
```

From this, build a lookup set of activity IDs enrolled by the selected students:

```javascript
const enrolledActivityIds = useMemo(() => {
  if (selectedStudentIds.length === 0) return null // null = no student filter active
  const ids = new Set()
  orgEnrollments.forEach((e) => {
    if (selectedStudentIds.includes(e.student_id)) ids.add(e.activity_id)
  })
  return ids
}, [selectedStudentIds, orgEnrollments])
```

This set is passed down to `CalendarWeekGrid` → `CalendarDayColumn` → `CalendarEventCard`, which uses it to determine whether to render at full or reduced opacity.

### State

```javascript
const [selectedStudents, setSelectedStudents] = useState([])
// [{ id, first_name, last_name, preferred_name }]
// keeping full objects avoids a secondary lookup when rendering chips

const [hideNonEnrolled, setHideNonEnrolled] = useState(false)
```

### Filter logic

The student filter does **not** remove activities from `filteredActivities` (unless `hideNonEnrolled` is true). Instead, `enrolledActivityIds` is passed separately to the grid — it's a rendering concern, not a filtering concern. This keeps the two behaviors cleanly separated.

When `hideNonEnrolled` is true, add to the filter pipeline:
```javascript
.filter((a) => enrolledActivityIds === null || enrolledActivityIds.has(a.id))
```

---

## Filter Interaction Summary

All filters apply to the same `filteredActivities` pipeline in `CalendarView`, in this order:

1. Calendar visibility (existing — sidebar toggles)
2. Text search (existing — name/teacher)
3. Block filter (new)
4. Time range filter (new)
5. Student hide filter (new — only when `hideNonEnrolled` is true)

Student dimming is separate — it's passed as `enrolledActivityIds` to the grid for rendering, not applied in the filter pipeline.

---

## `CalendarFilterBar` Component Changes

The component currently receives `filterText` and `onFilterChange`. Its props expand to:

```javascript
export function CalendarFilterBar({
  // existing
  filterText,
  onFilterChange,
  // new — block filter
  blockOptions,       // [{ value: 0, label: 'Block 0' }, ...]
  selectedBlock,
  onBlockChange,
  // new — time range filter
  timeFrom,
  timeTo,
  onTimeFromChange,
  onTimeToChange,
  // new — student filter
  students,           // all students (for search/autocomplete)
  selectedStudents,
  onStudentAdd,
  onStudentRemove,
  hideNonEnrolled,
  onHideNonEnrolledChange,
})
```

All state lives in `CalendarView` — `CalendarFilterBar` remains a controlled, stateless display component. The student search input's local text state (the typed-but-not-yet-selected search string) can be an exception and live inside `CalendarFilterBar` since it's purely transient UI state with no effect outside the component.

---

## `CalendarEventCard` Changes

Cards need to accept and apply an opacity modifier. Add an `isDimmed` prop:

```javascript
// In CalendarDayColumn, when building each card:
const isDimmed = enrolledActivityIds !== null && !enrolledActivityIds.has(activity.id)

<CalendarEventCard
  // ... existing props
  isDimmed={isDimmed}
/>
```

In `CalendarEventCard`, apply reduced opacity when dimmed:
```jsx
<div
  className={`... ${isDimmed ? 'opacity-30' : 'opacity-100'} transition-opacity`}
>
```

The aggregate card should also be dimable — if all activities in the aggregate are non-enrolled, dim it. If any are enrolled, show it at full opacity (since it contains relevant activities).

---

## `calendarUiStore` Changes

The student filter and hide-non-enrolled toggle should **not** persist in `calendarUiStore`. Unlike calendar visibility (which is a stable preference), student filter is a transient session-level state — you don't want to open the calendar next week and still be filtered to Trevor. Keep it in `CalendarView` local state (`useState`).

Block and time range filters are also transient and should live in `CalendarView` local state for the same reason.

---

## Files Affected

| File | Change |
|------|--------|
| `src/components/schedule-calendar/CalendarFilterBar.jsx` | Expand to include block dropdown, time range selects, student search + chips, hide toggle |
| `src/components/schedule-calendar/CalendarView.jsx` | Add filter state (block, time, students, hideNonEnrolled); derive `enrolledActivityIds`; expand `filteredActivities` pipeline; fetch students; pass new props to FilterBar and WeekGrid |
| `src/components/schedule-calendar/CalendarWeekGrid.jsx` | Accept and pass `enrolledActivityIds` to `CalendarDayColumn` |
| `src/components/schedule-calendar/CalendarDayColumn.jsx` | Accept `enrolledActivityIds`; compute `isDimmed` per activity; pass to `CalendarEventCard` |
| `src/components/schedule-calendar/CalendarEventCard.jsx` | Accept `isDimmed` prop; apply opacity modifier |
| `src/hooks/useUsers.js` (or equivalent) | Verify student-specific hook exists or add `useStudentUsers(orgId)` |

---

## Out of Scope (Future)

- Per-student color coding in stacked view (visually distinct cards per student)
- Drag-to-create for filtered views
- Saving/naming filter presets
- Filtering by term (useful but not urgent — term filter already partially exists at the activity management level)
- Rotation day filter (A day / B day) — lower priority; the sidebar calendar toggles + block filter covers most of that use case
