# Here App — Project Status

**Last updated:** March 8, 2026 (session 9.2)

---

## Current State

**Documentation:** Up to date. Schema docs and business logic docs are current. Architecture docs have status notes flagging where planned patterns differ from current implementation. Session notes through 9.2. User flow docs listed at bottom of this file.

**Database:** V2 schema deployed with migrations through `duration_minutes` on activities. City View org has `block_count: 6` in settings. Real data: City View org with admin account (Daniel Lang), staff users, and multiple activity types.

**Application:**

- **Auth** — Working. Login, role selection, auth listener with raw-fetch workaround (see Known Issues).
- **Activity Management** — Full CRUD. Type-driven field visibility, duration field, staff display (primary+N pattern), "Enroll" action per row. React Query + React Hook Form.
- **User Management** — Full CRUD via modal-based create/edit flow (Supabase Edge Function for account creation). Bulk user entry: paste-from-spreadsheet with preview, inline editing, per-row validation, sequential creation with progress tracking.
- **Enrollment Panel (Entry A)** — Activity-centric. FloatingPanel shell (draggable/minimizable), activity dropdown, two-zone student list, progressive conflict indicators, three-phase submit flow, post-conflict "create activity" action. Launched from activity row "Enroll" button. Spec: `enrollment-panel-build-spec.md`.
- **Admin Dashboard** — Schedule-building workspace. Agenda view as centerpiece with toolbar stub. Time-based week grid with adaptive card density (single/few/aggregate), block grouping, day column headers, block label filters, click-to-zoom. Grid spans 7 AM–4 PM by default with vertical scroll. Aggregate card tooltips render multiline on hover. Spec: `agenda-view-build-spec.md`, design: `admin-dashboard.md`.
- **Remaining admin pages** (Calendar, Reports) are placeholders.

**Hooks/state layer:** Custom hooks in `src/hooks/` (useActivities, useUsers, useStudents, useStaffUsers, useOrgSettings, useEnrollments) wrap API functions with TanStack Query. Zustand stores for auth and UI state (including agenda focus state). Enrollment validation utilities in `src/lib/enrollmentValidation.js` — block-based and time-based conflict detection.

## Active Decisions

Decisions that are settled and documented in CLAUDE.md or `docs/` are not repeated here. This section is for decisions that are still evolving or that affect near-term work.

**Dashboard architecture:** Agenda view as centerpiece. Toolbar above with filters, property toggle icons, and panel-summoning buttons. Floating panels for Activities, Enrollment, and Settings/Calendar (future). Activity/User Management remain as dedicated pages — not embedded in the dashboard. Details in `admin-dashboard.md`.

**Build order:** Agenda view, toolbar stub, dashboard rebuild, and bulk user entry are done. Next: Activity Panel → dashboard composition → Enrollment Entry B → quick-create forms → toolbar refinement. Bulk activity/schedule entry tools are a potential near-term addition.

**Enrollment Panel — Entry B (designed, not built):** Student-centric entry point. Open from toolbar with no activity context, browse/filter students first, then pick activity target. Same component, different initial state (`initialActivityId` null). Activity selector layout within the student-first flow is an open question.

## Known Issues / Tech Debt

- **Raw fetch in useAuthListener:** `fetchProfile` uses raw `fetch` instead of the Supabase client due to a deadlock in supabase-js v2.95 inside `onAuthStateChange`. Revisit on supabase-js upgrade.
- **RLS policies are starter-level:** Policies exist for core admin workflows but will need expansion (teacher-scoped writes, student check-in policies). Some phase 4 policies aren't org-scoped yet.
- **Architecture docs mostly current:** React Query/RHF patterns are now implemented for existing pages. Example hooks for future features (useCheckIn, useMarkAttendance) are still aspirational.
- **`docs/USER_FLOWS.md` is outdated:** References V1 concepts. Being replaced by per-feature docs in `docs/user-flows/`.
- **Activity form needs compact variant.** A quick-create mode (name, type, teacher only) is needed for the dashboard Activity Panel. Separate design task.

## Next Steps

1. **Agenda view polish (remaining).** Card color treatment, density/spacing tuning with more activity data, responsive behavior.
2. **Enrollment panel testing.** Real-world testing with actual student/activity data to validate UX, conflict indicators, and edge cases.
3. **Activity Panel spec and build.** Floating panel for browsing/searching activities on the dashboard. Needs its own spec.
4. **Dashboard composition.** Wire agenda view, activity panel, enrollment panel, and toolbar together.
5. **Enrollment Panel Entry B.** Student-centric entry point. Can be spec'd and built independently.
6. **Quick-create forms.** Compact activity and user creation forms for panel use.
7. **Calendar management.** Term CRUD, school day generation, schedule template editor, block assignment mapping.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `CLAUDE.md` | Project overview, commands, conventions, key architectural decisions — **Claude's entry point** |
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns (some patterns aspirational — see status notes) |
| `docs/session-notes/` | Per-session development logs |
| `docs/user-flows/` | Per-feature UX narratives and build specs (see below) |
| `supabase/migrations/` | SQL migration files |

### User Flow Docs

| File | Status | Notes |
|------|--------|-------|
| `admin-dashboard.md` | **Current** | Consolidated dashboard design. Updated March 7. |
| `agenda-view-build-spec.md` | **Implemented** | Built in session 8.2. |
| `enrollment-panel-build-spec.md` | **Implemented** | Built in session 6.4. |
| `schedule-action-map.md` | **Current** | Activity states, action validation, build phasing. |
| `enrollment-and-floating-panels.md` | **Historical** | Original design exploration, not a build reference. |