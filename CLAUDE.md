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
- **TanStack Query v5** — server state (installed, not yet used — manual `useState` patterns in place)
- **Zustand** — client state (auth, UI)
- **React Hook Form** — forms (installed, not yet used)
- **Tailwind CSS v4** + **DaisyUI v5** — styling
- **React Icons** + **DiceBear** — icons, avatars

## Environment Variables

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Copy `.env.example` to `.env.local` and fill in Supabase credentials.

## Project Structure

```
src/
├── api/            # Supabase query functions, one file per domain
├── components/     # Reusable components (activities/, layout/)
├── hooks/          # Custom React hooks (useAuth.js)
├── lib/            # Utilities and constants
├── pages/          # Route-level components (admin/, auth/, student/, teacher/)
├── store/          # Zustand stores (authStore.js, uiStore.js)
├── App.jsx         # Root component with routes
└── main.jsx        # Entry point
```

## Coding Conventions

- **API layer:** One file per domain in `src/api/`. Functions use the shared Supabase client, throw on error, and return `data`. Query-building functions accept filter objects as a second parameter (see `getActivities` pattern).
- **State:** Zustand stores in `src/store/` with `persist` middleware where needed (auth persists role selection only). No Redux.
- **Components:** DaisyUI component classes as the baseline, extended with Tailwind utilities. Form components designed to be container-agnostic (work in pages, modals, or panels).
- **Path aliases:** Use `@/` for `src/` imports (e.g., `import { supabase } from '@/api/supabase'`).
- **React Query / React Hook Form:** Installed but not yet integrated. Current pages use manual `useState` + `useEffect` patterns. A dedicated refactor session is the next planned task — don't convert individual pages piecemeal, do them all at once.

## Key Architectural Decisions

**Everything is an activity.** Regular classes, college courses, internships, freeform blocks — all in one `activities` table. `type` is a UI hint, not a behavioral switch.

**Prevent conflicts, don't resolve them.** Enrollment validation checks block + days_of_week + rotation_day_type overlap at enrollment time. A student's schedule is exactly what it appears to be — there's no runtime priority system.

**Lazy instance creation.** `activity_instances` rows (a specific activity on a specific date) are created on first interaction, not pre-generated.

**Dynamic block count.** Block count is org-defined via `organization.settings.block_count`, not hardcoded. Use `getBlocks(blockCount)`, `getBlockLabel()`, `getBlockLabels()` from `src/lib/constants.js` — never hardcode block ranges.

**Progressive/optional setup.** Never force admins to define X before Y. Activities can be created before blocks or terms exist. The app gets smarter as more info is filled in.

**Activity form is container-agnostic.** `ActivityForm` works in full-page, modal, or slide-over — designed for future reuse across admin views.

**Two modes of conflict detection.** Block-based (`wouldConflictByBlock`) is the enrollment gatekeeper — it prevents double-booking within a block and is a hard gate. Time-based (`wouldConflictByTime`) is for scheduling visibility — it shows whether activities overlap in actual time, returns overlap/gap in minutes, and is informational only. These are separate because activity times don't always match block boundaries (e.g. an external course assigned to Block 0 may not span Block 0's full time range). Block assignment is organizational (admin judgment), not validated against time. See `src/lib/enrollmentValidation.js`.

**Enrollment is a workflow, not a page.** The enrollment UI is built from composable pieces (StudentSelector, ActivitySelector, EnrollmentFlow) that can be initiated from multiple contexts — activity management, schedule overview, etc. The two-panel flow is: select students → pick activity target → validate → enroll.

**Raw fetch in useAuthListener.** `fetchProfile` uses raw `fetch` instead of the Supabase client due to a deadlock in supabase-js v2.95 inside `onAuthStateChange`. Don't change this pattern until supabase-js is upgraded.

## Database

V2 schema with migrations in `supabase/migrations/`. Run them in order against your Supabase project's SQL editor. Key migrations:

- `20260225000001–0004` — V2 schema (4 phases: core, activities, attendance, social/RLS/indexes)
- `20260301000000` — RLS fix for user_profiles
- `20260301000001` — Dynamic block count (loosened constraints, removed `<= 5` ceiling)
- `20260301000002` — Admin RLS policies

Schema docs are in `docs/schema/` — these are the authoritative source for table structure, constraints, and RLS policies.

## Documentation Map

| Location | Contents |
|---|---|
| `STATUS.md` | Current state, recent decisions, next steps — **read this first** |
| `docs/schema/` | DB tables, constraints, indexes, queries, RLS, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns |
| `docs/session-notes/` | Per-session development logs (what was built, decisions made, issues encountered) |
| `docs/USER_FLOWS.md` | **Outdated — do not rely on schema or data model references.** Describes V1 concepts (priority-based conflict resolution, enrollment_overrides, "sessions" terminology). Being replaced by per-feature docs in `docs/user-flows/`. Use `docs/schema/` and `docs/business-logic/` for accurate data model details. |

## Workflow

Design decisions and feature planning happen in conversation with Daniel before implementation. This project follows a discuss-then-build pattern — by the time a task reaches Claude Code, the "what" and "why" should be documented.

- Check `STATUS.md` for current priorities and next steps
- Look for user flow docs in `docs/user-flows/` for feature-specific behavior specs (this directory is being built out incrementally, feature by feature)
- The app is designed as a **schedule-building tool** — structure (blocks, templates) emerges from data (activities with real times), not the other way around. UI decisions should reflect this: don't gate features behind setup steps that haven't been completed yet.