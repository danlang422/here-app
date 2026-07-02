# CLAUDE.md

This file gives Claude context for working on the Here app codebase.

## Project Overview

Here is an attendance tracking and student engagement app for City View Community High School. It handles complex scheduling: A/B day rotations, Kirkwood Community College courses, off-campus internships with geolocation check-in, independent study blocks, and monitoring sessions.

**Current status:** See `STATUS.md` — it is the source of truth for what's built, what's in progress, and what's next.

## Commands

```bash
npm run dev      # Start dev server at localhost:5173
npm run build    # Production build (output: dist/)
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

No test suite yet (Vitest/RTL/Playwright planned for later).

## Tech Stack

- **React 19** + **Vite** — frontend framework and build tool
- **React Router v7** — client-side routing
- **Supabase** — PostgreSQL + Auth + RLS + Realtime
- **TanStack Query v5** — server state management (caching, background refetch, mutations)
- **Zustand** — client state (auth, UI)
- **React Hook Form** — form state and validation
- **Tailwind CSS v4** + **DaisyUI v5** — styling
- **React Icons** + **DiceBear** — icons, avatars

## Environment Variables

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

## Project Structure

```
src/
├── api/            # Supabase query functions, one file per domain
├── components/     # Reusable components
│   ├── activities/ # ActivityDetailModal, ActivityTable, ActivityToolbar, ActivityDetail, StaffRows,
│   │               #   ActivitySelectionBar, BulkEditModal
│   ├── agenda/     # AgendaView, AgendaGrid, AgendaCard, AgendaDayColumn, AgendaBlockOverlay,
│   │               #   SingleDayAgenda, StudentActivityCard, TeacherActivityCard
│   ├── school-calendar/ # CalendarGrid, DayPopover
│   ├── enrollment/ # EnrollmentPanel
│   ├── layout/     # AppLayout, AdminLayout, AuthProvider, ProtectedRoute
│   ├── panels/     # FloatingPanel
│   ├── history/    # FeedEntryCard, StudentActionFeed, RecentActivityWidget
│   ├── roster/     # RosterModal, StudentDetailOverlay
│   ├── student/    # ActionButton, FreeformTagSelector, StatusUpdateModal
│   └── users/      # UserTable, UserForm, BulkUserEntry
├── hooks/          # Custom React hooks (see below)
├── lib/            # Utilities and constants
├── pages/          # Route-level components (admin/, auth/, student/, teacher/)
├── store/          # Zustand stores (authStore.js, uiStore.js)
├── App.jsx         # Root component with routes
└── main.jsx        # Entry point
```

**Hooks** (`src/hooks/`): `useAuth`, `useActivities`, `useActivityTerms`, `useBulkEditActivities`, `useCalendars`, `useEnrollments`, `useHistory`, `useOrgSettings`, `useRoster`, `useScheduleTemplate`, `useSchoolDays`, `useStreakData`, `useStudentActions`, `useStudentAgenda`, `useStudentInstanceDetail`, `useTeacherActionSummary`, `useTeacherAgenda`, `useTerms`, `useUsers`

## Coding Conventions

- **API layer:** One file per domain in `src/api/`. Functions use the shared Supabase client, throw on error, and return `data`. Query-building functions accept filter objects as a second parameter (see `getActivities` pattern).
- **State:** Zustand stores in `src/store/` with `persist` middleware where needed (auth persists role selection only). No Redux.
- **Components:** DaisyUI component classes as the baseline, extended with Tailwind utilities. Form components designed to be container-agnostic (work in pages, modals, or panels).
- **Path aliases:** Use `@/` for `src/` imports (e.g., `import { supabase } from '@/api/supabase'`).
- **React Query / React Hook Form:** Custom hooks in `src/hooks/` wrap API functions with TanStack Query. Pages use these hooks for server state. Forms use `useForm()` from React Hook Form with `register`, `watch`, and `setValue`. Mutations invalidate parent list queries on success.

## Key Architectural Decisions

**Everything is an activity.** Regular classes, college courses, internships, freeform blocks — all in one `activities` table, configured entirely through scheduling fields and behavior flags. There is no type system.

**Blocks are reporting labels, not scheduling units.** Activities have their own start and end times; those are the source of truth for when things happen. Blocks are tags used for attendance rollup and external SIS alignment. Teacher-facing UI lays out activities by actual time, with block labels shown as metadata. Admin attendance rollup is the one place where blocks drive structure, because rollup is reporting.

**Prevent conflicts, don't resolve them.** Enrollment validation checks block + days_of_week + rotation_day_type overlap at enrollment time. A student's schedule is exactly what it appears to be — there's no runtime priority system.

**Lazy instance creation.** `activity_instances` rows (a specific activity on a specific date) are created on first interaction, not pre-generated.

**Dynamic block count.** Block count is org-defined via `organization.settings.block_count`, not hardcoded. Use `getBlocks(blockCount)`, `getBlockLabel()`, `getBlockLabels()` from `src/lib/constants.js` — never hardcode block ranges.

**Progressive/optional setup.** Never force admins to define X before Y. Activities can be created before blocks or terms exist. The app gets smarter as more info is filled in.

**Activity form is container-agnostic.** `ActivityForm` works in full-page, modal, or slide-over — designed for future reuse across admin views.

**Two modes of conflict detection.** Block-based (`wouldConflictByBlock`) is the enrollment gatekeeper — it prevents double-booking within a block and is a hard gate. Time-based (`wouldConflictByTime`) is for scheduling visibility — it shows whether activities overlap in actual time, returns overlap/gap in minutes, and is informational only. These are separate because activity times don't always match block boundaries (e.g. an external course assigned to Block 0 may not span Block 0's full time range). Block assignment is organizational (admin judgment), not validated against time. See `src/lib/enrollmentValidation.js`.

**Enrollment is a workflow, not a page.** The enrollment UI is built from composable pieces (StudentSelector, ActivitySelector, EnrollmentFlow) that can be initiated from multiple contexts — activity management, schedule overview, etc. The two-panel flow is: select students → pick activity target → validate → enroll.

**PostgREST cannot filter on nested relation columns.** Queries like `.gte('activity_instance.date', x)` silently return unfiltered results. When filtering by a field on a joined table, fetch the parent IDs first (e.g., get instance IDs for a date range), then query the target table with `.in('activity_instance_id', ids)`. See `getTeacherStudentActionHistory` in `src/api/history.js` for the canonical example.

**Explicit column lists in enrollment queries.** Two functions use explicit `select()` column lists instead of `select('*')`: `getOrgEnrollments` in `src/api/enrollments.js` and `getRosterForActivities` in `src/api/agenda.js`. Any new column added to the `enrollments` table must also be added to both of these lists, or the values will save to the DB but be silently missing from the React Query cache. This was discovered in session 39 when `start_time_override`/`end_time_override` were missing from the UI after save.

**Raw fetch in useAuthListener.** `fetchProfile` uses raw `fetch` instead of the Supabase client due to a deadlock in supabase-js v2.95 inside `onAuthStateChange`. Don't change this pattern until supabase-js is upgraded.

**DaisyUI v5 CSS variable format.** DaisyUI v5 stores theme color variables as full color values (e.g. `--color-primary: oklch(62.31% 0.1881 259.82)`), not as raw channel values. Use `var(--color-primary)` directly in CSS — never `oklch(var(--color-primary))`, which double-wraps the value and produces invalid CSS. This differs from DaisyUI v4 behavior.

## Database

V2 schema with migrations in `supabase/migrations/`. Key migrations:

- `20260225000001–0004` — V2 schema (4 phases: core, activities, attendance, social/RLS/indexes)
- `20260301000000` — RLS fix for user_profiles
- `20260301000001` — Dynamic block count (loosened constraints, removed `<= 5` ceiling)
- `20260301000002` — Admin RLS policies
- `20260304000000` — Add `duration_minutes` to activities
- `20260309000000` — Remove activity type column
- `20260309000001` — Block cascade trigger (syncs enrollment block on activity edit)
- `20260310000000` — Term FK cascade
- `20260313000000` — Comprehensive RLS policies (all tables, all roles)
- `20260314000000` — Ensure `activity_instance` function
- `20260320000000` — Terms many-to-many (activities ↔ terms)
- `20260324000000` — Feedback/reports table
- `20260406000000` — Enrollment-level scheduling (4 nullable scheduling columns on `enrollments`: `days_of_week`, `rotation_day_type`, `recurrence_interval`, `recurrence_anchor_date`)
- `20260421000000` — Multi-block activities (`activities.block` and `enrollments.block` converted from `INTEGER` to `INTEGER[]`; existing single-block data migrated to single-element arrays)
- `20260513132022` — RLS overhaul: all `user_metadata` references replaced with `user_profiles` subqueries
- `20260513132044` — Function security: replaced `user_metadata` in functions, added `search_path`, fixed `handle_new_auth_user`
- `20260513132120` — Revoke anon execute (attempt via `REVOKE FROM anon` — superseded by 132144)
- `20260513132144` — Revoke public execute: `REVOKE FROM PUBLIC` + `GRANT TO authenticated` for all SECURITY DEFINER functions
- `20260513141142` — Fix `user_profiles` recursion: introduced `get_my_organization_id()` SECURITY DEFINER helper
- `20260513141200` — Opt out of Supabase default grants via `ALTER DEFAULT PRIVILEGES` (governs tables/sequences created *after* this migration; did not retroactively revoke anon's existing grants on pre-existing tables — see `20260702000003`)
- `20260514000001` — Add `visible_to_all_staff BOOLEAN NOT NULL DEFAULT false` to `activities`
- `20260514000002` — Add `start_time_override TIME` and `end_time_override TIME` (both nullable) to `enrollments`
- `20260520000001` — RLS extension for visible-to-all staff: extends teacher read/write access to `enrollments`, `activity_instances`, and `attendance_records` for `visible_to_all_staff` activities; introduces `activity_is_visible_to_all()` SECURITY DEFINER helper; Path A write access confirmed
- `20260520000002` — Add "Teachers read visible-to-all activities" SELECT policy on `activities` table (missed in 000001; non-assigned teachers couldn't read the activity row itself)
- `20260521000001` — Add `attendance_records` to `supabase_realtime` publication (required for Realtime `postgres_changes` events to fire; table was never added when originally created)
- `20260526000001` — `activity_staff` junction table (#70 Phase 2): replaces `activities.teacher_id`/`monitor_id` with `activity_staff(activity_id, user_id, role)`; data migrated with verify gate; `is_teacher_or_monitor_of` body repointed (name kept); RLS on new table; old columns dropped
- `20260625000001` — `ping()` SECURITY DEFINER function granted to `anon`, for the GitHub Actions keep-alive workflow to generate DB activity via `/rest/v1/rpc/ping` without a service-role key; returns no user data
- `20260702000001` — Made `feedback-screenshots` storage bucket private; `submit-feedback` edge function switched from `getPublicUrl()` to `createSignedUrl()` (10-year expiry); removed the bucket's public/authenticated SELECT policies (bucket previously allowed unauthenticated list/read of every org's screenshots)
- `20260702000002` — Fixed six INSERT policy gaps that checked row ownership but not parent-record org membership: `check_ins`, `presence_waves`, `status_updates`, `post_responses`, `comments`, `notifications` (the last via a `user_profiles`-to-`user_profiles` join, since `notifications` has no `organization_id` column)
- `20260702000003` — Revoked `anon`'s inherited table/sequence grants on every pre-existing `public` table (`REVOKE ALL ... FROM anon`). Root cause: `20260513141200`'s `ALTER DEFAULT PRIVILEGES` only governs tables created after it runs — every table that existed before May 13 had retained its original at-creation grants, which included full CRUD for `anon`. RLS was still enforcing real protection throughout (all policies key off `auth.uid()`/`get_my_organization_id()`, both `NULL` for `anon`), but the grant layer was effectively absent for `anon` on nearly the whole schema until this migration. Verified via codebase audit that no pre-login code path queries `public` schema tables, so this closes a real gap with no functional impact.

**Important — new tables require explicit GRANTs:** As of May 2026 we opted into Supabase's new behavior where tables in `public` are not auto-exposed to the Data API. Every new table must include:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO authenticated;
GRANT ALL ON public.your_table TO service_role;
ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;
```

Schema docs are in `docs/schema/` — these are the authoritative source for table structure, constraints, and RLS policies.

## Documentation Map

| Location | Contents |
|---|---|
| `STATUS.md` | Current state, recent decisions, next steps — **read this first** |
| `docs/schema/` | DB tables, constraints, indexes, queries, RLS, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns |
| `docs/session-notes/` | Per-session development logs (what was built, decisions made, issues encountered) |
| `docs/design-and-specs/` | Per-feature design docs, build specs, and UX narratives (full list below) |
| `docs/demos/` | Standalone HTML demo pages used for design review |

### Design and Spec Docs

| File | Status | Notes |
|------|--------|-------|
| `admin-dashboard.md` | **Current** | Consolidated dashboard design. |
| `agenda-view-build-spec.md` | **Implemented** | Built in session 8.2. |
| `enrollment-panel-build-spec.md` | **Implemented / Pending redesign** | Original floating panel spec — implemented, but being replaced by inline enrollment (#51). |
| `schedule-action-map.md` | **Current** | Activity states, action validation, build phasing. |
| `enrollment-and-floating-panels.md` | **Historical** | Original design exploration, not a build reference. |
| `activity-detail-and-form-redesign-spec.md` | **Implemented** | Unified view/edit detail modal, form redesign, table changes. |
| `org-settings-build-spec.md` | **Implemented** | Block schedule, academic terms, rotation days. |
| `calendar-management-build-spec.md` | **Implemented** | School days, exceptions, per-reason rotation. |
| `student-agenda-today-view-build-spec.md` | **Implemented** | Student TodayView agenda built - buttons and functions need spec. |
| `teacher-agenda-build-spec.md` | **Implemented** | Teacher Dashboard, roster modal, attendance marking. |
| `student-actions-build-spec.md` | **Implemented** | Student action buttons and check-in flow |
| `teacher-roster-student-actions-build-spec.md` | **Implemented** | Teacher visibility of student actions |
| `student-schedule-view-build-spec.md` | **Pending Decisions** | Admin view of individual student schedule |
| `activity-management-overhaul-build-spec.md` | **Built** | Admin activity page revamp + activity_term changes |
| `user-feedback-system-build-spec.md` | **Implemented** | /Help page, FeedbackModal, submit-feedback Edge Function. Built session 16. GitHub Issues integration added session 19. |
| `admin-calendar-redesign-design-doc.md` | **Current (partially reversed)** | Full design doc for the calendar redesign feature. The "activity splitting, not enrollment overrides" decision has been reversed by `enrollment-level-scheduling-design-doc.md`. |
| `layer-0-build-spec.md` | **Implemented** | Schema integration, recurrence predicate, calendar CRUD API/hooks, ActivityDetail form fields. Built session 17. |
| `layer-1-build-spec.md` | **Implemented** | Week view, calendar sidebar, event cards, block overlay fix, empty-slot create. Built session 17. |
| `layer-2-build-spec.md` | **Implemented** | Time-slot clustering, inter-group column layout, aggregate card expansion, filter bar, recurrence-aware conflict detection. Built session 18. |
| `filter-bar-expansion-design-doc.md` | **Implemented** | Design doc for filter bar expansion (block, time range, student filters). |
| `filter-bar-expansion-build-spec.md` | **Implemented** | Block, time range, and student filters added to CalendarFilterBar. Student dimming threaded through WeekGrid → DayColumn → EventCard. Built session 20. |
| `visual-design-system-design-doc.md` | **Implemented** | App-wide visual polish: palette, typography, Phosphor icon consolidation, interaction design, component styling, block overlay removal. Design doc session 23; implemented session 24. |
| `enrollment-level-scheduling-design-doc.md` | **Implemented** | Per-student scheduling on enrollments. Schema migration, `enrollmentMeetsToday` predicate, conflict detection refactor, inline enrollment UI. Sessions 25–26. |
| `geofence-location-search-build-spec.md` | **Implemented** | Nominatim geocoding on location field, silent lat/lng capture, GPS-fix indicator, geofence radius input. Built session 28. |
| `dev-override-implementation-guide.md` | **Implemented** | Dev date/time override for demo — `getDevNow()`, `getDevToday()`, constant toggle. Built session 29. |
| `attendance-rollup-design-doc.md` | **Implemented** | Admin attendance rollup view — block groups, status sorting, exception/full toggle, conflict detection. Built session 31. |
| `public-facing-site-build-spec.md` | **Implemented** | Public landing page, trust/privacy page, about page, public layout, auth-aware root routing. Built session 33. |
| `teacher-agenda-design-direction.md` | **Current** | Input to #86. Layout rules (time-axis, role-ordered row-fill, aggregation by time+role, cluster popover), late-arrival treatment, sidebar logic, open questions. Reference artifact: `teacher-agenda-demo-v2.html`. Session 37. |
| `role-derivation-helper-build-spec.md` | **Implemented** | `src/lib/staffRoles.js` with `getViewerRole(activity, viewerId)`. Merged as #90, session 39. |
| `visible-to-all-staff-flag-build-spec.md` | **Implemented** | `visible_to_all_staff BOOLEAN` on `activities` + `ActivityDetail` behavior flags row. Flag dormant until #86 consumes it. Merged as #91, session 39. |
| `enrollment-time-overrides-build-spec.md` | **Implemented** | `start_time_override` / `end_time_override` on `enrollments`, extended `EnrollmentScheduleEditor` and summary text, `canEdit` gate relaxed. Data layer for #87. Merged as #92, session 39. |
| `teacher-agenda-86.1-overlap-resolution-design.md` | **Implemented** | Sub-area design for #86. `SingleDayAgenda` content-agnostic overlap-resolving primitive via interval-graph greedy coloring. Closes #88. See build spec. Session 40; built session 41. |
| `teacher-agenda-86.1-overlap-resolution-build-spec.md` | **Implemented** | Build spec for 86.1. `SingleDayAgenda` column layout, PX_PER_HOUR increase, greedy coloring algorithm. Built session 41. |
| `teacher-agenda-86.2-dashboard-and-clustering-design.md` | **Implemented** | Sub-area design for #86. Role-aware time clustering replaces block-aggregation in `Dashboard.jsx`. Cluster card, cluster popover, transformation pipeline. Resolves cluster title and peek text open questions. Session 40; built session 41. |
| `teacher-agenda-86.2-dashboard-and-clustering-build-spec.md` | **Implemented** | Build spec for 86.2. `TeacherActivityCard`, cluster cards, cluster popover, `buildTeacherRenderables` pipeline. Built session 41. |
| `teacher-agenda-86.3-late-arrival-ui-design.md` | **Implemented** | Sub-area design for #86. Amber chip on cards/clusters, "Arriving later" roster section. Consumes session 39's enrollment time overrides. Closes UI side of #87. Session 40; built session 41. |
| `teacher-agenda-86.3-late-arrival-ui-build-spec.md` | **Implemented** | Build spec for 86.3. Late-arrival amber chip, "Arriving later" roster section, `end_time_override` inline annotation. Built session 41. |
| `teacher-agenda-86.4-block-attendance-and-combined-roster-design.md` | **Implemented** | Sub-area design for #86. Block-attendance button row + combined roster modal. "Mark all P" stays per-section (interim, pending future default-attendance-mode feature). Session 40; built session 41. |
| `teacher-agenda-86.4-block-attendance-combined-roster-build-spec.md` | **Implemented** | Build spec for 86.4. Block attendance button row, `BlockRosterModal` combined roster. Built session 41. |
| `teacher-agenda-86.5-sidebar-and-rls-extension-design.md` | **Implemented** | Sub-area design for #86. Sidebar surfaces visible-to-all activities (yours / others' sections). RLS extension on `enrollments`/`activity_instances`/`attendance_records`. Path A confirmed. Session 40; built session 41. |
| `teacher-agenda-86.5-sidebar-and-rls-extension-build-spec.md` | **Implemented** | Build spec for 86.5. `AgendaSidebar` visible-to-all sections, `buildOthersRenderables`, RLS migrations 000001–000002. Built session 41. |
| `realtime-attendance-subscription-build-spec.md` | **Implemented** | `useAttendanceSubscription` hook + wired into `useRoster`. Migration adds `attendance_records` to `supabase_realtime` publication. Built session 42, closes #80. |
| `activity-staff-junction-table-build-spec.md` | **Implemented** | `activity_staff` junction table + multi-staff edit form (#70, fully closed). Migration, `getViewerRole`/`getActivityStaff` helpers, `setActivityStaff` diff-reconcile, query layer, view-mode and multi-staff edit UI. Built session 43. |
| `action-history-feed-build-spec.md` | **Implemented** | Action history feed (#71). `/history` route (role-dispatched), student + teacher `HistoryView` pages, `FeedEntryCard`, `StudentActionFeed`, `RecentActivityWidget` for TodayView and teacher sidebar. `src/api/history.js` + `src/api/profiles.js` (shared profile helpers). Built session 47. |

## Workflow

Design decisions and feature planning happen in conversation with Daniel before implementation. This project follows a discuss-then-build pattern — by the time a task reaches Claude Code, the "what" and "why" should be documented.

- Check `STATUS.md` for current priorities and next steps
- Look for feature specs in `docs/design-and-specs/` — see the full table above for what's available and its status
- The app is designed as a **schedule-building tool** — structure (blocks, templates) emerges from data (activities with real times), not the other way around. UI decisions should reflect this: don't gate features behind setup steps that haven't been completed yet.

## Issue Tracking

Issues are tracked in [GitHub Issues](https://github.com/danlang422/here-app/issues). Use the GitHub CLI or GitHub API to access issues from the repo. User-submitted feedback (via the /help page) posts directly to GitHub Issues through the `submit-feedback` Edge Function.

GitHub repo: `danlang422/here-app`