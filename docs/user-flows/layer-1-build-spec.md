# Layer 1 Build Spec — Calendar View (Admin Schedule Interface)

**Design doc:** `docs/user-flows/admin-calendar-redesign-design-doc.md`
**Status:** Ready to build (requires Layer 0 complete)
**Depends on:** Layer 0 (migrations applied, `useCalendars` hook, calendar join on activities)

---

## What This Layer Delivers

- Week-based calendar view replaces the broken `AgendaView` as the admin dashboard centerpiece
- Toggleable calendar layers via left sidebar (Google Calendar mental model)
- Calendar CRUD in the sidebar (add/edit/delete)
- Proper block overlay using real block definitions (fixes existing stub)
- Activity cards show calendar color, support click-to-view and click-to-create
- Week navigation (prev/next/today)
- `AgendaView`, `AgendaGrid`, `AgendaDayColumn`, `AgendaCard` retired
- `agendaUtils.js` and `AgendaBlockOverlay.jsx` kept as shared utilities

---

## Build Order

Dependencies flow top-to-bottom. Build in this order:

1. `calendarUiStore.js` — new persisted store (needed by sidebar and toggle logic)
2. `uiStore.js` cleanup — remove agenda focus state
3. `CalendarWeekNav.jsx` — standalone, no component deps
4. `CalendarEventCard.jsx` — standalone
5. `CalendarSidebar.jsx` — needs calendarUiStore, useCalendars, useUsers (for staff dropdown)
6. `CalendarDayColumn.jsx` — needs activityMeetsToday, agendaUtils
7. `CalendarWeekGrid.jsx` — needs CalendarDayColumn, AgendaBlockOverlay
8. `CalendarEventPopover.jsx` — needs ActivityDetailModal
9. `CalendarFilterBar.jsx` — stub, no deps
10. `CalendarView.jsx` — assembles everything
11. `Dashboard.jsx` update — replace AgendaView with CalendarView
12. Delete retired agenda components

---

## 1. New `src/store/calendarUiStore.js`

New persisted Zustand store for calendar-specific UI state. Keep this separate from `uiStore.js` so calendar toggle persistence doesn't force persistence of modal/sidebar open states.

Pattern: mirror `src/store/authStore.js` which uses Zustand `persist` middleware.

```javascript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCalendarUiStore = create(
  persist(
    (set, get) => ({
      // { [calendarId]: boolean } — missing key = visible (default all visible)
      calendarVisibility: {},
      sidebarMinimized: false,

      isCalendarVisible(calendarId) {
        const vis = get().calendarVisibility
        return vis[calendarId] !== false  // default true for unknown IDs
      },

      toggleCalendar(calendarId) {
        set((state) => ({
          calendarVisibility: {
            ...state.calendarVisibility,
            [calendarId]: !get().isCalendarVisible(calendarId),
          },
        }))
      },

      setGroupVisibility(calendarIds, visible) {
        set((state) => {
          const updates = {}
          calendarIds.forEach((id) => { updates[id] = visible })
          return { calendarVisibility: { ...state.calendarVisibility, ...updates } }
        })
      },

      toggleSidebarMinimized() {
        set((state) => ({ sidebarMinimized: !state.sidebarMinimized }))
      },
    }),
    { name: 'calendar-ui' }  // localStorage key
  )
)
```

---

## 2. Update `src/store/uiStore.js`

**Remove these fields and actions:**
- `agendaFocusedBlock`
- `agendaFocusedDay`
- `clearAgendaFocus()`
- `setAgendaFocusedBlock(block)`
- `setAgendaFocusedDay(day)`

**Keep:**
- `selectedDate` — becomes the week anchor. The calendar view shows Mon–Fri of the week containing `selectedDate`.
- `setSelectedDate(date)`
- `sidebarOpen`, `toggleSidebar()`, `setSidebarOpen(bool)` — these control the app-level nav sidebar (unrelated to calendar sidebar)
- `activeModal`, `modalData`, `openModal()`, `closeModal()`

No persist middleware needed on uiStore — modal state and nav sidebar state don't need to survive refresh.

**Before removing:** grep the codebase for `agendaFocusedBlock`, `agendaFocusedDay`, and `clearAgendaFocus` to find all callers. They currently appear in `Dashboard.jsx` and `AgendaGrid.jsx` — both of which are being modified/deleted in this layer. Confirm no other files reference these before removing from the store.

---

## 3. New `src/components/schedule-calendar/` Directory

All new calendar components live here. This name disambiguates from `src/components/calendar/` which is the school-day management UI (month view for marking holidays/rotation days). **Do not touch `src/components/calendar/`.**

---

## 4. `CalendarWeekNav.jsx`

**Props:** none (reads/updates uiStore directly)

**Behavior:**
- Reads `selectedDate` from `useUiStore()`
- Prev button: `setSelectedDate(subDays(selectedDate, 7))`
- Next button: `setSelectedDate(addDays(selectedDate, 7))`
- Today button: `setSelectedDate(new Date())`
- Date range display: compute Monday and Friday of the current week, format as "Mar 30 – Apr 3, 2026"

**Week computation helper** (write inline in CalendarView, used by both Nav and Grid):
```javascript
function getWeekStart(date) {
  // Returns Monday of the week containing date
  const d = new Date(date)
  const day = d.getDay()        // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (day === 0) ? -6 : 1 - day   // Mon = day 1
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}
```

**UI:** Three elements in a horizontal bar — prev arrow button | date range text | next arrow button | today button. Use DaisyUI `btn btn-ghost btn-sm` for arrows and today button. Date range text is `font-semibold`.

---

## 5. `CalendarEventCard.jsx`

Replaces `AgendaCard.jsx`. Same three density modes.

**Props:**
```
activity         — activity object (includes activity.calendar for color)
enrollmentCount  — number
mode             — 'single' | 'few' | 'aggregate'
aggregateData    — { count, totalEnrollment } (only in aggregate mode)
onClick          — function(activity) — called on click for single/few; function(null) for aggregate
```

**Calendar color:** Apply as a left border using inline style. The `activity.calendar?.color` field comes from the Layer 0 join. If `activity.calendar` is null (unassigned), use a neutral border (`border-base-content/20`).

```jsx
<div
  className="absolute inset-0 rounded border-l-4 bg-base-100 overflow-hidden cursor-pointer hover:bg-base-200 transition-colors"
  style={{ borderLeftColor: activity.calendar?.color ?? 'var(--color-base-content/20)' }}
  onClick={() => onClick(activity)}
>
```

**Single mode:** Activity name (truncated), teacher last name if space, enrollment count, time range (use `formatTime` from agendaUtils or inline the same logic). Keep font sizes at `text-xs` / `text-[10px]` matching current cards.

**Few mode:** Name + enrollment count only (same as current FewCard — minimal detail, side-by-side layout context implies adjacent cards).

**Aggregate mode:** "5 activities · 47 students" centered. `onClick` receives `null` — caller decides behavior (e.g., could expand, future Layer 2 feature). For Layer 1, clicking an aggregate card does nothing (or shows a tooltip listing the activities). Add `title` attribute with newline-separated activity names for basic discoverability.

---

## 6. `CalendarSidebar.jsx`

Left sidebar for calendar toggle controls + calendar management.

**Props:**
```
calendars        — calendar[] from useCalendars (includes owner field)
staffUsers       — user[] for owner picker in create/edit modal
orgId            — for mutations
```

**State:** Reads/writes `calendarVisibility`, `sidebarMinimized`, and actions from `useCalendarUiStore`.

### Grouping

Split calendars into two groups:
- **Teachers:** `calendars.filter(c => c.owner_id !== null)` — display with teacher name as subtitle
- **Organizations:** `calendars.filter(c => c.owner_id === null)`

Display order within each group: alphabetical (already sorted by API).

### Layout — Expanded (220px)

```
┌─────────────────────────────┐
│  [←] Schedule Calendars     │  ← minimize button (arrow)
├─────────────────────────────┤
│  ▾ Teachers                 │  ← group header (click to toggle all)
│    ● Ms. Johnson            │  ← color dot + name + checkbox
│    ● Mr. Park               │
├─────────────────────────────┤
│  ▾ Organizations            │
│    ● Kirkwood               │
│    ● Kennedy HS             │
├─────────────────────────────┤
│  ── Unassigned ──           │  ← always visible pseudo-entry, no toggle
├─────────────────────────────┤
│  + Add calendar             │  ← opens create modal
└─────────────────────────────┘
```

**Calendar row** (Teachers group shows owner name as subtitle):
```jsx
<div className="flex items-center gap-2 group py-1 px-2 rounded hover:bg-base-200">
  <input
    type="checkbox"
    className="checkbox checkbox-xs"
    checked={isCalendarVisible(cal.id)}
    onChange={() => toggleCalendar(cal.id)}
  />
  <span
    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
    style={{ backgroundColor: cal.color }}
  />
  <button
    className="text-sm truncate flex-1 text-left"
    onClick={() => openEditModal(cal)}
  >
    {cal.name}
  </button>
</div>
```

**Group header indeterminate state:** When some but not all calendars in a group are toggled, the group checkbox shows indeterminate via `ref.current.indeterminate = true` (set via useEffect or ref callback).

### Layout — Minimized (~44px)

Show only: minimize-expand button + a vertical column of color dots (each clickable to toggle). No text. Use `title` attribute on each dot for tooltip with calendar name.

### Calendar Create/Edit Modal

Opens as a DaisyUI `dialog` (`modal modal-sm`).

**Create form fields:**
- Name (required, text input)
- Color (small swatch grid — 8 preset colors from a curated palette, plus a hex input for custom). Suggested presets matching Tailwind/DaisyUI aesthetic: `#6366f1` (indigo), `#22c55e` (green), `#f59e0b` (amber), `#ef4444` (red), `#06b6d4` (cyan), `#a855f7` (purple), `#f97316` (orange), `#64748b` (slate)
- Owner (optional staff user dropdown — if set, calendar appears in Teachers group). Populate from `staffUsers` prop. Show "None (organization calendar)" as first option.

**Edit form:** Same fields pre-filled. Add a "Delete calendar" button (with `window.confirm` confirmation) at the bottom. Deletion is hard-delete — activities retain their content, `calendar_id` becomes NULL.

**Mutations:** `useCreateCalendar(orgId)`, `useUpdateCalendar(orgId)`, `useDeleteCalendar(orgId)` from Layer 0.

### `staffUsers` data

`CalendarSidebar` needs staff users for the owner dropdown. `CalendarView` should fetch this via the existing `useUsers` hook (check `src/hooks/useUsers.js` for exact signature) and filter to staff roles, then pass as `staffUsers` prop.

---

## 7. `CalendarDayColumn.jsx`

Replaces `AgendaDayColumn.jsx`. Key correctness improvement: uses `activityMeetsToday` (full predicate) instead of the weaker `activityMeetsDay`.

**Props:**
```
date                    — Date object (the specific calendar date for this column)
schoolDay               — school_day record for this date (or null if not found)
activities              — activity[] — all activities for the org (pre-filtered by calendarVisibility)
enrollmentCountByActivity — Map<activityId, number>
gridStartMinutes        — number
onEmptyClick            — function(date, snappedTimeStr) — called on empty area click
onActivityClick         — function(activity)
```

**Filtering activities for this day:**

```javascript
import { activityMeetsToday } from '@/lib/scheduleUtils'
import { groupActivitiesByBlock } from '@/components/agenda/agendaUtils'

const todayActivities = useMemo(
  () => activities.filter((a) => activityMeetsToday(a, date, schoolDay)),
  [activities, date, schoolDay]
)
const blockGroups = useMemo(
  () => groupActivitiesByBlock(todayActivities, null),  // dayValue not needed — already filtered
  [todayActivities]
)
```

Wait — `groupActivitiesByBlock` takes a `dayValue` and filters internally. Since we've already filtered to this day's activities, call with a day value that always matches, or use it only for the block grouping (pass the actual DOW value so it works correctly). Check the agendaUtils source: `activityMeetsDay` is called inside `groupActivitiesByBlock`. Pass `date.getDay()` as the day value — it's harmless and ensures the group function's internal filter agrees.

**Density logic:** Identical to current `AgendaDayColumn`. For each block group:
- 1 activity → `mode='single'`
- 2–3 activities → `mode='few'`, split into side-by-side columns within the slot
- 4+ activities → `mode='aggregate'`

**Card positioning:** Use `activityTop(activity, gridStartMinutes)` and `activityHeight(activity)` from `@/components/agenda/agendaUtils` — unchanged.

**Min height:** `Math.max(activityHeight(activity), 24)` — same as current to prevent invisible cards.

**Empty area click:** Attach an `onClick` handler to the day column container. When the click target is the container itself (not a card):

```javascript
function handleColumnClick(e) {
  if (e.target !== e.currentTarget) return  // clicked a card, not the column
  const rect = e.currentTarget.getBoundingClientRect()
  const clickY = e.clientY - rect.top + (scrollTop or 0)
  const clickMinutes = gridStartMinutes + (clickY / PX_PER_HOUR) * 60
  // Snap to nearest 15 minutes
  const snapped = Math.round(clickMinutes / 15) * 15
  const hours = Math.floor(snapped / 60).toString().padStart(2, '0')
  const mins = (snapped % 60).toString().padStart(2, '0')
  onEmptyClick(date, `${hours}:${mins}`)
}
```

**Non-school day visual:** If `!schoolDay?.is_school_day`, apply `opacity-40` to the column content area and show a "No school" label in the column header area. The column still renders (it exists in the week) but is visually dimmed.

---

## 8. `CalendarWeekGrid.jsx`

Replaces `AgendaGrid.jsx`. Fixed block filter buttons and day filter buttons are removed — filtering handled by sidebar.

**Props:**
```
weekDates            — Date[5] — [Monday, Tuesday, ..., Friday] for the visible week
schoolDaysByDate     — { [isoDateStr]: schoolDay } — keyed by 'YYYY-MM-DD'
activities           — activity[] — pre-filtered by calendarVisibility
enrollmentCountByActivity — Map<activityId, number>
gridStartMinutes     — number
gridEndMinutes       — number
blockDefinitions     — blockDef[] — from useDefaultScheduleTemplate().data?.block_definitions
onEmptyClick         — function(date, timeStr)
onActivityClick      — function(activity)
```

**Structure:**
```
┌──────┬────────┬────────┬────────┬────────┬────────┐
│      │ Mon 30 │ Tue 31 │ Wed 1  │ Thu 2  │ Fri 3  │  ← CalendarDayHeader × 5
│ Time │        │        │        │        │        │
│  7a  ├────────┼────────┼────────┼────────┼────────┤
│  8a  │        columns with event cards             │
│  9a  │        [AgendaBlockOverlay behind cards]    │
│  ...  │                                           │
└──────┴────────┴────────┴────────┴────────┴────────┘
```

**Day header** (inline in CalendarWeekGrid, or extract as `CalendarDayHeader`):
- Shows: abbreviated weekday + date number + rotation label
- Example: "Mon · 30 · A" where "A" comes from `schoolDaysByDate['2026-03-30']?.rotation_day`
- Non-school days: add a subtle indicator ("holiday" or just dimmed text)

**Time axis:** Same as current `AgendaGrid` — 48px wide left column, hour labels from `Math.floor(gridStartMinutes/60)` to `Math.ceil(gridEndMinutes/60)`, formatted as "7a", "8a" ... "12p", "1p" etc.

**AgendaBlockOverlay — correctly wired at last:**
```jsx
<AgendaBlockOverlay
  blockDefinitions={blockDefinitions ?? []}
  gridStartMinutes={gridStartMinutes}
  blockLabels={blockLabels}  // from orgSettings
/>
```
This fixes the existing bug where `AgendaGrid` passes `blockCount` instead of definitions. `AgendaBlockOverlay` expects `blockDefinitions` — now it gets them from `useDefaultScheduleTemplate`.

**Hour gridlines:** Render horizontal lines at each hour boundary, same as current `AgendaGrid`. Use `z-index: 1`, cards at `z-index: 2`, block overlay at `z-index: 0`.

**Layout constants from agendaUtils:**
```javascript
import { PX_PER_HOUR, TIME_COL_WIDTH, DAY_COL_MIN_WIDTH, GRID_PAD_Y } from '@/components/agenda/agendaUtils'
```

---

## 9. `CalendarEventPopover.jsx`

Thin coordinator component — decides whether to show ActivityDetailModal in view or create mode.

**Props:**
```
activity     — activity object (view mode) or null (create mode)
prefillData  — { date, startTime, calendarId } (create mode only)
onClose      — function
orgId        — string
```

This component doesn't render its own popover UI — it opens the existing `ActivityDetailModal`:

```javascript
import { ActivityDetailModal } from '@/components/activities/ActivityDetailModal'
```

**View mode** (`activity !== null`): Render `ActivityDetailModal` with the existing activity. Use existing hooks/mutations pattern — `useUpdateActivity(orgId)` for saves.

**Create mode** (`activity === null`): Render `ActivityDetailModal` in edit mode with pre-filled default values derived from `prefillData`:
```javascript
const prefillActivity = {
  days_of_week: [prefillData.date.getDay()],
  default_start_time: prefillData.startTime,
  default_end_time: addMinutesToTime(prefillData.startTime, 60),  // default 1hr
  calendar_id: prefillData.calendarId ?? null,
}
```
Use `useCreateActivity(orgId)` for the save mutation. On success, close the popover.

**How CalendarView opens this:** CalendarView maintains local state:
```javascript
const [popover, setPopover] = useState(null)
// null | { activity } | { prefillData }
```
Passed via `onActivityClick` and `onEmptyClick` callbacks down through CalendarWeekGrid → CalendarDayColumn.

---

## 10. `CalendarFilterBar.jsx` (Stub)

Layer 1 scope: render the bar container with a placeholder. Full filter functionality is Layer 2.

```jsx
export function CalendarFilterBar() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-base-200">
      <input
        type="text"
        className="input input-bordered input-sm w-64"
        placeholder="Filter activities..."
        disabled
      />
    </div>
  )
}
```

---

## 11. `CalendarView.jsx`

Top-level component. Replaces `AgendaView` as the Dashboard centerpiece. Fetches all required data.

**Import:** `@/hooks/useCalendars`, `@/hooks/useActivities`, `@/hooks/useEnrollments` (useOrgEnrollments), `@/hooks/useSchoolDays`, `@/hooks/useScheduleTemplate` (useDefaultScheduleTemplate), `@/hooks/useOrgSettings`, `@/hooks/useUsers`, `@/store/uiStore`, `@/store/calendarUiStore`, all schedule-calendar components.

**Data fetching:**

```javascript
const { orgId } = useAuth()
const { data: activities = [] } = useActivities(orgId)
const { data: calendars = [] } = useCalendars(orgId)
const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)
const { data: template } = useDefaultScheduleTemplate(orgId)
const { data: orgSettings } = useOrgSettings(orgId)
const { data: allUsers = [] } = useUsers(orgId)

// Week anchor
const { selectedDate, setSelectedDate } = useUiStore()
const weekStart = getWeekStart(selectedDate ?? new Date())
const weekDates = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i))

// School days for the visible week
const { data: schoolDays = [] } = useSchoolDays(
  orgId,
  formatDateISO(weekDates[0]),
  formatDateISO(weekDates[4])
)
const schoolDaysByDate = useMemo(
  () => Object.fromEntries(schoolDays.map((sd) => [sd.date, sd])),
  [schoolDays]
)
```

**Calendar visibility filter:**

```javascript
const { isCalendarVisible } = useCalendarUiStore()
const visibleActivities = useMemo(
  () => activities.filter((a) =>
    a.calendar_id === null || isCalendarVisible(a.calendar_id)
  ),
  [activities, isCalendarVisible]
)
```

Activities with `calendar_id = null` (Unassigned) are always shown — no toggle can hide them.

**Enrollment count map:**

```javascript
const enrollmentCountByActivity = useMemo(() => {
  const map = {}
  orgEnrollments.forEach((e) => {
    map[e.activity_id] = (map[e.activity_id] ?? 0) + 1
  })
  return map
}, [orgEnrollments])
```

**Grid bounds (from agendaUtils, same as current AgendaView):**

```javascript
import { floorToHour, ceilToHour, timeToMinutes, DEFAULT_GRID_START, DEFAULT_GRID_END } from '@/components/agenda/agendaUtils'

const allTimes = visibleActivities.flatMap((a) => [a.default_start_time, a.default_end_time].filter(Boolean))
const gridStart = allTimes.length ? floorToHour(Math.min(...allTimes.map(timeToMinutes))) : timeToMinutes(DEFAULT_GRID_START)
// ... same as AgendaView
```

Wait — `floorToHour` takes a time string not minutes. Replicate the same pattern as `AgendaView.jsx` exactly.

**Layout:**

```
┌────────────────────────────────────────────────────┐
│ CalendarWeekNav                                    │  top bar
│ CalendarFilterBar                                  │  filter bar
├──────────────┬─────────────────────────────────────┤
│              │                                     │
│ CalendarSidebar│ CalendarWeekGrid                 │
│              │                                     │
└──────────────┴─────────────────────────────────────┘
```

Full height layout. Sidebar and grid share a `flex` row. Grid area takes `flex-1`. The grid scrolls vertically (same `max-h-[70vh] overflow-y-auto` as current, or adjust height to fill viewport).

**Staff users for sidebar:** Filter `allUsers` to staff roles:
```javascript
const staffUsers = allUsers.filter((u) => u.role === 'teacher' || u.role === 'admin')
```

---

## 12. Update `Dashboard.jsx`

**File:** `src/pages/admin/Dashboard.jsx`

After Layer 1, Dashboard becomes a thin wrapper. `CalendarView` fetches its own data.

Before modifying, read the current Dashboard to understand what AppLayout provides (header, nav) vs. what Dashboard adds. If Dashboard adds no meaningful layout (just AgendaView + toolbar), gut it:

```jsx
import { CalendarView } from '@/components/schedule-calendar/CalendarView'
import { useAuth } from '@/hooks/useAuth'

export default function Dashboard() {
  const { orgId } = useAuth()
  return <CalendarView orgId={orgId} />
}
```

Remove:
- `useActivities`, `useOrgEnrollments`, `useOrgSettings` imports (now inside CalendarView)
- `AgendaView` import
- `DashboardToolbar` import + component (discard it)
- `agendaFocusedBlock`, `agendaFocusedDay`, `clearAgendaFocus` from uiStore usage
- `scheduledActivities` computed filter

If AppLayout wraps Dashboard with a page container div, CalendarView should be aware and use `h-full` to fill it properly.

---

## 13. Retire Old Agenda Components

**Before deleting:** Grep for any remaining imports of these files:
```bash
grep -r "AgendaView\|AgendaGrid\|AgendaDayColumn\|AgendaCard" src/ --include="*.jsx" --include="*.js" -l
```

Should only match the files themselves after Dashboard.jsx is updated. If any other file still imports them, update those imports first.

**Delete:**
- `src/components/agenda/AgendaView.jsx`
- `src/components/agenda/AgendaGrid.jsx`
- `src/components/agenda/AgendaDayColumn.jsx`
- `src/components/agenda/AgendaCard.jsx`

**Keep (imported by new calendar components):**
- `src/components/agenda/agendaUtils.js`
- `src/components/agenda/AgendaBlockOverlay.jsx`

---

## Data Flow Summary

```
CalendarView (orgId)
  ├── useActivities(orgId)               → activities[] with calendar join
  ├── useCalendars(orgId)                → calendars[]
  ├── useOrgEnrollments(orgId)           → orgEnrollments[]  [hook: useEnrollments.js]
  ├── useSchoolDays(orgId, mon, fri)     → schoolDays[]
  ├── useDefaultScheduleTemplate(orgId) → template { block_definitions[] }
  ├── useOrgSettings(orgId)             → { block_count, block_labels, rotation_day_names }
  └── useUsers(orgId)                   → allUsers[] (filtered to staff for sidebar owner picker)

  Computed:
  ├── weekStart (Monday of selectedDate's week)
  ├── weekDates [Mon..Fri] Date objects
  ├── schoolDaysByDate { 'YYYY-MM-DD': schoolDay }
  ├── enrollmentCountByActivity { activityId: count }
  ├── visibleActivities (filtered by calendarVisibility — unassigned always shown)
  └── gridStartMinutes / gridEndMinutes (from agendaUtils bounds logic)

  Renders:
  ├── CalendarWeekNav      (week arrows + date range display)
  ├── CalendarFilterBar    (stub search bar)
  ├── CalendarSidebar      (toggle chips + calendar CRUD)
  └── CalendarWeekGrid     (time grid with 5 day columns + block overlay)
       └── CalendarDayColumn × 5
            └── CalendarEventCard × N
  (CalendarEventPopover opens conditionally when event/empty-slot clicked)
```

---

## Verification

1. **Navigate to `/admin`** — CalendarView renders without errors. Week grid shows Mon–Fri with current week.

2. **Week navigation:** Prev/next arrows update the displayed week. Today button returns to current week. Date range label in nav bar updates.

3. **Sidebar toggle:** Toggle a calendar off — its event cards disappear from the grid. Toggle back on — they reappear. Refresh the page — toggle state persists (calendarUiStore persists to localStorage).

4. **Sidebar minimize:** Click minimize button — sidebar collapses to color dots. Clicking a dot still toggles. Click expand — full sidebar returns.

5. **Calendar create:** Click "+ Add calendar" — modal opens. Fill name + color + optional owner. Submit — calendar appears in sidebar. Check Supabase that row was inserted.

6. **Calendar edit/delete:** Click calendar name in sidebar — edit modal opens. Change color — color dot updates. Delete — calendar removed, its activities become unassigned.

7. **Block overlay:** Block bands should render with correct times (not empty/invisible as before). Requires org to have a default schedule template with block definitions.

8. **Activity cards:** Cards show calendar color as left border. Single-mode cards show name, teacher, enrollment count, time range.

9. **Non-school days:** For a day marked as non-school in the calendar management UI, the day column in the week grid should show dimmed/opacity-reduced content.

10. **Click empty slot:** Click on empty area in a day column — ActivityDetailModal opens in create/edit mode with `days_of_week` and `default_start_time` pre-filled.

11. **Click existing event:** Click a card — ActivityDetailModal opens showing that activity's details.

12. **`activityMeetsToday` predicate:** Activities with `rotation_day_type` set should only appear on matching rotation days. Activities with `start_date`/`end_date` should only appear within their date range. (These were always supposed to work in the agenda — but now they'll actually be tested since the calendar uses the full predicate.)

13. **`npm run build`** — no TypeScript/build errors after deleting old agenda components.

---

## Codebase Quirks to Watch

- **`useUsers` signature:** Check `src/hooks/useUsers.js` for exact hook name and return shape before using it in CalendarView. It may return `{ data: users }` or a different structure.
- **`useDefaultScheduleTemplate` vs `useScheduleTemplate`:** Verify the exact export name in `src/hooks/useScheduleTemplate.js`. The explore found `useDefaultScheduleTemplate`.
- **`addDays` / `subDays`:** These exist in `src/lib/scheduleUtils.js` — import from there rather than installing date-fns.
- **`formatDateISO`:** Also in `src/lib/scheduleUtils.js`.
- **Block labels:** `orgSettings?.block_labels` — may be null if not set. Pass through to `AgendaBlockOverlay` as-is; the component handles null gracefully.
- **agendaUtils import path:** Use `@/components/agenda/agendaUtils` — the utility stays in its current location since only import paths reference it, not the component tree.
