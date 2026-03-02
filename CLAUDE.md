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

## Key Architectural Decisions

**Everything is an activity.** Regular classes, college courses, internships, freeform blocks — all in one `activities` table. `type` is a UI hint, not a behavioral switch.

**Prevent conflicts, don't resolve them.** Enrollment validation checks block + days_of_week + rotation_day_type overlap at enrollment time. A student's schedule is exactly what it appears to be — there's no runtime priority system.

**Lazy instance creation.** `activity_instances` rows (a specific activity on a specific date) are created on first interaction, not pre-generated.

**Dynamic block count.** Block count is org-defined via `organization.settings.block_count`, not hardcoded. Use `getBlocks(blockCount)`, `getBlockLabel()`, `getBlockLabels()` from `src/lib/constants.js` — never hardcode block ranges.

**Progressive/optional setup.** Never force admins to define X before Y. Activities can be created before blocks or terms exist. The app gets smarter as more info is filled in.

**Activity form is container-agnostic.** `ActivityForm` works in full-page, modal, or slide-over — designed for future reuse across admin views.

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
| `docs/USER_FLOWS.md` | **Outdated — do not rely on schema references here.** Written in February 2026 before V2 schema was finalized. References old conflict resolution model (priority-based / enrollment_overrides) and old V1 "sessions" terminology. Use `docs/schema/` and `docs/business-logic/` for accurate data model details. |
