# Calendar-Centric Redesign — Design Document

**Created:** March 28, 2026  
**Status:** Design — Layer 0 migrations written, Layer 1 design pending  
**Context:** Extended conversation about rethinking how activities are created, organized, and viewed. Driven by real schedule-entry friction (unsupported recurrence patterns, ambiguity about attendance responsibility, lack of source-based grouping) and the observation that the interaction patterns Daniel needs already exist in calendar apps.

---

## The Core Insight

Activities should feel like calendar events with school-specific superpowers. The data model is already close — activities have times, dates, recurrence, and attendees (enrollments). But the UI and workflow don't leverage familiar calendar-app interaction patterns: togglable calendar layers, drag-to-create, week/month views with filtering. The redesign aligns the interface with the mental model the admin is already using when building schedules.

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

Added `recurrence_interval` (default 1 = every week) and `recurrence_anchor_date` to activities. This supports the every-other-Friday pattern that was the original catalyst. The `activityMeetsToday` predicate needs a new branch:

```
if activity.recurrence_interval > 1:
  weeksSinceAnchor = floor(daysBetween(anchor, date) / 7)
  if weeksSinceAnchor % recurrence_interval != 0: return false
```

See migration `20260328000001_activity_recurrence_interval.sql`.

---

## Layered Implementation Plan

### Layer 0 — Schema Foundations (Done)

**Migrations written, ready to apply:**

- `20260328000000_calendars.sql` — Creates `calendars` table, adds `calendar_id` FK on activities, RLS policies
- `20260328000001_activity_recurrence_interval.sql` — Adds `recurrence_interval` and `recurrence_anchor_date` to activities

**Still needed after applying migrations:**

- Update `activityMeetsToday` in `src/lib/scheduleUtils.js` with the recurrence interval branch
- Update `couldMeetOnSameDay` in `src/lib/enrollmentValidation.js` to account for recurrence interval in conflict detection (two activities on the same day but different recurrence intervals may not actually conflict)
- Update schema docs (`docs/schema/03-activities.md`) with new columns
- Add schema doc for calendars table
- Update `ActivityDetail` form to expose recurrence interval and calendar selection
- API functions and hooks for calendars CRUD

### Layer 1 — Calendar View + Source Model (Next Major Feature)

**This is the big one.** Build a calendar-style week view as the primary admin schedule interface. This effectively supersedes or unifies:

- The current `AgendaView` (admin dashboard centerpiece)
- The specced but unbuilt `StudentScheduleView`
- Any future "teacher schedule overview"

They all become the same view with different filters applied.

**What Layer 1 includes:**

1. **Calendar week view** — Time-axis grid with day columns (reuses existing grid infrastructure from `agendaUtils.js` and `AgendaBlockOverlay`). Week navigation with date headers showing rotation day. Visual block overlay from schedule template.

2. **Calendar sidebar/toggles** — List of calendars with color swatches and on/off toggles. Toggling a calendar shows/hides all activities on that calendar. Teacher calendars and source calendars are visually grouped.

3. **Filtering** — By student (show one student's enrolled activities across all calendars), by teacher/organizer (show one teacher's calendar), by block, by time range. Filters compose with calendar toggles.

4. **Aggregation threshold** — When too many activities overlap in the same time slot, aggregate into a summary card ("5 activities, 47 students") rather than rendering each one. Threshold is configurable or adaptive.

5. **Activity creation from the calendar** — Click or drag on a time slot to create a new activity with pre-filled times, day, and block. Assigns to the appropriate calendar based on context.

6. **Source/calendar management UI** — Admin can create, name, and color-code calendars. Assign existing activities to calendars. Set teacher ownership on teacher calendars.

**What Layer 1 does NOT include (deferred to Layer 2):**

- Gap detection / unscheduled time surfacing
- Freeform block auto-suggestion
- "Create instance for selected" split feature
- Month view
- Multi-student overlay/comparison

**Key design questions to resolve in Layer 1 spec:**

- Does the calendar view fully replace the current agenda view, or coexist during transition?
- How does the toolbar change? Current toolbar has filter popover + property toggle icons + panel icons. Calendar toggles might live in a sidebar instead of the toolbar.
- What's the aggregation threshold? Fixed number (e.g., 4+), or adaptive based on available space?
- How do calendar colors interact with existing card styling? Color as left border? Background tint?
- Does the "source" concept need any settings beyond name + color? (e.g., a flag for "external organization" that auto-sets `requires_attendance = false` on new activities?)
- How does week navigation interact with the existing single-day focus state from `uiStore`?

### Layer 2 — Gap Detection & Convenience (Future)

- Per-student gap computation: for each block/time slot, surface unscheduled time
- Freeform block auto-suggestion for gaps
- "Create instance for selected" (split-and-copy convenience feature)
- Month view (heavily aggregated or filtered)
- Per-day recurrence intervals (e.g., MWF but F is every other week — currently requires splitting into two activities)

---

## Relationship to Existing Specs

### `student-schedule-view-build-spec.md` — Superseded

The student schedule view was designed as a standalone component showing one student's weekly schedule. Under the calendar redesign, this becomes a filtered mode of the unified calendar view: apply a student filter, and you see their enrolled activities across all calendars. The data derivations (grid bounds, activities-for-date, rotation resolution) and much of the card rendering spec remain useful — they'll inform the calendar view's card design. But the separate component tree is unnecessary.

**Status: Do not build as specced.** Retain for reference during Layer 1 design.

### `admin-dashboard.md` — Partially superseded

The dashboard concept (agenda as centerpiece, floating panels for contextual tools) is still valid. The calendar view replaces the agenda view as the centerpiece. Floating panels, toolbar, and the "schedule-building workspace" framing carry forward. The document's UI layout and panel interaction patterns remain relevant.

### `agenda-view-build-spec.md` — Implementation superseded, patterns retained

The current `AgendaView` and `AgendaGrid` components will eventually be replaced by the calendar view. However, the grid infrastructure (`agendaUtils.js`, `AgendaBlockOverlay`, time positioning math) carries forward as shared utilities.

---

## What the Admin Workflow Looks Like (Narrative)

This is how schedule-building should feel with the calendar redesign:

**Setup:** Admin creates calendars — "Kirkwood," "Kennedy HS," "Washington HS," "Internships." Teacher calendars are auto-created or admin-created and assigned an owner.

**Placing immovable activities:** Admin selects the "Kirkwood" calendar. Creates activities for each college course — "Kirkwood Comp 1, MWF 9-10am, Jan 20 – May 15." Adds enrolled students as attendees. Sets `instructor_name`. `requires_attendance = false` (Kirkwood handles it). These are the constraints everything else works around.

**Placing internal classes:** Admin selects a teacher's calendar. Creates "Bio 2" — clicks on a Tuesday 9:55am slot, drags to 10:40, activity creation form opens with times/day pre-filled. Adds students. Teacher is automatically the organizer (attendance-taker).

**Seeing the picture:** Admin toggles all calendars on. Filters to a specific student. Sees their full week — Kirkwood course on MWF mornings, Bio 2 on TuTh, Advisory M-F block 0 (well, M W Th F after the split for the one kid with Tuesday internship). Gaps are visible as empty space on the grid.

**Handling exceptions:** Admin sees that one student in M-F Advisory has a Tuesday conflict. Selects the student on the Advisory activity, uses "create instance for selected" (Layer 2) or manually removes them + creates an M W Th F copy. Both show up aggregated under Block 0 on the teacher's view.

---

## File References

| File | Relevance |
|------|-----------|
| `supabase/migrations/20260328000000_calendars.sql` | Calendars table + activity FK |
| `supabase/migrations/20260328000001_activity_recurrence_interval.sql` | Recurrence interval columns |
| `docs/schema/03-activities.md` | Activity table (needs update for new columns) |
| `docs/business-logic/01-schedule-and-calendar.md` | `activityMeetsToday` (needs recurrence branch) |
| `src/lib/enrollmentValidation.js` | Conflict detection (needs recurrence awareness) |
| `src/lib/scheduleUtils.js` | Schedule predicates (needs recurrence branch) |
| `src/components/agenda/agendaUtils.js` | Grid positioning utilities (reusable) |
| `src/components/agenda/AgendaBlockOverlay.jsx` | Block overlay (reusable) |
| `docs/user-flows/student-schedule-view-build-spec.md` | Superseded but useful reference |
| `docs/user-flows/admin-dashboard.md` | Dashboard framing carries forward |