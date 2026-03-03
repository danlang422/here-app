# Here App — Project Status

**Last updated:** March 3, 2026

---

## Current State

**Documentation:** Mostly current. Schema docs and business logic docs are up to date (including time-based conflict detection added Session 5). Architecture docs have status notes flagging where planned patterns differ from current implementation. Session notes reorganized into `docs/session-notes/`.

**Database:** V2 schema deployed with three additional migrations since phase 4: RLS fix, dynamic block count, and admin RLS policies. City View org has `block_count: 6` in settings. Real data: City View org with admin account (Daniel Lang), staff users, and multiple activity types.

**Application code:** Auth flow working. Activity Management and User Management pages are both functional with full CRUD. Activity form has type-driven field visibility, activity table with filtering. User management uses a modal-based create/edit flow with a Supabase Edge Function for account creation. Staff dropdowns in the activity form are wired up. Enrollment validation utilities are in place (`src/lib/enrollmentValidation.js`) — block-based and time-based conflict detection, enrollment gatekeeper, and scheduling visibility helpers. No enrollment UI yet. Remaining admin pages (Calendar, Reports) are still placeholders.

**Key architectural decisions:** The app is being designed as a schedule-building tool, not just a schedule-entry form. Settings, blocks, terms, etc. are all optional/progressive — admins can enter activities before defining blocks or terms. User management follows the same reusable-component pattern as activities — form works in modal or full page.

## Active Decisions

Decisions that are settled and documented in CLAUDE.md or `docs/` are not repeated here. This section is for decisions that are still evolving or that affect near-term work:

**Build order:** Activity Management → Enrollment UI → Agenda/week view → Calendar management. Each layer builds on the previous.

---

## Known Issues / Tech Debt

- **React Query / React Hook Form refactor needed:** Both libraries are installed but all current pages use manual `useState` + `useEffect` fetch patterns. A dedicated refactor session to adopt RQ/RHF across ActivityManagement, UserManagement, and auth pages is the next planned task before building new features.
- **Tailwind v4 / DaisyUI v5 hybrid config:** CSS entry point uses v4 syntax (`@import "tailwindcss"` / `@plugin "daisyui"`), but a v3-style `tailwind.config.js` also exists. Works via backwards compatibility, but should be cleaned up to use CSS-only config.
- **Edge Function `--no-verify-jwt` deployment:** The `create-user` Edge Function was deployed with `--no-verify-jwt` during a convoluted debugging session. It's unclear whether this was actually necessary or a side effect of other issues at the time. Should be tested without the flag to see if standard JWT verification works.
- **Raw fetch in useAuthListener:** `fetchProfile` uses raw `fetch` instead of the Supabase client due to a deadlock in supabase-js v2.95 when calling client methods inside `onAuthStateChange`. Revisit on supabase-js upgrade.
- **RLS policies are starter-level:** Policies exist for core admin workflows but will need expansion as features grow (e.g., teacher-scoped writes, student check-in policies). Some existing phase 4 policies (teachers manage attendance) aren't org-scoped yet.
- **Architecture docs describe planned patterns, not current code:** `docs/architecture/01-tech-stack-and-structure.md` project structure and `docs/architecture/02-data-flow-and-state.md` React Query/RHF patterns are aspirational. Notes have been added to both docs; the RQ/RHF refactor will bring code in line with the docs.
- **`docs/USER_FLOWS.md` is outdated:** References V1 concepts (priority-based conflict resolution, enrollment_overrides, "sessions" terminology). Being replaced by per-feature docs in `docs/user-flows/` as features are built.

---

## Next Steps

1. **React Query / React Hook Form refactor** — Adopt RQ and RHF across existing pages (ActivityManagement, UserManagement, auth). Brings code in line with the architecture docs. Good candidate for a focused Claude Code session.

2. **Tailwind v4 config cleanup** — Migrate from hybrid v3 JS config + v4 CSS entry point to CSS-only config. Low risk, small scope.

3. **Edge Function `--no-verify-jwt` test** — Redeploy `create-user` without the flag to see if standard verification works now.

4. **Enrollment UI (Layer 1.5)** — Build the composable enrollment workflow: StudentSelector, ActivitySelector, EnrollmentFlow orchestrator. Wire into ActivityManagement with "Enroll Students" action per activity. Write user flow doc before building.

5. **Admin: Agenda/week view (Layer 2)** — Visual timeline showing placed activities by time across a week, with rolled-up cards. Schedule-building experience with conflict visibility. Will need group-level scheduling utilities built on top of existing validation module.

6. **Admin: Calendar management** — Term CRUD, school day generation, schedule template editor, "assign blocks" step that maps existing activities to newly-defined block boundaries.

7. **Rotation day display** — How A/B day activities display in the week view alongside fixed-day activities. Current thinking: semi-transparent/striped cards spanning all weekdays, with conflict logic aware of rotation day matching.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `CLAUDE.md` | Project overview, commands, conventions, key architectural decisions — **Claude's entry point** |
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns (note: some patterns are aspirational, see status notes in each doc) |
| `docs/session-notes/` | Per-session development logs (what was built, decisions made, issues encountered) |
| `docs/user-flows/` | Per-feature UX narratives (being built out incrementally) |
| `docs/USER_FLOWS.md` | **Outdated** — V1 concepts, do not rely on schema or data model references |
| `supabase/migrations/` | SQL migration files (four phases + reset + RLS fix + dynamic blocks + admin RLS) |
