# Documentation Rewrite — Handoff Prompt

Use this as the opening message in a new conversation to continue the docs work.

---

Hi Claude! I'm working on the Here app — an attendance and scheduling system for City View Community High School in Cedar Rapids. The project uses React/Vite, Supabase (PostgreSQL), TanStack Query, Zustand, React Hook Form, and Tailwind/DaisyUI.

We just finished a major schema overhaul. The schema docs in `docs/schema/` are fully up to date and are the source of truth for everything. The `README.md` in that directory explains the V1→V2 changes and design principles. Please read the full schema directory first — it's split into 12 files plus a README.

**What we need to do now:** Rewrite three other doc sets that are badly outdated (they still reference V1 concepts like `sessions`, `student_activities`, `activity_types` table, `conflict_priority` integers, `enrollment_overrides`, and the `interactions` table — all of which are gone).

We're splitting each doc into chunked files in their own subdirectory (like we did with schema), each with a README. Here's the plan:

## docs/architecture/
1. `01-tech-stack-and-structure.md` — Stack choices, project structure, env setup, build/deploy
2. `02-data-flow-and-state.md` — Data flow patterns, React Query/Zustand/RHF strategy, API layer patterns
3. `03-auth-and-security.md` — Supabase auth, RLS strategy, role switching, protected routes
4. `04-realtime-and-notifications.md` — Realtime subscriptions, notification delivery, timezone handling
5. `05-ui-and-styling.md` — Tailwind/DaisyUI config, component architecture, responsive patterns

## docs/business-logic/
1. `01-schedule-and-calendar.md` — Rotation calculation, block time resolution, "activity meets today" logic
2. `02-checkin-rules.md` — Check-in/out availability, validation, geofence
3. `03-attendance-rules.md` — Marking, bulk operations, status transitions
4. `04-status-and-presence.md` — Status update rules, presence waves, streak calculation
5. `05-conflict-resolution.md` — How scheduling flags work, teacher roster filtering, examples
6. `06-notifications-and-access.md` — Trigger rules, deduplication, role-based permissions

## docs/user-flows/
1. `01-student-flows.md` — Daily view, check-in, status updates, presence waves, attendance history
2. `02-teacher-flows.md` — Dashboard, standard attendance, monitoring, feedback, roster
3. `03-admin-flows.md` — Setup, calendar, activities, enrollment, conflict management, reports
4. `04-cross-role-flows.md` — Notifications, realtime updates, navigation structure, mobile considerations

**Approach:** Start with the architecture docs (least change needed — maybe 60-70% of the old content survives, just needs V2 table/column names and updated examples). Then business logic (full rewrite from schema). Then user flows (UX narratives mostly survive, implementation details need updating).

The old versions of these docs are still in `docs/` as `SYSTEM_ARCHITECTURE.md`, `BUSINESS_LOGIC.md`, and `USER_FLOWS.md`. Read them for context on what was intended, but don't trust any schema references in them — use the schema docs as the single source of truth.

**Key V1→V2 changes to keep in mind while rewriting:**
- `sessions` + `student_activities` → unified `activities` table
- `activity_types` catalog table → `type` is just a text field on activities
- `enrollment_overrides` → gone; scheduling handled by `is_not_scheduled`, `is_release`, `requires_attendance` booleans
- `conflict_priority` integer → gone; visibility driven by boolean flags and rotation_day_type
- `interactions` table → replaced by `posts`, `post_responses`, `comments` tables
- All attendance/social records now reference `activity_instance_id` (lazy-created instances), not `activity_id + date`
- `notifications` uses nullable FK columns (like `comments`), not polymorphic `related_type`/`related_id`
- `rotation_day` / `rotation_day_type` validated in app layer against org settings, not hardcoded CHECK constraints
- `term_id` added to activities for easy term-based queries
- `days_of_week` is `INTEGER[]` using `EXTRACT(DOW)` values, not text abbreviations

The project root is at: `C:\Users\dansl\Files\DevProjects\here-app`

Let's start with the architecture docs — read the schema directory and the old SYSTEM_ARCHITECTURE.md, then we'll create the `docs/architecture/` directory and work through the files.
