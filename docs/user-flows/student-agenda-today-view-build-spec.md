# Student Agenda (TodayView) — Build Spec

**Date:** March 12, 2026
**Status:** Ready to build
**Split from:** `student-teacher-agenda-build-spec.md` (student portion)

**Context:** The admin agenda view is built and working. This spec builds the student equivalent — a today-focused view of the student's own schedule. It reuses the admin agenda's positioning utilities (`agendaUtils`) directly and introduces a shared single-day grid wrapper (`SingleDayAgenda`) designed for reuse by the teacher agenda spec.

**Design principle:** Build the view first, interactions second. This spec covers read display with placeholder action buttons. Check-in flows, status updates, presence waves, and posts are separate features to be layered on afterward.

**Scope boundary:** This spec covers the student `TodayView` only. The teacher `Dashboard`, roster modal, and attendance marking are covered in a separate teacher agenda spec.

---

## Layout

The student agenda uses the same time-based positioning logic as the admin agenda:

- Vertical time axis on the left (7 AM – 4 PM default, expanding to fit actual activity times)
- Cards positioned vertically by `default_start_time` / `default_end_time`
- Block overlay bands as visual reference (see Block Overlay section)
- `agendaUtils` is reused directly for all time-to-pixel math — no forking

The view is **today-first** with `<` `>` date navigation. Date state is local to the page component (`useState`), not Zustand — it's view-local and shouldn't persist across sessions.

**Date header format:** Arrow buttons flanking the date label. Shows "Today" when viewing the current date; full date otherwise (e.g. "Mon, Mar 11").

**Rotation day display (conditional):** If any of the student's enrolled activities (across all enrollments, not just today's filtered set) have a non-null `rotation_day_type`, append the rotation day label to the header: "Today, March 12 — A Day". This ensures students with rotation-dependent courses always see which rotation day it is. If none of the student's activities use rotation scheduling, the rotation label is omitted entirely — it would just be confusing noise for students whose schedule doesn't vary by rotation.

The check is against the student's full set of enrolled activities (not filtered by today), because a student with an A-day-only course needs to see "B Day" on B days too — the absence of their rotation-dependent activity is itself meaningful information.

**Non-school day behavior:** For MVP, allow navigating to any calendar date. On weekends, holidays, or other non-school days, show an empty state message (e.g. "No classes scheduled for this date"). This is simpler than requiring school day lookups to gate date navigation.

### Single-Column Layout

Unlike the admin agenda which shows Mon–Fri columns simultaneously, the student view shows **one day at a time**. The student only cares about "what do I have today" (or on a specific date they've navigated to).

```
┌──────────────────────────────────────────────┐
│  ← Today, March 12 — A Day →                 │  ← date nav header (rotation label conditional)
├──────────────────────────────────────────────┤
│  7a ┊░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← block overlay band
│     ┊░░┌────────────────────────┬──────┐░░░░│
│     ┊░░│ Biology               │  ✓   │░░░░│
│  8a ┊░░│ Ms. Rodriguez         │      │░░░░│
│     ┊░░│ 7:30a–9:00a · B0 · 204│  💬  │░░░░│
│     ┊░░│ ◎                     │      │░░░░│
│  9a ┊░░└────────────────────────┴──────┘░░░░│
│     ┊                                        │  ← gap between blocks (passing period)
│     ┊▓▓┌────────────────────────┬──────┐▓▓▓▓│  ← alternating block overlay tone
│     ┊▓▓│ Advisory              │  👋  │▓▓▓▓│
│ 10a ┊▓▓│ Mr. Lang              │      │▓▓▓▓│
│     ┊▓▓│ 9:05a–9:50a · B1      │  💬  │▓▓▓▓│
│     ┊▓▓└────────────────────────┴──────┘▓▓▓▓│
│     ┊                                        │
│     ┊         ...                             │
└──────────────────────────────────────────────┘
```

---

## Block Overlay

The block overlay renders horizontal reference bands on the time grid, one per block that has defined times in the org's default schedule template. It connects the abstract "Block 2" label on a card to a visible region on the time axis. This is especially useful when activities don't perfectly align with block boundaries (e.g. a Kirkwood course assigned to Block 0 but only covering part of that time range).

### Data Source

Block time definitions come from the default `schedule_templates` row via `useDefaultScheduleTemplate(orgId)`. The template's `block_definitions` is a JSONB array where each entry has `{ block, start_time, end_time }`.

### Visual Treatment

- **Alternating subtle bands.** Two tones alternate across blocks: odd blocks and even blocks get different background colors. Use very low-opacity fills that don't compete with cards — e.g. `bg-primary/5` and `bg-secondary/5`, or `bg-base-200/30` and `bg-base-200/15`. The exact values should be tuned during build to feel like "tinted graph paper" — visible enough to orient, subtle enough to recede behind cards.
- **Block label on the left edge.** Each band has a small label (e.g. "B0", "B1") anchored to the left edge, vertically centered within the band. Styling: `text-[10px] text-base-content/30 font-medium`. The label sits inside the band, not in the time axis column.
- **Gaps between blocks stay empty.** If Block 0 ends at 9:00 and Block 1 starts at 9:05, the 5-minute gap is un-banded — naturally communicating passing periods.
- **Blocks without times are not rendered.** If a block has no `start_time`/`end_time` in the template (or no template exists), no band or label is shown for that block. The overlay degrades gracefully to nothing when no block times are defined.

### Positioning

Each band is absolutely positioned within the grid using the same `agendaUtils` math as activity cards:
- Top: `minutesToPx(timeToMinutes(block.start_time) - gridStartMinutes) + GRID_PAD_Y`
- Height: `minutesToPx(timeToMinutes(block.end_time) - timeToMinutes(block.start_time))`
- Width: full column width
- Z-index: behind activity cards (render the overlay before cards in the DOM, or use `z-0` on overlay / `z-10` on cards)

### Component

`AgendaBlockOverlay` already exists as a stub (`src/components/agenda/AgendaBlockOverlay.jsx`) — it currently renders `null`. This build replaces the stub with a real implementation.

**Props:**
- `blockDefinitions` — array of `{ block, start_time, end_time }` from the schedule template (filtered to entries with both times defined)
- `gridStartMinutes` — the grid's start time in minutes (for positioning math)
- `blockLabels` — array of custom block labels from org settings (for the band label text; falls back to `"B{n}"`)

**Shared across all agendas.** This component is used by the student `SingleDayAgenda`, and should also be usable by the teacher agenda and the admin `AgendaGrid`. Un-stubbing it for the admin agenda is a separate follow-up task (see GitHub Issues note below).

### Future Enhancements

- **Admin-defined block colors.** Let admins assign a color to each block in OrgSettings, replacing the alternating pattern with intentional per-block colors. Deferred — alternating is good enough for v1 and avoids settings UI overhead.
- **Admin agenda un-stub.** The existing admin `AgendaGrid` passes `blockCount` and `gridStartMinutes` to the stub. It will need to also pass `blockDefinitions` and `blockLabels` to the real component. File a GitHub issue for this as a small follow-up task — it's not part of this spec's build scope but should happen soon after.

---

## SingleDayAgenda (Shared Grid Wrapper)

`src/components/agenda/SingleDayAgenda.jsx`

A lightweight single-column grid wrapper that renders the time axis, block overlay, and a column of children (activity cards). Designed for reuse by both the student `TodayView` and the teacher `Dashboard`.

### Why Not Reuse AgendaGrid?

The admin `AgendaGrid` is tightly coupled to admin concerns: `WEEKDAYS` multi-column layout, day header buttons with `uiStore` focus state, block filter label row at the bottom. Forcing it into single-column mode would require conditional logic and prop overrides that would make the admin component harder to maintain. The student and teacher agendas share more DNA with each other than with the admin agenda — both are "what's happening today for me" single-day views.

### What It Reuses

- All time-to-pixel math from `agendaUtils`: `timeToMinutes`, `minutesToPx`, `floorToHour`, `ceilToHour`, `activityTop`, `activityHeight`
- Layout constants: `PX_PER_HOUR`, `TIME_COL_WIDTH`, `GRID_PAD_Y`
- `AgendaBlockOverlay` for block reference bands

### What It Does NOT Include

- Multi-column day layout
- Day header buttons
- Block filter label row
- `uiStore` focus state
- Density/aggregate logic (that's card-level, not grid-level)

### Props

```js
SingleDayAgenda.propTypes = {
  activities: PropTypes.array.isRequired,       // activities for this day, pre-filtered
  gridStartMinutes: PropTypes.number.isRequired, // derived from activities or defaults
  gridEndMinutes: PropTypes.number.isRequired,
  blockDefinitions: PropTypes.array,             // from schedule template (may be null/empty)
  blockLabels: PropTypes.array,                  // from org settings
  renderCard: PropTypes.func.isRequired,         // (activity) => <StudentActivityCard ... />
}
```

The `renderCard` prop keeps the grid wrapper role-agnostic — the student view passes a function that renders `StudentActivityCard`, the teacher view will pass one that renders `TeacherActivityCard`. The wrapper handles positioning; the caller handles card content.

### Render Structure

```jsx
<div className="flex border border-base-300 rounded-lg bg-base-100 overflow-hidden">
  {/* Time axis */}
  <div className="flex-shrink-0 border-r border-base-300 relative" style={{ width: TIME_COL_WIDTH, height: gridHeight }}>
    {hourLabels}
  </div>

  {/* Card column */}
  <div className="flex-1 relative" style={{ height: gridHeight }}>
    {hourGridLines}
    <AgendaBlockOverlay blockDefinitions={blockDefinitions} gridStartMinutes={gridStartMinutes} blockLabels={blockLabels} />
    {activities.map(activity => (
      <div key={activity.id} className="absolute left-2 right-2" style={{ top: activityTop(...), height: activityHeight(...) }}>
        {renderCard(activity)}
      </div>
    ))}
  </div>
</div>
```

---

## Instance Upsert

The student view triggers lazy instance creation on render. When the view loads activities for a given date, it upserts `activity_instances` rows for any activity scheduled on that date (`INSERT ... ON CONFLICT DO NOTHING`). This is the standard lazy creation pattern — it ensures instances exist before any interaction can occur.

A shared utility function `ensureActivityInstances(activityIds, date, orgId)` handles this, calling the existing `upsertActivityInstance` from `src/api/instances.js` in a batch `Promise.all`. This utility is created in `src/api/agenda.js` and will be reused by the teacher agenda spec.

---

## Student Activity Card

Cards are positioned and sized by time via `SingleDayAgenda`. No density or aggregate logic is needed — a student will never have two activities in the same block (enrollment validation prevents it). Each card is always a full-width single-card display.

### Two-Zone Card Layout

Each card is divided into two zones: a **content area** (left, flexible width) and an **action strip** (right, fixed width).

```
┌──────────────────────────────────────┬──────┐
│ Activity Name                        │      │
│ Staff Name                           │  [⬤] │  ← primary action (check-in or wave)
│ 7:30a – 9:00a · Block 0 · Room 204  │      │
│ ◎  📋                                │  [💬] │  ← status update
└──────────────────────────────────────┴──────┘
  ↑ content area                         ↑ action strip
```

**Content area** — flexible width, contains all read-only information:
- **Row 1:** Activity name — `font-medium`, truncated with `truncate` if needed
- **Row 2:** Staff display name (see staff display rule below) — `text-sm text-base-content/70`
- **Row 3:** Time range · Block label · Location — `text-sm text-base-content/60`. Format: `7:30a – 9:00a · Block 0 · Room 204`. Omit location segment if `location` is null. Omit block segment if `block` is null.
- **Row 4:** Property icons (informational) — small, muted, grouped in a row. Only shown if at least one icon applies.

**Action strip** — fixed width (`w-14`, ~56px), subtle visual separation from the content area. Renders as a distinct zone via a left border (`border-l border-base-300`) and slightly differentiated background (`bg-base-200/50`). Buttons stack vertically, centered in the strip.

### Staff Display Rule

Show `instructor_name` if set; otherwise show the `teacher_id` profile's display name (last name); otherwise omit the row entirely. This gives students the name of whoever is actually running the class — the external professor, the cooperating teacher, or the City View teacher.

### Property Icons (Informational)

Small (14–16px), muted (`text-base-content/40`), not interactive. Styled to feel visually "inset" or stamped into the card — clearly not buttons. Grouped in a row on the bottom line of the content area.

| Condition | Icon | Import |
|-----------|------|--------|
| `requires_geofence = true` | Location crosshairs | `MdOutlineMyLocation` from `react-icons/md` |
| `allows_freeform = true` | Checklist | `LuListTodo` from `react-icons/lu` |

Icons are only rendered when their condition is true. If no conditions are met, the row is omitted (no empty row).

**Not shown to students:** `requires_attendance` — students don't need to know which activities are attendance-bearing. That's admin/teacher-facing information.

### Action Buttons (in the strip)

Larger than info icons (20–24px), clearly tappable. Each button has a hover state and is visually distinct from the muted property icons. Buttons use `btn btn-ghost btn-sm btn-square` as a base with the icon centered.

**Primary action button** (top position in the strip) — rendered conditionally based on activity flags, in priority order:

| Condition | Button | Icon | Import |
|-----------|--------|------|--------|
| `requires_checkin = true` | Check-in | Circle checkmark | `IoCheckmarkCircleOutline` from `react-icons/io5` |
| `allows_presence_wave = true` | Presence wave | Waving hand | `PiHandWaving` from `react-icons/pi` |
| Neither flag set | No primary button | — | — |

For this spec, render the primary action button as a **visible placeholder** — correct icon, styled as a button, but `disabled` or non-functional (`onClick` is a no-op or logs to console). The check-in spec will make it functional without changing the card structure.

**Status update button** (bottom position in the strip) — always present for any activity that has an instance for today.

| Button | Icon | Import |
|--------|------|--------|
| Status update | Comment with plus | `MdOutlineAddComment` from `react-icons/md` |

Also a placeholder for this spec — correct icon, visible, non-functional. The status updates spec will wire it up.

**Strip layout when only one button is present:** If no primary action applies (neither `requires_checkin` nor `allows_presence_wave`), only the status update button appears. It should vertically center in the strip rather than sitting at the bottom.

### Card Styling

- Card container: `bg-base-100 border border-base-300 rounded-lg shadow-sm overflow-hidden`
- Content area: `p-3 flex flex-col gap-0.5` (compact vertical spacing)
- Action strip: `w-14 border-l border-base-300 bg-base-200/50 flex flex-col items-center justify-center gap-2`
- Cards are not clickable beyond their action buttons. No `cursor-pointer` on the card itself.

### Mobile/Narrow Viewport Strategy

The primary target is Chromebook (laptop viewport), where the action strip has plenty of room. Mobile optimization is deferred but the planned direction is documented here for component structure decisions:

**Future mobile approach:** On narrow viewports, the action strip could transition to a tap-to-reveal overlay — tapping the card reveals the action buttons side-by-side over a blurred card background, tapping outside dismisses them. This keeps cards at consistent heights and preserves the time axis at all viewport sizes.

**For MVP:** The static right-side strip is used at all viewport sizes. A `CardActions` wrapper component renders the action buttons; this wrapper could later switch rendering modes at a breakpoint without touching the rest of the card.

---

## Data Layer

### New Hook: `useStudentAgenda(studentId, date, orgId)`

`src/hooks/useStudentAgenda.js`

Fetches all activities the student is enrolled in that meet on the given date.

**Query strategy:** Fetch the student's active enrollments joined to activities and teacher profiles. Apply `activityMeetsToday` filtering client-side after fetch, since the full predicate (rotation day matching, day-of-week, date range, active status, school day check) is complex and partially depends on the school day record for the date.

**Returns:** `{ activities, allActivities, schoolDay, isLoading, error }`

- `activities`: Array of activity objects enriched with teacher profile data, filtered to those meeting today, sorted by `default_start_time`
- `allActivities`: The unfiltered set of enrolled activities (needed for the rotation day header check — see below)
- `schoolDay`: The school day record for the given date (needed for rotation day matching and for displaying rotation label in the header)

**Rotation day header derivation:** The `TodayView` component checks whether `allActivities.some(a => a.rotation_day_type != null)`. If true, it reads `schoolDay.rotation_day` and appends it to the date header. This uses the full enrollment set (not today-filtered) so that a student with an A-day course sees the rotation label on B days too.

**Dependencies:**
- Fetches enrollments for the student: `enrollments` → `activities` → `user_profiles` (teacher)
- Fetches the school day record for the given date via `getSchoolDays(orgId, date, date)`
- Fetches org settings for block definitions
- Uses `activityMeetsToday` logic from `docs/business-logic/01-schedule-and-calendar.md`

**TanStack Query key:** `['student-agenda', studentId, date]`

**`activityMeetsToday` implementation note:** This is the most complex part of the data layer. The function must check: `is_active`, `is_not_scheduled`, `start_date`/`end_date` range, school day status, `rotation_day_type` match against the school day's rotation, and `days_of_week` match against the date's day-of-week. Implement this as a pure function in `src/lib/scheduleUtils.js` (new file) so it can be reused by the teacher agenda hook and any future schedule-dependent logic.

```js
// src/lib/scheduleUtils.js
export function activityMeetsToday(activity, date, schoolDay) {
  // See docs/business-logic/01-schedule-and-calendar.md for full algorithm
  // Returns boolean
}
```

### New API Functions

`src/api/agenda.js` (new file) — shared agenda API functions used by both student and teacher specs.

```js
// Fetch a student's activities for a specific date
// Returns activities with teacher profile joins, filtered to active enrollments
export async function getStudentActivitiesForDate(studentId, orgId) { ... }

// Batch-ensure activity instances exist for a set of activities on a date
// Calls upsertActivityInstance for each, using Promise.all
export async function ensureActivityInstances(activityIds, orgId, date) { ... }
```

`getStudentActivitiesForDate` does **not** filter by date — it returns all actively enrolled activities with their scheduling fields. Date filtering happens client-side via `activityMeetsToday`, because the filtering depends on the school day record which is fetched separately.

### Existing API/Hook Reuse

- `useSchoolDays(orgId, date, date)` from `src/hooks/useSchoolDays.js` — fetches the school day record for the target date (needed for rotation day matching)
- `useOrgSettings(orgId)` from `src/hooks/useOrgSettings.js` — block count, block labels, rotation day names
- `useDefaultScheduleTemplate(orgId)` from `src/hooks/useScheduleTemplate.js` — block time definitions for the overlay
- `upsertActivityInstance` from `src/api/instances.js` — called by `ensureActivityInstances`

---

## Component Structure

### New Files

| File | Purpose |
|------|---------|
| `src/pages/student/TodayView.jsx` | Replace existing placeholder. Page component with date nav and agenda grid. |
| `src/components/agenda/SingleDayAgenda.jsx` | Shared single-column grid wrapper with time axis and block overlay. Reused by teacher spec. |
| `src/components/agenda/StudentActivityCard.jsx` | Student-specific card with two-zone layout (content + action strip). |
| `src/components/agenda/CardActions.jsx` | Renders action buttons for the strip. Isolated for future mobile overlay swap. |
| `src/hooks/useStudentAgenda.js` | Fetches student's enrolled activities for a date. |
| `src/api/agenda.js` | Shared agenda API functions (student fetch, batch instance upsert). |
| `src/lib/scheduleUtils.js` | Pure `activityMeetsToday` function and related scheduling predicates. |

### Existing Files Modified

| File | Change |
|------|--------|
| `src/components/agenda/AgendaBlockOverlay.jsx` | Replace stub with real implementation. No changes to its usage in admin `AgendaGrid` — the admin still passes the existing props and gets `null` until the admin follow-up task adds `blockDefinitions`. |

**Note on AgendaBlockOverlay backward compatibility:** The stub currently accepts `{ blockCount, gridStartMinutes }` and renders `null`. The real implementation accepts `{ blockDefinitions, gridStartMinutes, blockLabels }`. The admin `AgendaGrid` still passes the old props — since `blockDefinitions` will be `undefined`, the component renders nothing (same as the stub). The admin follow-up task will add the `blockDefinitions` prop to `AgendaGrid`. This means the un-stub is non-breaking for the admin view.

**Note on card components:** The existing `AgendaCard` is admin-specific in its content and density logic. Rather than adding role-conditional props, `StudentActivityCard` is a separate component. It shares grid positioning logic (via `agendaUtils`) but has its own content layout. The student card is always rendered at `single` density — no density switching needed.

### Component Hierarchy

```
TodayView
├── DateNavHeader (inline — prev/next buttons + date label + conditional rotation day)
├── SingleDayAgenda (new shared wrapper)
│   ├── Time axis (left)
│   ├── AgendaBlockOverlay (real implementation — renders block bands from schedule template)
│   ├── Hour grid lines
│   └── Positioned activity cards (via renderCard prop)
│       └── StudentActivityCard (one per activity)
│           ├── Content area (name, staff, time/block/location, property icons)
│           └── CardActions (action strip with placeholder buttons)
└── Empty state (shown on non-school days or when no activities)
```

---

## TodayView Page Component

`src/pages/student/TodayView.jsx`

```
function TodayView() {
  const [date, setDate] = useState(new Date())  // local state, today by default
  const profile = useAuthStore(s => s.profile)
  const orgId = profile?.organization_id
  const studentId = profile?.id

  // Fetch student's activities + school day for the date
  const { activities, allActivities, schoolDay, isLoading } = useStudentAgenda(studentId, date, orgId)
  const { data: orgSettings } = useOrgSettings(orgId)
  const { data: template } = useDefaultScheduleTemplate(orgId)

  // Ensure instances exist for today's activities (fire-and-forget on render)
  useEffect(() => {
    if (activities.length > 0) {
      ensureActivityInstances(activities.map(a => a.id), orgId, formatDate(date))
    }
  }, [activities, orgId, date])

  // Date navigation handlers
  const goToPrev = () => setDate(d => subDays(d, 1))
  const goToNext = () => setDate(d => addDays(d, 1))
  const goToToday = () => setDate(new Date())
  const isToday = isSameDay(date, new Date())

  // Rotation day display — conditional on student having rotation-dependent activities
  const usesRotation = allActivities?.some(a => a.rotation_day_type != null) ?? false
  const rotationLabel = usesRotation && schoolDay?.rotation_day
    ? orgSettings?.rotation_day_names?.[/* index from rotation_day */] ?? schoolDay.rotation_day
    : null

  // Block overlay data
  const blockDefinitions = (template?.block_definitions ?? [])
    .filter(d => d.start_time && d.end_time)
  const blockLabels = orgSettings?.block_labels ?? []

  // Derive grid bounds from activities (reuse floorToHour/ceilToHour from agendaUtils)
  // ...

  return (
    <div>
      {/* Date nav header — includes rotationLabel if non-null */}
      {/* SingleDayAgenda with activities, blockDefinitions, renderCard */}
      {/* Empty state for non-school days or no activities */}
    </div>
  )
}
```

Date arithmetic helpers (`subDays`, `addDays`, `isSameDay`, `formatDate`) — use lightweight implementations in `scheduleUtils.js` or inline. No need for a date library at this scale.

---

## Instance Upsert Detail

The `ensureActivityInstances` call in `useEffect` is fire-and-forget — it runs after activities are fetched and doesn't block rendering. If instances already exist, the upserts are no-ops (`ON CONFLICT DO NOTHING`). This matches the lazy creation pattern described in the business logic docs.

```js
// src/api/agenda.js
import { upsertActivityInstance } from './instances'

export async function ensureActivityInstances(activityIds, orgId, date) {
  await Promise.all(
    activityIds.map(id => upsertActivityInstance(id, orgId, date))
  )
}
```

This could be optimized to a single bulk upsert query later, but individual upserts via `Promise.all` are fine for MVP — a student's schedule will have at most 6–8 activities.

---

## Build Sequence

Build bottom-up so each piece can be tested independently.

1. **`src/lib/scheduleUtils.js`** — implement `activityMeetsToday` as a pure function following `docs/business-logic/01-schedule-and-calendar.md`. Add date helpers (`subDays`, `addDays`, `isSameDay`, `formatDateISO`). Write against the algorithm spec and verify with the example scenarios in the business logic doc.

2. **`src/api/agenda.js`** — `getStudentActivitiesForDate` (enrollment join query) and `ensureActivityInstances` (batch upsert wrapper). These are straightforward Supabase queries.

3. **`src/hooks/useStudentAgenda.js`** — wraps the API call with TanStack Query, fetches the school day record, applies `activityMeetsToday` filtering client-side, sorts by `default_start_time`. Returns both `activities` (filtered) and `allActivities` (unfiltered, for rotation check).

4. **`src/components/agenda/AgendaBlockOverlay.jsx`** — replace stub with real implementation. Render alternating subtle bands for each block with defined times. Block label on left edge. Accept `blockDefinitions`, `gridStartMinutes`, `blockLabels` props. Render nothing if `blockDefinitions` is empty/undefined (backward compatible with admin's current prop passing).

5. **`src/components/agenda/SingleDayAgenda.jsx`** — shared single-column grid wrapper. Time axis, hour grid lines, `AgendaBlockOverlay`, positioned cards via `renderCard` prop. Uses `agendaUtils` for all math. Designed for teacher agenda reuse.

6. **`src/components/agenda/CardActions.jsx`** — renders action buttons in a vertical strip. Props: `requiresCheckin`, `allowsPresenceWave`, `hasInstance`. All buttons are placeholders (correct icons, disabled/no-op). Isolated component for future mobile overlay swap.

7. **`src/components/agenda/StudentActivityCard.jsx`** — two-zone layout with content area and `CardActions` strip. Props: `activity`, `staffDisplayName`, `blockLabel`. No click handler on the card itself.

8. **`src/pages/student/TodayView.jsx`** — assemble the page: date nav header (with conditional rotation label), `SingleDayAgenda` with activities and block overlay data, empty state, instance upsert effect.

---

## Out of Scope (deferred to later specs)

- Check-in / check-out flow (button is a visible placeholder in this build)
- Presence wave interaction (button is a visible placeholder)
- Status updates panel (button is a visible placeholder)
- Posts and post responses
- Geolocation validation
- Freeform block tagging at check-in
- Real-time updates (Supabase Realtime)
- Streak tracking display
- Mobile-optimized layout (overlay action buttons)
- Schedule template–derived times (block times shift on 2-hour delay days, etc.)
- Teacher agenda, roster modal, and attendance marking (separate spec)
- Admin-defined block colors (future enhancement for block overlay)

---

## Resolved Decisions

Decisions made during spec review, documented here for context.

1. **Block overlay: alternating bands.** Two subtle alternating tones rather than per-block colors. Admin-defined block colors deferred as a future enhancement.

2. **Block overlay: no times = no render.** Blocks without defined `start_time`/`end_time` in the schedule template do not render a band or label. If no template exists, the overlay renders nothing. Block labels without times have no meaningful position on the time axis.

3. **Rotation day display: conditional on enrollment.** The rotation label appears in the date header only if the student has at least one enrolled activity (across all enrollments) with `rotation_day_type != null`. Students whose schedules don't vary by rotation never see the label.

4. **SingleDayAgenda wrapper over AgendaGrid reuse.** The admin `AgendaGrid` is too coupled to admin concerns (multi-column, day focus, block filter buttons, `uiStore`). A new `SingleDayAgenda` wrapper reuses `agendaUtils` for positioning math and is designed for reuse by both student and teacher views.

5. **Date navigation: any date, empty state on non-school days.** No school day lookups for navigation gating in MVP. Future polish: skip non-school days.

6. **`activityMeetsToday`: verify business logic doc before implementing.** `docs/business-logic/01-schedule-and-calendar.md` is the single source of truth for the algorithm.

---

## Follow-Up Tasks (outside this spec)

- **GitHub Issue: Un-stub `AgendaBlockOverlay` for admin `AgendaGrid`.** The real overlay component is built as part of this spec, but the admin `AgendaGrid` needs to pass `blockDefinitions` and `blockLabels` as props (from `useDefaultScheduleTemplate` + org settings). Small task — add the hook call and prop passing in `Dashboard.jsx` / `AgendaGrid.jsx`.