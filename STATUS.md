# Here App — Project Status

**Last updated:** March 8, 2026 (session 9 — bulk user entry)

---

## Current State

**Documentation:** Up to date. Schema docs and business logic docs are current. Architecture docs have status notes flagging where planned patterns differ from current implementation. Session notes through 9. User flow docs: `admin-dashboard.md` (consolidated dashboard design, updated March 7 to reflect tab cut and aggregate card decisions), `agenda-view-build-spec.md` (implemented in session 8.2), `enrollment-panel-build-spec.md` (implemented in session 6.4), `schedule-action-map.md` (current), and `enrollment-and-floating-panels.md` (historical).

**Database:** V2 schema deployed with five additional migrations since phase 4: RLS fix, dynamic block count, admin RLS policies, and `duration_minutes` on activities. City View org has `block_count: 6` in settings. Real data: City View org with admin account (Daniel Lang), staff users, and multiple activity types.

**Application code:** Auth flow working. Activity Management and User Management pages are both functional with full CRUD, now using React Query for server state and React Hook Form for form management. Custom hooks in `src/hooks/` (useActivities, useUsers, useStudents, useOrgSettings, useEnrollments) wrap API functions with TanStack Query. Activity form has type-driven field visibility and duration field; activity table shows staff (joined from user_profiles) instead of type, with primary+N display pattern and "Enroll" action per row. User management uses a modal-based create/edit flow with a Supabase Edge Function for account creation. **Bulk user entry is implemented:** paste-from-spreadsheet tool on the User Management page (`BulkUserEntry` component) — paste tab-separated or CSV data, preview with inline editing and per-row validation, sequential creation through the existing Edge Function with progress tracking. Staff dropdowns in the activity form are wired up via `useStaffUsers`. Enrollment validation utilities are in place (`src/lib/enrollmentValidation.js`) — block-based and time-based conflict detection, enrollment gatekeeper, and scheduling visibility helpers. **Enrollment UI is implemented:** FloatingPanel shell (reusable draggable/minimizable container) + EnrollmentPanel (activity dropdown, two-zone student list, progressive conflict indicators, three-phase submit flow, post-conflict "create activity" action). Launched from "Enroll" button on activity rows. **Agenda view is implemented:** Time-based week grid (`src/components/agenda/`) with adaptive card density (single/few/aggregate), block grouping, day column headers, block label filter buttons, click-to-zoom interactions, and uiStore focus state (`agendaFocusedBlock`, `agendaFocusedDay`). Dashboard rebuilt as a schedule-building workspace with toolbar stub and AgendaView. Block overlay and toolbar panel functionality are stubs for future builds. Remaining admin pages (Calendar, Reports) are still placeholders.

**Key architectural decisions:** The app is being designed as a schedule-building tool, not just a schedule-entry form. Settings, blocks, terms, etc. are all optional/progressive — admins can enter activities before defining blocks or terms. The admin dashboard is a **schedule-building workspace** built around an agenda view, with floating panels for contextual tools (activity browsing, enrollment, settings). Activity and User Management remain as dedicated pages — not embedded in the dashboard. Design in `docs/user-flows/admin-dashboard.md`; implementation spec in `docs/user-flows/agenda-view-build-spec.md`.

## Active Decisions

Decisions that are settled and documented in CLAUDE.md or `docs/` are not repeated here. This section is for decisions that are still evolving or that affect near-term work:

**Dashboard architecture (updated session 8.1):** Agenda view as centerpiece. Toolbar above with filters, property toggle icons, and panel-summoning buttons. Floating panels for Activities, Enrollment, and Settings/Calendar (future). No tabs below the agenda — Activity/User Management remain as dedicated pages in the admin nav. No separate User Management floating panel. Details in `admin-dashboard.md`.

**Aggregate card interaction (settled, session 8.1):** Hover over an aggregate card → tooltip listing activity names + staff (peek). Click → filter to block × day (same as clicking block label + day header). Zoomed view shows activities side by side with horizontal scroll at high density. Documented in `agenda-view-build-spec.md`.

**Build order (updated session 9):** ~~Agenda view + toolbar stub + dashboard rebuild~~ (done, session 8.2) → ~~Bulk user entry~~ (done, session 9) → Activity Panel → dashboard composition → Enrollment Entry B → quick-create forms → toolbar refinement. Steps 1–3 are the minimum viable dashboard. Conflict visualization and drag-and-drop are future layers. Sequence in `admin-dashboard.md`. Bulk activity/schedule entry tools are a potential near-term addition.

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

1. **Agenda view styling polish.** Core implementation is in place (session 8.2). Needs visual refinement — card sizing, spacing, color treatment, and responsive behavior tuning with real activity data.

2. **Enrollment panel testing and polish.** Core implementation is in place. Needs real-world testing with actual student/activity data to validate UX, conflict indicator clarity, and edge cases (empty states, large student lists, activities with no schedule). Scenario B (placement check on activity schedule edit) is designed but deferred to a separate build phase.

3. **Activity Panel spec and build.** Floating panel for browsing/searching activities on the dashboard. Needs its own spec before build.

4. **Dashboard composition (Layer 2).** Wire agenda view, activity panel, enrollment panel, and toolbar together.

5. **Enrollment Panel Entry B.** Student-centric entry point. Can be spec'd and built independently of the agenda view.

6. **Quick-create forms.** Compact activity and user creation forms for panel use. Depends on activity form restructuring.

7. **Admin: Calendar management** — Term CRUD, school day generation, schedule template editor, "assign blocks" step that maps existing activities to newly-defined block boundaries.

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
| `admin-dashboard.md` | **Current** | Consolidated dashboard design. Updated March 7: tab concept cut, aggregate card interaction resolved. |
| `agenda-view-build-spec.md` | **Implemented** | Agenda view + dashboard rebuild built per this spec in session 8.2. |
| `enrollment-panel-build-spec.md` | **Implemented** | Enrollment panel built per this spec in session 6.4. |
| `schedule-action-map.md` | **Current** | Activity states, action validation, build phasing. Still accurate. |
| `enrollment-and-floating-panels.md` | **Historical** | Original design exploration. Useful as context but not a build reference. |
