# Here App

Attendance tracking and student engagement for City View Community High School.

## What It Does

Here replaces spreadsheet-based attendance tracking with a web app that handles City View's complex scheduling: A/B day rotations shared with district high schools, Kirkwood Community College courses on MWF/TuTh patterns, off-campus internships with geolocation check-ins, freeform independent study blocks, and monitoring sessions where one teacher oversees students doing different things.

**For students:** Daily schedule view, check-in/out with geolocation, presence waves with streak tracking, status updates (plans, progress, reflections).

**For teachers:** Roster view with real-time check-in status, attendance marking, posts and comments on student work, activity-based grouping for monitoring sessions.

**For admins:** Calendar management with rotation scheduling and special schedule templates, activity creation with unified form for all types, enrollment management with overlap prevention, system-wide reporting.

## Tech Stack

- **Frontend:** React 19 + Vite, React Router v6
- **Styling:** Tailwind CSS + DaisyUI
- **Backend:** Supabase (PostgreSQL, Auth, Real-time)
- **Data:** TanStack Query v5, Zustand, React Hook Form

## Getting Started

```bash
git clone <repository-url>
cd here-app
npm install
cp .env.example .env.local
# Add your Supabase credentials to .env.local
npm run dev
```

Requires Node.js 18+ and a Supabase project. See `docs/architecture/01-tech-stack-and-structure.md` for full setup details.

### Database Setup

Run the migration files in `supabase/migrations/` in order against your Supabase project's SQL editor. The reset script wipes any existing tables; the four phase files create the V2 schema from scratch.

## Project Structure

```
here-app/
├── docs/
│   ├── schema/           # Database tables, constraints, queries, RLS, migrations
│   ├── business-logic/   # Schedule, attendance, check-in, enrollment validation
│   ├── architecture/     # Tech stack, data flow, auth, realtime, UI patterns
│   └── USER_FLOWS.md     # User workflows (needs update)
├── supabase/
│   └── migrations/       # SQL migration files (reset + 4 phases)
├── src/                  # Application code (not yet started)
├── STATUS.md             # Current project status and next steps
└── README.md
```

## Documentation

Start with `STATUS.md` for current project state and next steps. For details:

- **[Schema docs](./docs/schema/README.md)** — Source of truth for database design
- **[Business logic](./docs/business-logic/README.md)** — Rules, algorithms, validation
- **[Architecture](./docs/architecture/README.md)** — Tech decisions and patterns
- **[Migration files](./supabase/migrations/)** — SQL to create the database

## Key Design Decisions

**Everything is an activity.** Regular classes, college courses, external HS courses, internships, freeform blocks — all live in one `activities` table. The `type` field is a UI hint, not a behavioral switch.

**Prevent conflicts, don't resolve them.** Scheduling overlaps are caught at enrollment time by checking block, days of week, and rotation day type. There's no runtime priority system or conflict resolution. A student's schedule is exactly what it appears to be.

**Lazy instance creation.** Activity instances (a specific activity on a specific date) are created on first interaction, not pre-generated.

## Scripts

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

---

Built for City View Community High School, Cedar Rapids, Iowa.
