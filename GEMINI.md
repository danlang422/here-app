# GEMINI.md

This file provides comprehensive context and instructional guidance for Gemini CLI interactions within the Here App codebase.

## Project Overview

**Here** is an attendance tracking and student engagement application built for City View Community High School. It is designed to handle the school's unique, non-traditional scheduling needs, including:
- A/B day rotations.
- College courses (Kirkwood Community College) on MWF/TuTh patterns.
- Off-campus internships with geolocation check-ins.
- Independent study blocks and monitoring sessions.

### Core Philosophy
- **"Everything is an activity"**: Classes, internships, and study blocks all live in a single `activities` table. Their behavior is defined by scheduling fields and flags rather than a fixed "type" system.
- **Prevent conflicts, don't resolve them**: Overlaps are detected during enrollment. A student's schedule is definitive; there is no runtime priority system.
- **Lazy instance creation**: Specific activity instances (e.g., "Math on Tuesday") are created only when the first interaction (like attendance marking) occurs.
- **Blocks as reporting labels**: Actual start/end times are the source of truth for scheduling. Blocks are used for organization and reporting.

## Tech Stack

- **Frontend**: React 19, Vite, React Router v7
- **Data Management**: TanStack Query v5 (server state), Zustand (client state)
- **Forms**: React Hook Form
- **Styling**: Tailwind CSS v4, DaisyUI v5 (uses CSS variables for themes)
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Realtime, Edge Functions)
- **Icons**: Phosphor Icons (`@phosphor-icons/react`), DiceBear (avatars)

## Project Structure

```text
here-app/
├── docs/               # Comprehensive documentation (Schema, Business Logic, Architecture)
├── src/                # React application source code
│   ├── api/            # Supabase interaction layers (one file per domain)
│   ├── components/     # UI components organized by feature (activities, agenda, roster, etc.)
│   ├── hooks/          # Custom hooks wrapping API calls with TanStack Query
│   ├── lib/            # Utilities, constants, and shared logic (date.js, constants.js)
│   ├── pages/          # Route-level components (admin/, auth/, student/, teacher/)
│   ├── store/          # Zustand state stores (authStore.js, uiStore.js)
│   └── App.jsx         # Routing and application entry point
├── supabase/           # Database configuration and migrations
│   └── migrations/     # SQL migration files (V2 schema)
├── CLAUDE.md           # Primary context file for AI agents (conventions and decisions)
└── STATUS.md           # Current project status and priority next steps
```

## Building and Running

### Key Commands
- `npm run dev`: Starts the development server at `localhost:5173`.
- `npm run build`: Generates the production build in the `dist/` directory.
- `npm run lint`: Executes ESLint for code quality checks.
- `npm run preview`: Previews the production build locally.

### Environment Setup
Requires a `.env.local` file with the following variables:
- `VITE_SUPABASE_URL`: Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous API key.

## Development Conventions

### Coding Style & Patterns
- **Path Aliases**: Use `@/` to reference the `src/` directory (e.g., `import { ... } from '@/api/supabase'`).
- **API Layer**: Keep one file per domain in `src/api/`. Functions should throw on error and return `data`.
- **State Management**: Use Zustand for client-side state. Use TanStack Query (via custom hooks in `src/hooks/`) for all server-side data fetching and mutations.
- **Form Handling**: Use React Hook Form's `useForm()` hook. Components should be container-agnostic where possible.
- **Styling**: Prefer DaisyUI classes supplemented by Tailwind CSS utilities.
- **DaisyUI v5 Variable Usage**: Use `var(--color-primary)` directly in CSS. Do not wrap in `oklch()` as DaisyUI v5 variables already include the color space.

### Architecture Guidelines
- **Block Management**: Never hardcode block counts. Use `organization.settings.block_count` and utilities in `src/lib/constants.js`.
- **Auth Implementation**: Note that `fetchProfile` in `useAuthListener` uses raw `fetch` to avoid a specific `supabase-js` v2.95 deadlock.
- **Conflict Detection**:
    - `wouldConflictByBlock`: Hard gate for enrollment.
    - `wouldConflictByTime`: Informational for scheduling visibility.

## Documentation Reference

| Document | Purpose |
| --- | --- |
| `STATUS.md` | **Read this first** for current priorities and completed features. |
| `CLAUDE.md` | Detailed architectural decisions, coding conventions, and command list. |
| `docs/schema/` | Authoritative source for DB structure, RLS policies, and indexes. |
| `docs/business-logic/` | Rules for scheduling, attendance, and enrollment validation. |
| `docs/user-flows/` | Feature-specific build specifications and UX narratives. |
