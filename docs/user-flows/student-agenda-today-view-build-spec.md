# Student Agenda (TodayView) — Build Spec

**Date:** March 12, 2026
**Status:** Ready to review before build
**Split from:** `student-teacher-agenda-build-spec.md` (student portion)

**Context:** The admin agenda view is built and working. This spec builds the student equivalent — a today-focused view of the student's own schedule. It reuses the admin agenda's grid infrastructure (`AgendaGrid`, `AgendaDayColumn`, `agendaUtils`) directly.

**Design principle:** Build the view first, interactions second. This spec covers read display with placeholder action buttons. Check-in flows, status updates, presence waves, and posts are separate features to be layered on afterward.

**Scope boundary:** This spec covers the student `TodayView` only. The teacher `Dashboard`, roster modal, and attendance marking are covered in a separate teacher agenda spec.

---

## Layout

The student agenda uses the same time-based grid layout as the admin agenda:

- Vertical time axis on the left (7 AM – 4 PM default, expanding to fit actual activity times)
- Cards positioned vertically by `default_start_time` / `default_end_time`
- Block overlay strips (from `AgendaBlockOverlay`) as visual reference bands
- `AgendaGrid`, `AgendaDayColumn`, and `agendaUtils` are reused directly — no forking

The view is **today-first** with `<` `>` date navigation. Date state is local to the page component (`useState`), not Zustand — it's view-local and shouldn't persist across sessions.

**Date header format:** Arrow buttons flanking the date label. Shows "Today" when viewing the current date; full date otherwise (e.g. "Mon, Mar 11").

**Non-school day behavior:** For MVP, allow navigating to any calendar date. On weekends, holidays, or other non-school days, show an empty state message (e.g. "No classes scheduled for this date"). This is simpler than requiring school day lookups to gate date navigation.

### Single-Column Layout

Unlike the admin agenda which shows Mon–Fri columns simultaneously, the student view shows **one day at a time**. The student only cares about "what do I have today" (or on a specific date they've navigated to). The grid renders a single `AgendaDayColumn`.

```
┌──────────────────────────────────────────────┐
│  ← Today, March 12 →                         │  ← date nav header
├──────────────────────────────────────────────┤
│  7a ┊                                        │
│     ┊  ┌────────────────────────┬──────┐     │
│     ┊  │ Biology               │  ✓   │     │
│  8a ┊  │ Ms. Rodriguez         │      │     │
│     ┊  │ 7:30a–9:00a · B0 · 204│  💬  │     │
│     ┊  │ ◎                     │      │     │
│  9a ┊  └────────────────────────┴──────┘     │
│     ┊                                        │
│     ┊  ┌────────────────────────┬──────┐     │
│     ┊  │ Advisory              │  👋  │     │
│ 10a ┊  │ Mr. Lang              │      │     │
│     ┊  │ 9:05a–9:50a · B1      │  💬  │     │
│     ┊  └────────────────────────┴──────┘     │
│     ┊                                        │
│     ┊         ...                             │
└──────────────────────────────────────────────┘
```

---

## Instance Upsert

The student view triggers lazy instance creation on render. When the view loads activities for a given date, it upserts `activity_instances` rows for any activity scheduled on that date (`INSERT ... ON CONFLICT DO NOTHING`). This is the standard lazy creation pattern — it ensures instances exist before any interaction can occur.

A shared utility function `ensureActivityInstances(activityIds, date, orgId)` handles this, calling the existing `upsertActivityInstance` from `src/api/instances.js` in a batch `Promise.all`. This utility is created in `src/api/agenda.js` and will be reused by the teacher agenda spec.

---

## Student Activity Card

Cards are positioned and sized by time, same as admin. No density or aggregate logic is needed — a student will never have two activities in the same block (enrollment validation prevents it). Each card is always a full-width single-card display.

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

**Returns:** `{ activities, schoolDay, isLoading, error }`

- `activities`: Array of activity objects enriched with teacher profile data, sorted by `default_start_time`
- `schoolDay`: The school day record for the given date (needed for rotation day matching and for displaying "A Day" / "B Day" in the header if desired)

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
- `upsertActivityInstance` from `src/api/instances.js` — called by `ensureActivityInstances`

---

## Component Structure

### New Files

| File | Purpose |
|------|---------|
| `src/pages/student/TodayView.jsx` | Replace existing placeholder. Page component with date nav and agenda grid. |
| `src/components/agenda/StudentActivityCard.jsx` | Student-specific card with two-zone layout (content + action strip). |
| `src/components/agenda/CardActions.jsx` | Renders action buttons for the strip. Isolated for future mobile overlay swap. |
| `src/hooks/useStudentAgenda.js` | Fetches student's enrolled activities for a date. |
| `src/api/agenda.js` | Shared agenda API functions (student fetch, batch instance upsert). |
| `src/lib/scheduleUtils.js` | Pure `activityMeetsToday` function and related scheduling predicates. |

### Existing Files Modified

| File | Change |
|------|--------|
| None | This build creates new files only. Existing agenda components (`AgendaGrid`, `AgendaDayColumn`, `agendaUtils`, `AgendaBlockOverlay`) are reused as-is. |

**Note on card components:** The existing `AgendaCard` is admin-specific in its content and density logic. Rather than adding role-conditional props, `StudentActivityCard` is a separate component. It shares grid positioning logic (via `agendaUtils`) but has its own content layout. The student card is always rendered at `single` density — no density switching needed.

### Component Hierarchy

```
TodayView
├── DateNavHeader (inline — prev/next buttons + date label)
├── AgendaGrid (reused — configured for single-column)
│   ├── Time axis (left)
│   ├── AgendaBlockOverlay (reused — stub for now)
│   └── AgendaDayColumn (reused — single column for the target date)
│       └── StudentActivityCard (one per activity)
│           ├── Content area (name, staff, time/block/location, property icons)
│           └── CardActions (action strip with placeholder buttons)
└── Empty state (shown on non-school days or when no activities)
```

### AgendaGrid / AgendaDayColumn Reuse

The student view passes a single-element `visibleDays` array to `AgendaGrid` (or renders a single `AgendaDayColumn` directly, bypassing `AgendaGrid`'s multi-column layout). The simpler approach: render `AgendaDayColumn` directly in `TodayView` with the time axis, skipping the day-header row and block filter buttons that are admin concerns.

**Decision:** Create a lightweight wrapper rather than forcing `AgendaGrid` into single-column mode. The wrapper reuses `agendaUtils` for time-to-pixel math, renders the time axis, and places a single `AgendaDayColumn`-style column. This avoids conditional logic in the admin component while reusing all the positioning math.

Alternatively, if `AgendaGrid` cleanly supports receiving a single visible day, use it directly. Evaluate during build — the goal is zero changes to existing admin components.

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
  const { activities, schoolDay, isLoading } = useStudentAgenda(studentId, date, orgId)
  const { data: orgSettings } = useOrgSettings(orgId)

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

  // Derive grid bounds from activities
  // (reuse floorToHour/ceilToHour from agendaUtils)

  return (
    <div>
      {/* Date nav header */}
      {/* Grid with time axis + single column of StudentActivityCards */}
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

3. **`src/hooks/useStudentAgenda.js`** — wraps the API call with TanStack Query, fetches the school day record, applies `activityMeetsToday` filtering client-side, sorts by `default_start_time`.

4. **`src/components/agenda/CardActions.jsx`** — renders action buttons in a vertical strip. Props: `requiresCheckin`, `allowsPresenceWave`, `hasInstance`. All buttons are placeholders (correct icons, disabled/no-op). Isolated component for future mobile overlay swap.

5. **`src/components/agenda/StudentActivityCard.jsx`** — two-zone layout with content area and `CardActions` strip. Props: `activity`, `staffDisplayName`, `blockLabel`. No click handler on the card itself.

6. **`src/pages/student/TodayView.jsx`** — assemble the page: date nav header, time axis + single-column card layout using `agendaUtils` positioning math, empty state, instance upsert effect.

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

---

## Open Questions

1. **`activityMeetsToday` implementation.** Confirm `docs/business-logic/01-schedule-and-calendar.md` is current before implementing. This is the most complex part of the data layer. The algorithm documented there should be implemented faithfully as the single source of truth.

2. **Rotation day display.** Should the date nav header show the rotation day label (e.g. "Today, March 12 — A Day") when the org uses rotation schedules? Useful for students who have rotation-dependent external courses. Low effort to add — just read `schoolDay.rotation_day` and append if non-null.

3. **AgendaGrid reuse vs. lightweight wrapper.** The admin `AgendaGrid` renders 5 day columns with headers and block filter buttons. The student view needs a single column with none of that chrome. Evaluate during build: can `AgendaGrid` accept a single visible day cleanly, or is a lightweight single-column wrapper simpler? Either way, reuse `agendaUtils` for all positioning math.

4. **Date navigation and school day awareness.** MVP allows navigating to any date, including weekends. Future enhancement: skip non-school days when navigating (requires school day lookups for adjacent dates). Document this as a potential polish item.