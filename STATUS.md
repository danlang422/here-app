# Here App — Project Status

**Last updated:** March 3, 2026 (evening — post dashboard planning session)

---

## Current State

**Documentation:** Mostly current. Schema docs and business logic docs are up to date (including time-based conflict detection added Session 5). Architecture docs have status notes flagging where planned patterns differ from current implementation. Session notes reorganized into `docs/session-notes/`. First user flow doc created: `docs/user-flows/admin-dashboard.md` captures the dashboard vision, agenda view design, and enrollment interaction patterns.

**Database:** V2 schema deployed with three additional migrations since phase 4: RLS fix, dynamic block count, and admin RLS policies. City View org has `block_count: 6` in settings. Real data: City View org with admin account (Daniel Lang), staff users, and multiple activity types. Planned schema addition: `duration_minutes` (nullable integer) on activities — not yet migrated, documented in dashboard planning doc.

**Application code:** Auth flow working. Activity Management and User Management pages are both functional with full CRUD, now using React Query for server state and React Hook Form for form management. Custom hooks in `src/hooks/` (useActivities, useUsers, useOrgSettings) wrap API functions with TanStack Query. Activity form has type-driven field visibility, activity table with filtering. User management uses a modal-based create/edit flow with a Supabase Edge Function for account creation. Staff dropdowns in the activity form are wired up via `useStaffUsers`. Enrollment validation utilities are in place (`src/lib/enrollmentValidation.js`) — block-based and time-based conflict detection, enrollment gatekeeper, and scheduling visibility helpers. No enrollment UI yet. Remaining admin pages (Calendar, Reports) are still placeholders.

**Key architectural decisions:** The app is being designed as a schedule-building tool, not just a schedule-entry form. Settings, blocks, terms, etc. are all optional/progressive — admins can enter activities before defining blocks or terms. User management follows the same reusable-component pattern as activities — form works in modal or full page. The admin dashboard is envisioned as a schedule-building workspace where activities, users, and enrollment converge around a visual agenda. Time is the primary axis on the agenda view; blocks are an overlay (see `docs/user-flows/admin-dashboard.md`).

## Active Decisions

Decisions that are settled and documented in CLAUDE.md or `docs/` are not repeated here. This section is for decisions that are still evolving or that affect near-term work:

**Build order:** Activity Management → Enrollment UI → Agenda/week view → Dashboard → Calendar management. Each layer builds on the previous. Enrollment UI components are designed as composable pieces that work standalone (in Activity Management) and later plug into the dashboard.

**Dashboard direction:** The admin dashboard is a schedule-building workspace, not a summary page. Key decisions captured in `docs/user-flows/admin-dashboard.md`: time-based agenda axis with block overlay, adaptive card density driven by filters, two complementary enrollment patterns (drag-to-enroll + two-panel modal), quick-create as collapsed versions of existing forms, grade-level derived from enrollment rather than activity properties. Many layout and interaction details still open — see the doc's Open Questions section.

---

## Known Issues / Tech Debt

- **Raw fetch in useAuthListener:** `fetchProfile` uses raw `fetch` instead of the Supabase client due to a deadlock in supabase-js v2.95 when calling client methods inside `onAuthStateChange`. Revisit on supabase-js upgrade.
- **RLS policies are starter-level:** Policies exist for core admin workflows but will need expansion as features grow (e.g., teacher-scoped writes, student check-in policies). Some existing phase 4 policies (teachers manage attendance) aren't org-scoped yet.
- **Architecture docs mostly current:** `docs/architecture/02-data-flow-and-state.md` React Query/RHF patterns are now implemented for existing pages (activities, users, auth). Example hooks for future features (useCheckIn, useMarkAttendance) are still aspirational and should follow the same patterns.
- **`docs/USER_FLOWS.md` is outdated:** References V1 concepts (priority-based conflict resolution, enrollment_overrides, "sessions" terminology). Being replaced by per-feature docs in `docs/user-flows/` as features are built.

---

## Next Steps

1. **Enrollment UI (Layer 1.5)** — Build the composable enrollment workflow: StudentSelector, ActivitySelector, EnrollmentFlow orchestrator. Wire into ActivityManagement with "Enroll Students" action per activity. Write enrollment-specific user flow doc (or expand dashboard doc) before building.

2. **Admin: Agenda/week view (Layer 2)** — Time-based visual timeline showing placed activities across a week, with block boundaries as overlay bands. Adaptive card density. Will need group-level scheduling utilities built on top of existing validation module. Design direction documented in `docs/user-flows/admin-dashboard.md`.

3. **Admin: Dashboard (Layer 2.5)** — Composes agenda view, quick-create forms, enrollment UI, and unplaced activities zone into the schedule-building workspace. Depends on Layers 1.5 and 2.

4. **Admin: Calendar management** — Term CRUD, school day generation, schedule template editor, "assign blocks" step that maps existing activities to newly-defined block boundaries.

5. **Schema addition: `duration_minutes`** — Nullable integer on activities. Add migration when enrollment UI or agenda view work begins. Enables proportional card sizing in unplaced activities zone.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `CLAUDE.md` | Project overview, commands, conventions, key architectural decisions — **Claude's entry point** |
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns (note: some patterns are aspirational, see status notes in each doc) |
| `docs/session-notes/` | Per-session development logs (what was built, decisions made, issues encountered) |
| `docs/user-flows/` | Per-feature UX narratives — admin dashboard, enrollment (being built out incrementally) |
| `docs/USER_FLOWS.md` | **Outdated** — V1 concepts, do not rely on schema or data model references |
| `supabase/migrations/` | SQL migration files (four phases + reset + RLS fix + dynamic blocks + admin RLS) |
