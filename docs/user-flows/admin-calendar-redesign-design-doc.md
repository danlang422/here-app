# Calendar-Centric Redesign — Design Document

**Created:** March 28, 2026  
**Updated:** March 28, 2026 (design questions resolved, gaps filled for build spec handoff)  
**Status:** Design complete — ready for Claude Code to write build specs  
**Context:** Extended conversation about rethinking how activities are created, organized, and viewed. Driven by real schedule-entry friction (unsupported recurrence patterns, ambiguity about attendance responsibility, lack of source-based grouping) and the observation that the interaction patterns the admin needs already exist in calendar apps.

**Purpose of this document:** This is a pre-build-spec design doc. It captures all settled decisions, resolved design questions, and implementation guidance so that Claude Code can read it alongside the codebase and produce detailed build spec(s). Claude Code should treat this as the "what and why" — it should write the "how" after examining the actual code.

---

## The Core Insight

Activities should feel like calendar events with school-specific superpowers. The data model is already close — activities have times, dates, recurrence, and attendees (enrollments). But the UI and workflow don't leverage familiar calendar-app interaction patterns: togglable calendar layers, click-to-create, week/month views with filtering. The redesign aligns the interface with the mental model the admin is already using when building schedules.

**The vibe: Google Calendar plus cool school stuff.** Not a custom enterprise tool with toolbars and floating panels — a calendar that happens to understand blocks, rotation days, and enrollment.

This is primarily a UI/interaction shift, not a data model overhaul. The "everything is an activity" architectural decision and the behavior-flag approach remain unchanged.

---

## Key Decisions (Settled)

### Activities-as-events mental model

Activities are events. Students are attendees. The teacher assigned via `teacher_id` is the organizer — they own the event and take attendance. External activities (college courses, external HS courses) have no organizer in the system; they carry metadata (`instructor_name`, `mentor_name`) but no user who takes attendance.

This was validated by a real-world discovery: City View teachers are NOT taking attendance for students in Kirkwood classes. Attendance for external activities is handled by the external organization. This simplifies the app — `requires_attendance` is false for external activities, and the monitor/mentor roles become purely contextual (providing info on student agendas without driving system behavior).

### Multi-calendar layer model

Activities are grouped into calendars, analogous to togglable calendars in Google Calendar:

**Source calendars (org-level):** Kirkwood Community College, Kennedy HS, Washington HS, internship partners, etc. These represent external organizations whose schedules constrain City View students. Admin-created, no owner. Used for filtering and visual grouping in the calendar UI.

**Teacher calendars (user-owned):** Each teacher's classes live on their calendar. The teacher is the `owner_id` on the calendar record. When the admin creates "Bio 2" and assigns a teacher, it goes on that teacher's calendar. The admin can toggle teacher calendars on/off to focus on specific parts of the schedule.

**Implementation:** `calendars` table with `organization_id`, `name`, `color`, `owner_id` (nullable). Activities get a `calendar_id` FK. See migration `20260328000000_calendars.sql`.

### Per-student schedule exceptions via activity splitting, not enrollment overrides

When a student's schedule doesn't match the group (e.g., "Trevor is in Advisory M-F except Tuesday because of his internship"), the solution is to remove the student from the M-F activity and create a copy with the adjusted schedule (M, W, Th, F), then enroll them in the copy.

This keeps enrollments simple and honest — enrollment means "you attend this activity on all days it meets." No hidden per-enrollment day overrides, no runtime exception logic. The teacher's agenda aggregates both activities into the same block anyway.

A future convenience feature ("create instance for selected") could streamline this: select students, click split, and the system removes them from the original and creates the copy for editing. But the underlying approach is manual splitting, which is already possible today.

### Recurrence interval support

Added `recurrence_interval` (default 1 = every week) and `recurrence_anchor_date` to activities. This supports the every-other-Friday pattern that was the original catalyst.

See migration `20260328000001_activity_recurrence_interval.sql`.

---

## Resolved Design Questions

These were open questions in the original doc. All are now settled.

### Calendar view fully replaces the current agenda view

The current `AgendaView` is broken and not functioning as intended. The calendar view replaces it completely — no transition period, no coexistence. When Layer 1 ships, the old agenda components are retired.

### No toolbar or floating panels — everything lives in the calendar UI

The previous design direction (from `admin-dashboard.md`) envisioned a toolbar with filter popovers, property toggles, and panel launch icons, plus floating panels for contextual tools. **This is discarded.** The Google Calendar mental model doesn't have floating panels and toolbars — it has a sidebar with calendar toggles and a main grid. That's the target.

Specifically:
- **Calendar toggles** → Left sidebar (collapsible). Grouped into foldable sections: "Teachers" (all teacher-owned calendars), "Organizations" (Kirkwood, Kennedy, etc.), potentially other groupings as they emerge. Each calendar has a color swatch and on/off toggle. The sidebar can minimize to a narrow strip (color dots only, still toggleable).
- **Filtering and search** → Top bar area, combined with contextual filter patterns that emerge from UI interactions. For example: clicking a student in a roster or enrollment context could filter the calendar to that student's activities. The top-level search/filter bar provides the "I want to find something specific" entry point; in-context interactions provide the "show me more about this thing I'm looking at" path.
- **Activity creation and editing** → Happens through popover/modal triggered from the calendar grid itself (click a time slot to create, click an existing event to view/edit).

### Aggregation threshold starts at 3–4, not customizable initially

When more than 3 activities overlap in the same time slot, aggregate into a summary card. The existing `DENSITY_AGG_MIN = 4` constant in `agendaUtils.js` is close — use 4 as the initial threshold. Design the implementation so the threshold can be made configurable later (it's already a named constant, so this is mostly a matter of eventually surfacing it in settings).

### Calendar colors — use sensible defaults, defer palette work

The `calendars` migration already defaults color to `#6366f1` (Tailwind indigo-500). For Layer 1, use a small default palette that Claude Code can pick based on what works with DaisyUI's existing theme. Apply calendar color as a left border or subtle background tint on event cards. A broader UI/color overhaul is planned for later — don't over-invest in the color system now.

### Calendars should have a settings surface (future)

Calendars (we're just calling them "calendars," not "sources") should eventually have associated settings — things like linking a calendar to specific terms, flagging a calendar as "external organization" (auto-setting `requires_attendance = false` on new activities), or attaching custom schedule patterns. **Layer 1 does not build this settings UI.** But the data model and component architecture should be aware it's coming — don't make decisions that would make a calendar settings panel awkward to add later.

### uiStore evolution for week-based navigation

The current `uiStore` has:
- `selectedDate` — a single `Date` that drives which day's schedule is displayed
- `agendaFocusedBlock` / `agendaFocusedDay` — filter/zoom state for the current agenda grid

For the calendar redesign:
- **`selectedDate` becomes the week anchor.** The calendar view shows the week containing `selectedDate`. Week navigation (prev/next buttons) updates `selectedDate` to the corresponding Monday (or equivalent anchor day).
- **`agendaFocusedBlock` and `agendaFocusedDay` are retired.** The new calendar view handles filtering through the sidebar toggles and search/filter bar, not through clicking day headers and block chips. These store fields can be removed once the old agenda components are deleted.
- **New state needed:** Calendar toggle state (which calendars are visible). This could live in `uiStore` with persistence, or in a new dedicated store. Also: active student/filter state for "show me this student's schedule" mode. Claude Code should decide the cleanest approach based on what patterns the codebase already uses.

---

## Layered Implementation Plan

### Layer 0 — Schema Foundations + Predicate Updates

**Migrations (written, ready to apply):**

- `20260328000000_calendars.sql` — Creates `calendars` table, adds `calendar_id` FK on activities, RLS policies
- `20260328000001_activity_recurrence_interval.sql` — Adds `recurrence_interval` and `recurrence_anchor_date` to activities

**Code updates required after applying migrations:**

1. **Update `activityMeetsToday` in `src/lib/scheduleUtils.js`** — Add recurrence interval branch:
   ```
   if activity.recurrence_interval > 1:
     anchor = activity.recurrence_anchor_date
     if anchor is set:
       daysSinceAnchor = daysBetween(anchor, date)
       weeksSinceAnchor = floor(daysSinceAnchor / 7)
       if weeksSinceAnchor % recurrence_interval != 0: return false
   ```

2. **Update `couldMeetOnSameDay` in `src/lib/enrollmentValidation.js`** — Two activities on the same day-of-week but different recurrence intervals (or different anchor dates) may not actually conflict. The conflict detection should account for this. Note: this is a refinement, not a blocker — false positives (flagging non-conflicts as conflicts) are safe; false negatives (missing real conflicts) would be problematic.

3. **Update schema docs** — `docs/schema/03-activities.md` for new columns. Add `docs/schema/XX-calendars.md` for the new table.

4. **Update `ActivityDetail` form** — Expose `recurrence_interval`, `recurrence_anchor_date`, and `calendar_id` fields. Calendar selection should be a dropdown populated from the org's calendars.

5. **API functions and hooks for calendars CRUD** — New file `src/api/calendars.js` with `getCalendars(orgId)`, `createCalendar(calendar)`, `updateCalendar(id, updates)`, `deleteCalendar(id)`. New hook `src/hooks/useCalendars.js` wrapping these with TanStack Query.

6. **Update `getActivities`** — The existing query in `src/api/activities.js` should join `calendar:calendars(id, name, color)` so calendar info is available wherever activities are fetched.

### Layer 1 — Calendar View (Primary Admin Schedule Interface)

**This is the big build.** A week-based calendar view replaces the current `AgendaView` as the admin dashboard centerpiece.

#### Component Architecture

**What gets retired:**
- `AgendaView.jsx` — replaced by new `CalendarView`
- `AgendaGrid.jsx` — replaced by new `CalendarWeekGrid`
- `AgendaDayColumn.jsx` — replaced by new `CalendarDayColumn`
- `AgendaCard.jsx` — replaced by new `CalendarEventCard`

**What carries forward as shared utilities:**
- `agendaUtils.js` — Time-to-pixel math (`timeToMinutes`, `minutesToPx`, `activityTop`, `activityHeight`), grid bounds computation (`floorToHour`, `ceilToHour`), density constants. These are pure functions that don't depend on the old component tree.
- `AgendaBlockOverlay.jsx` — The block-band overlay renders alternating block backgrounds on a time grid. Its interface (`blockDefinitions`, `gridStartMinutes`, `blockLabels`) is already clean and component-agnostic. Can be reused as-is in the new calendar grid.

**What is NOT related to this feature (avoid confusion):**
- `src/components/calendar/CalendarGrid.jsx` — This is the **school-day calendar management** UI (month view for marking days off, holidays, rotation days). It lives on the `/admin/calendar` route. Completely separate from the schedule calendar view being built here. Do not modify or merge.
- `src/components/calendar/DayPopover.jsx` — Same: school-day management popover. Unrelated.

**New components to build (suggested structure, Claude Code should adapt as needed):**

```
src/components/schedule-calendar/
├── CalendarView.jsx           — Top-level wrapper (replaces AgendaView)
├── CalendarSidebar.jsx        — Left sidebar with calendar toggles
├── CalendarWeekGrid.jsx       — Week grid with time axis + day columns
├── CalendarDayColumn.jsx      — Single day column with event cards
├── CalendarEventCard.jsx      — Individual event card (replaces AgendaCard)
├── CalendarWeekNav.jsx        — Week navigation (prev/next/today + date headers)
├── CalendarFilterBar.jsx      — Top search/filter bar
└── CalendarEventPopover.jsx   — Click-on-event detail popover / click-to-create
```

The directory name `schedule-calendar` is suggested to disambiguate from the existing `calendar/` directory (school-day management). Claude Code may choose a different name if something feels cleaner.

#### Data Requirements

The calendar view needs these data sources. The current `Dashboard.jsx` only fetches activities and enrollments — the new view needs more:

| Data | Source | Hook | Status |
|------|--------|------|--------|
| Activities (with calendar join) | `activities` table | `useActivities` | Exists, needs calendar join added |
| Calendars | `calendars` table | `useCalendars` | **New** — Layer 0 deliverable |
| Org enrollments (for counts) | `enrollments` table | `useOrgEnrollments` | Exists |
| School days for visible week | `school_days` table | `useSchoolDays` | Exists (used by CalendarManagement) |
| Schedule template (block defs) | `schedule_templates` table | `useDefaultScheduleTemplate` | Exists (used by OrgSettings) |
| Org settings (block count, rotation config) | `organizations.settings` | `useOrgSettings` | Exists |

The school days data is needed to: (a) show rotation day labels in day column headers, (b) feed `activityMeetsToday` for determining which activities appear on which days, and (c) gray out non-school days.

#### Sidebar Design

The sidebar is new UI with no precedent in the codebase. Key behaviors:

- **Expanded state:** Full sidebar panel (200-250px) showing calendar names with color swatches and toggle checkboxes. Calendars grouped into foldable sections. Initial groups: "Teachers" (calendars with `owner_id` set), "Organizations" (calendars without `owner_id`). Group headers are clickable to toggle all calendars in the group.
- **Minimized state:** Narrow strip (~40px) showing only color dots. Clicking a dot toggles that calendar. A small expand button restores the full sidebar.
- **State management:** Which calendars are toggled on/off should persist (at minimum within a session, ideally across sessions via `uiStore` persist). Default: all calendars visible.
- **Unassigned activities:** Activities with `calendar_id = NULL` should always be visible regardless of calendar toggle state (they belong to no calendar, so no toggle can hide them). Consider showing an "Unassigned" pseudo-group in the sidebar to surface these.

#### Week Grid Design

The week grid follows the same structural pattern as the existing `AgendaGrid` but with key differences:

- **Day columns show real dates** (not just "Monday," "Tuesday"). Headers should show day name + date + rotation day label (from school days data). Example: "Mon Mar 30 · A"
- **Non-school days are visually dimmed** but still shown (a holiday still exists in the week; activities assigned to that day should render with a visual indicator that it's a non-school day).
- **Filtering is driven by sidebar toggles**, not by block/day click-to-focus. When calendars are toggled off, their activities simply don't render.
- **Block overlay carries forward** — use `AgendaBlockOverlay` with `blockDefinitions` from the schedule template. This provides visual context for where blocks fall on the time grid.

#### Event Card Design

Cards should display:
- Activity name (always)
- Calendar color indicator (left border or background tint matching the calendar's color)
- Time range (when space permits)
- Teacher name (when space permits)
- Enrollment count (when space permits)

Density modes carry forward from the current design:
- **Single:** Full detail card (1 activity in the time slot within visible calendars)
- **Few (2–3):** Side-by-side cards with reduced detail
- **Aggregate (4+):** Summary card ("5 activities, 47 students") — clicking it could expand or filter

#### Activity Creation from Calendar

**Layer 1 scope: Click-to-create only.** No drag-to-create — there's no drag infrastructure in the app currently, and it's not worth building for this iteration.

Behavior: clicking an empty area in a day column opens the activity creation flow (existing `ActivityDetail` form) with pre-filled values:
- `days_of_week` pre-set to the clicked day
- `default_start_time` and `default_end_time` pre-set based on the clicked time position (snap to nearest 15-minute increment)
- `calendar_id` pre-set to the currently-selected/most-recently-used calendar, or the first visible calendar

This can be implemented as a popover that appears at the click location with a "quick create" form, or by opening the existing `ActivityDetailModal` with pre-filled values. Claude Code should evaluate which approach fits better with existing patterns.

#### Week Navigation

Controls needed:
- Previous/next week arrows
- "Today" button (jumps to current week)
- Date range display ("Mar 30 – Apr 3, 2026")

This updates `selectedDate` in `uiStore`. The grid derives its visible week from `selectedDate` (Monday through Friday of that week).

#### Dashboard Integration

`Dashboard.jsx` currently renders `DashboardToolbar` + `AgendaView`. After Layer 1:
- `DashboardToolbar` is replaced or heavily modified — the calendar has its own nav and filter UI
- `AgendaView` is replaced by `CalendarView`
- The data fetching in `Dashboard.jsx` needs to expand (see Data Requirements table above)

Whether `Dashboard.jsx` becomes a thin wrapper around `CalendarView` or the calendar view absorbs the dashboard role is an implementation decision for Claude Code.

### Layer 2 — Gap Detection & Convenience (Future, not in scope)

- Per-student gap computation: for each block/time slot, surface unscheduled time
- Freeform block auto-suggestion for gaps
- "Create instance for selected" (split-and-copy convenience feature)
- Month view (heavily aggregated or filtered)
- Drag-to-create events
- Calendar settings UI (term associations, external-org flags)
- Per-day recurrence intervals (e.g., MWF but F is every other week — currently requires splitting into two activities)
- Multi-student overlay/comparison

---

## Relationship to Existing Specs

### `student-schedule-view-build-spec.md` — Superseded

The student schedule view was designed as a standalone component showing one student's weekly schedule. Under the calendar redesign, this becomes a filtered mode of the unified calendar view: apply a student filter, and you see their enrolled activities across all calendars. The data derivations (grid bounds, activities-for-date, rotation resolution) and card rendering spec remain useful reference — they'll inform the calendar view's card design. But the separate component tree is unnecessary.

**Status: Do not build as specced.** Retain for reference during Layer 1 design.

### `admin-dashboard.md` — Partially superseded

The dashboard concept (agenda as centerpiece, contextual tools) is still valid in spirit. The calendar view replaces the agenda view as the centerpiece. The toolbar, floating panels, and panel interaction patterns described in that doc are **discarded** in favor of the Google Calendar-style sidebar + grid approach.

### `agenda-view-build-spec.md` — Implementation superseded, utility code retained

The current `AgendaView` and `AgendaGrid` components will be replaced by the calendar view. However, `agendaUtils.js` (time positioning math, density constants) and `AgendaBlockOverlay` carry forward as shared utilities.

---

## What the Admin Workflow Looks Like (Narrative)

This is how schedule-building should feel with the calendar redesign:

**Setup:** Admin creates calendars — "Kirkwood," "Kennedy HS," "Washington HS," "Internships." Teacher calendars are auto-created or admin-created and assigned an owner.

**Placing immovable activities:** Admin selects the "Kirkwood" calendar (via sidebar or a calendar selector in the creation flow). Creates activities for each college course — "Kirkwood Comp 1, MWF 9-10am, Jan 20 – May 15." Adds enrolled students as attendees. Sets `instructor_name`. `requires_attendance = false` (Kirkwood handles it). These are the constraints everything else works around.

**Placing internal classes:** Admin clicks on a Tuesday 9:55am slot in the calendar grid. Activity creation opens with times and day pre-filled. Names it "Bio 2," assigns it to a teacher's calendar. Adds students. Teacher is automatically the organizer (attendance-taker).

**Seeing the picture:** Admin has all calendars toggled on. Uses the filter bar to filter to a specific student. Sees their full week — Kirkwood course on MWF mornings, Bio 2 on TuTh, Advisory M-F block 0. Gaps are visible as empty space on the grid.

**Toggling focus:** Admin turns off the "Kirkwood" and "Kennedy HS" calendars in the sidebar. Now they see only City View internal activities and internships — useful for seeing what the City View teachers' weeks look like without the noise of external schedules.

**Handling exceptions:** Admin sees that one student in M-F Advisory has a Tuesday conflict. Removes the student from the M-F activity and creates a copy for M, W, Th, F. Both show up in the same block on the teacher's view. (Layer 2 will add a convenience feature to automate this split.)

---

## Codebase Integrity Notes for Claude Code

A few things to watch for when writing build specs:

1. **The `getActivities` query joins teacher and monitor profiles and activity_terms.** Adding a calendar join should follow the same pattern. Make sure the join doesn't break the existing term-filter logic (client-side filter on `activity_terms`).

2. **`activityMeetsDay` in `agendaUtils.js` is a simpler version of `activityMeetsToday` in `scheduleUtils.js`.** The agenda utils version only checks `days_of_week`; the schedule utils version also checks `is_active`, `is_not_scheduled`, date range, school day status, and rotation day. The calendar view should use `activityMeetsToday` (the full predicate) since it has access to school day data.

3. **The existing `AgendaGrid` receives a `blockCount` prop but `AgendaBlockOverlay` expects `blockDefinitions` (from the schedule template).** Looking at the current `Dashboard.jsx`, it passes `blockCount` to `AgendaGrid` but the overlay may not actually be rendering with full block definitions. The new calendar view should feed the overlay properly from `useDefaultScheduleTemplate` data.

4. **RLS on the new `calendars` table.** The migration has policies for org-scoped read (all authenticated users) and admin-only write. This matches the existing RLS pattern. No issues expected, but Claude Code should verify the RLS approach is consistent with how other tables work (check `docs/schema/10-rls-policies.md`).

5. **`uiStore` uses `create` from Zustand without `persist` middleware** (unlike `authStore` which persists role selection). Calendar toggle state should probably persist — consider adding `persist` middleware for the calendar-specific slice, or creating a separate persisted store.

---

## File References

| File | Relevance |
|------|-----------|
| `supabase/migrations/20260328000000_calendars.sql` | Calendars table + activity FK (Layer 0) |
| `supabase/migrations/20260328000001_activity_recurrence_interval.sql` | Recurrence interval columns (Layer 0) |
| `src/lib/scheduleUtils.js` | `activityMeetsToday` — needs recurrence branch (Layer 0) |
| `src/lib/enrollmentValidation.js` | Conflict detection — needs recurrence awareness (Layer 0) |
| `src/components/agenda/agendaUtils.js` | Time positioning utilities — carries forward as shared code |
| `src/components/agenda/AgendaBlockOverlay.jsx` | Block overlay — reusable in new calendar grid |
| `src/components/agenda/AgendaView.jsx` | Being replaced — reference for current data flow |
| `src/components/agenda/AgendaGrid.jsx` | Being replaced — reference for grid patterns |
| `src/components/agenda/AgendaDayColumn.jsx` | Being replaced — reference for density/positioning logic |
| `src/components/agenda/AgendaCard.jsx` | Being replaced — reference for card rendering |
| `src/pages/admin/Dashboard.jsx` | Integration point — currently renders AgendaView |
| `src/store/uiStore.js` | Needs evolution — week anchor, calendar toggles, retire focus state |
| `src/api/activities.js` | Needs calendar join on `getActivities` query |
| `src/hooks/useActivities.js` | May need filter-by-calendar support |
| `src/hooks/useScheduleTemplate.js` | Provides block definitions for overlay |
| `src/hooks/useSchoolDays.js` | Provides rotation day data for headers |
| `src/components/calendar/CalendarGrid.jsx` | **NOT related** — school-day management, don't touch |
| `src/components/calendar/DayPopover.jsx` | **NOT related** — school-day management, don't touch |
| `docs/schema/03-activities.md` | Needs update for new columns |
| `docs/business-logic/01-schedule-and-calendar.md` | `activityMeetsToday` algorithm docs |
| `docs/user-flows/student-schedule-view-build-spec.md` | Superseded but useful reference |
| `docs/user-flows/admin-dashboard.md` | Partially superseded — toolbar/panel patterns discarded |
| `docs/user-flows/agenda-view-build-spec.md` | Implementation superseded, utility patterns retained |