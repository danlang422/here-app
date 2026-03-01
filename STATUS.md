# Here App — Project Status

**Last updated:** March 1, 2026 (evening)

---

## Current State

**Documentation:** Complete and internally consistent. Schema, business logic, architecture, and migration files all reflect the same unified model. RLS policy docs updated to reflect recursion fix.

**Database:** V2 schema deployed to Supabase. All four migration phases plus RLS fix migration have been run. Seed data bootstrapped: City View org and admin account (Daniel Lang, admin+teacher roles) created via `scripts/seed.js`.

**Application code:** Auth flow fully working — login, redirect, session persistence across refresh. Admin section has sub-routing with tabbed navigation and placeholder pages for Calendar, Activities, Users, and Reports. No feature code yet.

**User flows:** Still in the old monolithic `docs/USER_FLOWS.md` format. Lower priority — will evolve as we build.

---

## What Was Accomplished (March 1, 2026 — Session 2)

### Seed Data
- Ran `scripts/seed.js` to bootstrap City View org and admin account
- Decision: keep seed data minimal (org + admin only); let admin UI be the path for creating terms, schedules, activities, etc.
- Student test accounts will be added to seed script later when enrollment features are ready

### Auth Fixes
- **Login redirect:** Replaced imperative `navigate()` with reactive `<Navigate>` driven by auth store state. Login page now detects authenticated user and redirects automatically.
- **Supabase client deadlock:** Discovered that supabase-js v2.95 deadlocks when client methods (like `getSession()` or `from().select()`) are called from within `onAuthStateChange` callbacks. Fixed `fetchProfile` to use raw `fetch` with the session's access token passed as a parameter instead of calling back into the Supabase client.
- **HMR guard:** Added `globalThis` singleton pattern to `supabase.js` to prevent duplicate GoTrueClient instances during Vite hot reload.
- **Mounted guard:** Added `mounted` flag to `useAuthListener` effect to prevent state updates after cleanup. Empty dependency array since Zustand store functions are stable references.
- **INITIAL_SESSION skip:** `onAuthStateChange` now skips the `INITIAL_SESSION` event since `getSession()` already handles the initial load.

### RLS Fix
- **user_profiles infinite recursion:** The original "Users view org profiles" policy used a self-referential subquery (`SELECT organization_id FROM user_profiles WHERE id = auth.uid()`), causing PostgreSQL to detect infinite recursion. Split into two policies: "Users read own profile" (`id = auth.uid()`) and "Users view org profiles" (reads org_id from `auth.jwt() -> 'user_metadata'` instead of subquerying the same table).
- Migration: `20260301000000_fix_user_profiles_rls.sql`

### Admin Sub-Routing
- Created `AdminLayout` component with tabbed navigation (Dashboard, Calendar, Activities, Users, Reports) using `NavLink` + `<Outlet />`
- Admin routes nested under `/admin` with child routes: `/admin/calendar`, `/admin/activities`, `/admin/users`, `/admin/reports`
- Admin Dashboard updated with clickable cards linking to sub-sections
- Placeholder pages created for all admin sub-sections

---

## Recent Decisions

**Minimal seed data (March 2026):**
Only seed the org and admin account. All other data (terms, schedules, activities, students) should be created through admin UI features as they're built. This ensures the admin workflows are actually tested.

**Admin features first (March 2026):**
Building admin features before student/teacher views. Admin tools create the data (terms, school days, activities, enrollments) that other views consume — no point building a student schedule view with no data to display.

**Enrollment validation over conflict resolution (March 2026):**
The system prevents scheduling overlaps at enrollment time rather than resolving them at runtime. No priority system, no "away" detection, no hidden/shown logic. See `docs/business-logic/05-conflict-resolution.md`.

**External activities get block numbers (March 2026):**
All scheduled activities — including external HS courses, internships, and college courses — receive a block number. The only activities without blocks are unscheduled ones (`is_not_scheduled = true`).

**Unified activities table (February 2026):**
V1's separate `sessions` and `student_activities` tables collapsed into a single `activities` table.

---

## Known Issues / Tech Debt

- **Raw fetch in useAuthListener:** `fetchProfile` uses raw `fetch` instead of the Supabase client due to a deadlock in supabase-js v2.95 when calling client methods inside `onAuthStateChange`. This should be revisited when upgrading supabase-js — the bug may be fixed in a future version.
- **Other RLS policies may have similar patterns:** Policies on other tables (activities, attendance_records) use subqueries against `user_profiles`, which is fine (not self-referential), but worth auditing if performance issues arise.

---

## Next Steps

1. **Admin: Calendar management** — Term CRUD, school day calendar generation, schedule template editor. This is the foundation everything else depends on. Discuss with Daniel what the admin UI should look like before building.

2. **Admin: Activity management** — Unified activity form (type-driven field visibility), activity list with filtering, needs-scheduling view.

3. **Admin: Enrollment management** — Enroll/unenroll students, overlap validation, bulk enrollment.

4. **Admin: User management** — View/edit user profiles, role assignment. Will need a Supabase Edge Function for creating new auth accounts.

5. **Teacher/Student views** — After admin tools exist and data is populated.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns |
| `docs/USER_FLOWS.md` | **Outdated** — needs chunked rewrite |
| `supabase/migrations/` | SQL migration files (four phases + reset + RLS fix) |
