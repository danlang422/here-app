# Here App — Project Status

**Last updated:** March 1, 2026

---

## Current State

**Documentation:** Complete and internally consistent. Schema, business logic, architecture, and migration files all reflect the same unified model.

**Database:** Migration files ready to run against a clean Supabase project. Four-phase migration creates all V2 tables, constraints, indexes, RLS starter policies, and auth trigger.

**Application code:** Not started. Project has a Vite + React scaffold from initial setup but no feature code.

**User flows:** Still in the old monolithic `docs/USER_FLOWS.md` format with outdated conflict resolution UI patterns. Needs a full rewrite into chunked docs, but lower priority — better to evolve these as we build.

---

## Recent Decisions

**Enrollment validation over conflict resolution (March 2026):**
The system prevents scheduling overlaps at enrollment time rather than resolving them at runtime. No priority system, no "away" detection, no hidden/shown logic. Activities are entered to reflect what students actually do (B-day Advisory, not daily Advisory with a conflicting external activity). The application checks block, days_of_week, and rotation_day_type for genuine overlap before allowing enrollment. See `docs/business-logic/05-conflict-resolution.md`.

**External activities get block numbers (March 2026):**
All scheduled activities — including external HS courses, internships, and college courses — receive a block number. The only activities without blocks are unscheduled ones (`is_not_scheduled = true`, like online courses). This eliminated the need for special "away" detection logic.

**Unified activities table (February 2026):**
V1's separate `sessions` and `student_activities` tables collapsed into a single `activities` table. Activity `type` is a UI hint for form field visibility, not a behavioral switch. All student-activity relationships go through `enrollments`.

---

## Next Steps

1. **Run migrations** — Execute the four phase files against Supabase to stand up the V2 database.

2. **Seed data** — Create test data: one organization (City View), schedule templates, a term, school days with rotation, sample activities across all types, sample students with enrollments. This exercises the schema before writing application code.

3. **Core application scaffold** — Set up routing, auth flow, Supabase client, React Query provider, Zustand stores, and the protected route pattern per architecture docs.

4. **Student daily schedule view** — First real feature. Query enrolled activities for today, display by block. Exercises the `activityMeetsToday` logic, rotation day calculation, and block time resolution.

5. **Teacher roster view** — Second feature. Shows enrolled students for the teacher's activities on a given date. Exercises the roster query and attendance marking flow.

6. **Rewrite user flows** — As features get built, update `docs/user-flows/` with chunked docs reflecting the actual UI rather than speculative flows.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns |
| `docs/USER_FLOWS.md` | **Outdated** — needs chunked rewrite |
| `docs/SESSION_NOTES.md` | Historical — captures early design sessions and CSV analysis |
| `supabase/migrations/` | SQL migration files (four phases + reset) |
