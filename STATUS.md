# Here App — Project Status

**Last updated:** March 1, 2026

---

## Current State

**Documentation:** Complete and internally consistent. Schema, business logic, architecture, and migration files all reflect the same unified model.

**Database:** V2 schema deployed to Supabase. All four migration phases have been run successfully. No seed data yet — need to create org, users, terms, schedule templates, school days, and sample activities.

**Application code:** Scaffold restructured to match architecture docs. Auth flow works (login page renders, Supabase auth listener active). No feature code yet.

**User flows:** Still in the old monolithic `docs/USER_FLOWS.md` format. Lower priority — will evolve as we build.

---

## What Was Accomplished (March 1, 2026)

### Migrations
- Ran all four V2 migration phases against Supabase (core → activities → attendance → social/RLS/indexes)

### Application Scaffold Restructure
- **Vite config:** Added `@` path alias, build config, sourcemaps
- **API layer:** Created `src/api/` with domain-organized Supabase query functions: `supabase.js`, `auth.js`, `calendar.js`, `activities.js`, `enrollments.js`, `instances.js`
- **Pages reorganized:** Moved from flat `src/pages/` to role-based subdirectories: `auth/`, `student/`, `teacher/`, `admin/`
- **Auth store refactored:** Added `currentRole`/`availableRoles` with localStorage persistence via Zustand `persist` middleware. Auto-selects role on login.
- **UI store created:** `src/store/uiStore.js` with selected date, sidebar, and modal state
- **Constants:** `src/lib/constants.js` with activity types, behavior flag defaults, blocks, days of week, attendance statuses — all matching database constraints
- **Date utilities:** `src/lib/date.js` with timezone-aware date helpers, formatting, parsing
- **General utilities:** `src/lib/utils.js` with name display, initials, array helpers, sorting
- **Business logic:** `src/lib/business-logic/scheduling.js` (activityMeetsToday, getActivityEffectiveTimes, wouldConflict) and `rotation.js` (calculateRotationDay) — implementing the algorithms from the business logic docs
- **Routing refactored:** Role-based route nesting, `ProtectedRoute` with `requiredRole` support, `DashboardRedirect` hub that sends users to their role's home page
- **AppLayout updated:** Reads role from auth store, handles role switching with navigation, uses `@` alias imports throughout

### Cleanup
- Removed deprecated `src/lib/supabase.js` (was re-exporting from new location)
- Deleted old flat page files (`LoginPage.jsx`, `DashboardPage.jsx`, `StudentDashboard.jsx`, `TeacherDashboard.jsx`, `AdminDashboard.jsx`)

---

## Recent Decisions

**Admin features first (March 2026):**
Building admin features before student/teacher views. Admin tools create the data (terms, school days, activities, enrollments) that other views consume — no point building a student schedule view with no data to display.

**Enrollment validation over conflict resolution (March 2026):**
The system prevents scheduling overlaps at enrollment time rather than resolving them at runtime. No priority system, no "away" detection, no hidden/shown logic. See `docs/business-logic/05-conflict-resolution.md`.

**External activities get block numbers (March 2026):**
All scheduled activities — including external HS courses, internships, and college courses — receive a block number. The only activities without blocks are unscheduled ones (`is_not_scheduled = true`).

**Unified activities table (February 2026):**
V1's separate `sessions` and `student_activities` tables collapsed into a single `activities` table.

---

## Next Steps

1. **Seed data** — Create test data: one organization (City View), a demo admin user, schedule templates, a term, school days with rotation, sample activities across types, sample students with enrollments. Need to re-add the demo admin account.

2. **Admin: Calendar management** — Term CRUD, school day calendar generation, schedule template editor. This is the foundation everything else depends on.

3. **Admin: Activity management** — Unified activity form (type-driven field visibility), activity list with filtering, needs-scheduling view.

4. **Admin: Enrollment management** — Enroll/unenroll students, overlap validation, bulk enrollment.

5. **Admin: User management** — View/edit user profiles, role assignment.

6. **Teacher/Student views** — After admin tools exist and data is populated.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns |
| `docs/USER_FLOWS.md` | **Outdated** — needs chunked rewrite |
| `supabase/migrations/` | SQL migration files (four phases + reset) |
