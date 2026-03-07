# Here App — Project Status

**Last updated:** March 5, 2026 (dashboard design consolidation)

---

## Current State

**Documentation:** Up to date. Schema docs and business logic docs are current. Architecture docs have status notes flagging where planned patterns differ from current implementation. Session notes through 7.1 (today). User flow docs now cover five files: `admin-dashboard-v2.md` (consolidated dashboard design — supersedes original `admin-dashboard.md`, which should be deleted after review), `enrollment-and-floating-panels.md` (original enrollment/panel design exploration — largely historical now that enrollment panel is implemented and dashboard design has evolved), `schedule-action-map.md` (comprehensive map of all admin actions affecting student-activity-schedule relationships — still current), and `enrollment-panel-build-spec.md` (implementation spec for the enrollment panel — implemented in session 6.4).

**Database:** V2 schema deployed with five additional migrations since phase 4: RLS fix, dynamic block count, admin RLS policies, and `duration_minutes` on activities. City View org has `block_count: 6` in settings. Real data: City View org with admin account (Daniel Lang), staff users, and multiple activity types.

**Application code:** Auth flow working. Activity Management and User Management pages are both functional with full CRUD, now using React Query for server state and React Hook Form for form management. Custom hooks in `src/hooks/` (useActivities, useUsers, useStudents, useOrgSettings, useEnrollments) wrap API functions with TanStack Query. Activity form has type-driven field visibility and duration field; activity table shows staff (joined from user_profiles) instead of type, with primary+N display pattern and "Enroll" action per row. User management uses a modal-based create/edit flow with a Supabase Edge Function for account creation. Staff dropdowns in the activity form are wired up via `useStaffUsers`. Enrollment validation utilities are in place (`src/lib/enrollmentValidation.js`) — block-based and time-based conflict detection, enrollment gatekeeper, and scheduling visibility helpers. **Enrollment UI is implemented:** FloatingPanel shell (reusable draggable/minimizable container) + EnrollmentPanel (activity dropdown, two-zone student list, progressive conflict indicators, three-phase submit flow, post-conflict "create activity" action). Launched from "Enroll" button on activity rows. Remaining admin pages (Calendar, Reports) are still placeholders.

**Key architectural decisions:** The app is being designed as a schedule-building tool, not just a schedule-entry form. Settings, blocks, terms, etc. are all optional/progressive — admins can enter activities before defining blocks or terms. The admin dashboard is a **schedule-building workspace** built around an agenda view, with floating panels for contextual tools (activity browsing, enrollment, settings) and full-page views available as tabs below the agenda. Design consolidated in `docs/user-flows/admin-dashboard-v2.md`.

## Active Decisions

Decisions that are settled and documented in CLAUDE.md or `docs/` are not repeated here. This section is for decisions that are still evolving or that affect near-term work:

**Dashboard architecture (settled, session 7.1):** Agenda view as centerpiece. Toolbar above with filters, property toggle icons, and panel-summoning buttons. Floating panels for Activities (filtered browser, not a dedicated unplaced zone), Enrollment (existing panel + future student-centric entry), and Settings/Calendar (future). Full-page Activity/User Management as tabs below the agenda. No separate User Management floating panel — enrollment panel serves as the student-facing dashboard tool. Details in `admin-dashboard-v2.md`.

**Build order (updated):** Agenda view → adaptive card density → Activity Panel → dashboard page composition → Enrollment Entry B → quick-create forms → agenda filtering interactions → property toggles and toolbar polish. Steps 1–4 are the minimum viable dashboard. Conflict visualization and drag-and-drop are future layers. Detailed sequence in `admin-dashboard-v2.md`.

**Enrollment panel — Entry B (designed, not built):** Student-centric entry point for the existing enrollment panel. Open from toolbar with no activity context, browse/filter students first, then pick activity target. Same component, different initial state (`initialActivityId` null). Exact layout for the activity selector within the student-first flow is an open question.

**Enrollment panel — Entry A (implemented):** Activity-centric. Single-panel model with activity dropdown + two-zone student list (staged/available, click-to-toggle). FloatingPanel shell opens center-screen. Conflict indicators are progressive: subtle dot when browsing, full detail when staged. Submit flow stays in-panel with confirmation step. "Create activity with these students" available post-conflict as a background action. Scenario B (placement check on activity schedule edit) is designed but deferred. Spec in `enrollment-panel-build-spec.md`.

---

## Known Issues / Tech Debt

- **Raw fetch in useAuthListener:** `fetchProfile` uses raw `fetch` instead of the Supabase client due to a deadlock in supabase-js v2.95 when calling client methods inside `onAuthStateChange`. Revisit on supabase-js upgrade.
- **RLS policies are starter-level:** Policies exist for core admin workflows but will need expansion as features grow (e.g., teacher-scoped writes, student check-in policies). Some existing phase 4 policies (teachers manage attendance) aren't org-scoped yet.
- **Architecture docs mostly current:** `docs/architecture/02-data-flow-and-state.md` React Query/RHF patterns are now implemented for existing pages (activities, users, auth). Example hooks for future features (useCheckIn, useMarkAttendance) are still aspirational and should follow the same patterns.
- **`docs/USER_FLOWS.md` is outdated:** References V1 concepts (priority-based conflict resolution, enrollment_overrides, "sessions" terminology). Being replaced by per-feature docs in `docs/user-flows/` as features are built.
- **Activity form needs compact/quick-create variant.** The current form is large and handles all activity types in one view. A quick-create mode (name, type, teacher only) is needed for the dashboard Activity Panel. Separate design task.

---

## Next Steps

1. **Enrollment panel testing and polish.** Core implementation is in place. Needs real-world testing with actual student/activity data to validate UX, conflict indicator clarity, and edge cases (empty states, large student lists, activities with no schedule). Scenario B (placement check on activity schedule edit) is designed but deferred to a separate build phase.

2. **Agenda view component (dashboard Layer 1).** The week grid with time axis, day columns, block overlay bands, and activity card rendering. Start with individual activity cards (no aggregation). Needs real activity data with schedule info. Build spec to be written before implementation.

3. **Dashboard page composition (Layer 2).** Wire agenda view, activity panel, enrollment panel, and toolbar together on a single page. Add tab slots below the agenda for existing Activity/User Management pages.

4. **Enrollment Panel Entry B.** Student-centric entry point. Can be spec'd and built independently of the agenda view.

5. **Quick-create forms.** Compact activity and user creation forms for panel use. Depends on activity form restructuring.

6. **Admin: Calendar management** — Term CRUD, school day generation, schedule template editor, "assign blocks" step that maps existing activities to newly-defined block boundaries.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `CLAUDE.md` | Project overview, commands, conventions, key architectural decisions — **Claude's entry point** |
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns (note: some patterns are aspirational, see status notes in each doc) |
| `docs/session-notes/` | Per-session development logs (what was built, decisions made, issues encountered) |
| `docs/user-flows/` | Per-feature UX narratives and build specs (see below) |
| `docs/USER_FLOWS.md` | **Outdated** — V1 concepts, do not rely on schema or data model references |
| `supabase/migrations/` | SQL migration files (four phases + reset + RLS fix + dynamic blocks + admin RLS + duration) |

### User Flow Docs Status

| File | Status | Notes |
|------|--------|-------|
| `admin-dashboard-v2.md` | **Current** | Consolidated dashboard design (March 5). Build from this. |
| `admin-dashboard.md` | **Superseded** | Delete after reviewing v2. |
| `enrollment-panel-build-spec.md` | **Implemented** | Enrollment panel built per this spec in session 6.4. |
| `schedule-action-map.md` | **Current** | Activity states, action validation, build phasing. Still accurate. |
| `enrollment-and-floating-panels.md` | **Historical** | Original design exploration. FloatingPanel built, enrollment panel built. Some details (like "open near trigger") changed during implementation. Useful as context but not a build reference. |
