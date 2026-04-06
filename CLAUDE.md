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

**Hooks** (`src/hooks/`): `useAuth`, `useActivities`, `useActivityTerms`, `useBulkEditActivities`, `useCalendars`, `useEnrollments`, `useOrgSettings`, `useRoster`, `useScheduleTemplate`, `useSchoolDays`, `useStreakData`, `useStudentActions`, `useStudentAgenda`, `useStudentInstanceDetail`, `useTeacherActionSummary`, `useTeacherAgenda`, `useTerms`, `useUsers`

## Coding Conventions

- **API layer:** One file per domain in `src/api/`. Functions use the shared Supabase client, throw on error, and return `data`. Query-building functions accept filter objects as a second parameter (see `getActivities` pattern).
- **State:** Zustand stores in `src/store/` with `persist` middleware where needed (auth persists role selection only). No Redux.
- **Components:** DaisyUI component classes as the baseline, extended with Tailwind utilities. Form components designed to be container-agnostic (work in pages, modals, or panels).
- **Path aliases:** Use `@/` for `src/` imports (e.g., `import { supabase } from '@/api/supabase'`).
- **React Query / React Hook Form:** Custom hooks in `src/hooks/` wrap API functions with TanStack Query. Pages use these hooks for server state. Forms use `useForm()` from React Hook Form with `register`, `watch`, and `setValue`. Mutations invalidate parent list queries on success.

## Key Architectural Decisions

**Everything is an activity.** Regular classes, college courses, internships, freeform blocks — all in one `activities` table, configured entirely through scheduling fields and behavior flags. There is no type system.

**Prevent conflicts, don't resolve them.** Enrollment validation checks block + days_of_week + rotation_day_type overlap at enrollment time. A student's schedule is exactly what it appears to be — there's no runtime priority system.

**Lazy instance creation.** `activity_instances` rows (a specific activity on a specific date) are created on first interaction, not pre-generated.

**Dynamic block count.** Block count is org-defined via `organization.settings.block_count`, not hardcoded. Use `getBlocks(blockCount)`, `getBlockLabel()`, `getBlockLabels()` from `src/lib/constants.js` — never hardcode block ranges.

**Progressive/optional setup.** Never force admins to define X before Y. Activities can be created before blocks or terms exist. The app gets smarter as more info is filled in.

**Activity form is container-agnostic.** `ActivityForm` works in full-page, modal, or slide-over — designed for future reuse across admin views.

**Two modes of conflict detection.** Block-based (`wouldConflictByBlock`) is the enrollment gatekeeper — it prevents double-booking within a block and is a hard gate. Time-based (`wouldConflictByTime`) is for scheduling visibility — it shows whether activities overlap in actual time, returns overlap/gap in minutes, and is informational only. These are separate because activity times don't always match block boundaries (e.g. an external course assigned to Block 0 may not span Block 0's full time range). Block assignment is organizational (admin judgment), not validated against time. See `src/lib/enrollmentValidation.js`.

**Enrollment is a workflow, not a page.** The enrollment UI is built from composable pieces (StudentSelector, ActivitySelector, EnrollmentFlow) that can be initiated from multiple contexts — activity management, schedule overview, etc. The two-panel flow is: select students → pick activity target → validate → enroll.

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

Schema docs are in `docs/schema/` — these are the authoritative source for table structure, constraints, and RLS policies.

## Documentation Map

| Location | Contents |
|---|---|
| `STATUS.md` | Current state, recent decisions, next steps — **read this first** |
| `docs/schema/` | DB tables, constraints, indexes, queries, RLS, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns |
| `docs/session-notes/` | Per-session development logs (what was built, decisions made, issues encountered) |
| `docs/user-flows/` | Per-feature documentation 

## Workflow

Design decisions and feature planning happen in conversation with Daniel before implementation. This project follows a discuss-then-build pattern — by the time a task reaches Claude Code, the "what" and "why" should be documented.

- Check `STATUS.md` for current priorities and next steps
- Look for user flow docs in `docs/user-flows/` for feature-specific behavior specs (this directory is being built out incrementally, feature by feature)
- The app is designed as a **schedule-building tool** — structure (blocks, templates) emerges from data (activities with real times), not the other way around. UI decisions should reflect this: don't gate features behind setup steps that haven't been completed yet.

## Issue Tracking

Issues are tracked in [GitHub Issues](https://github.com/danlang422/here-app/issues). Use the GitHub CLI or GitHub API to access issues from the repo. User-submitted feedback (via the /help page) posts directly to GitHub Issues through the `submit-feedback` Edge Function.

GitHub repo: `danlang422/here-app`