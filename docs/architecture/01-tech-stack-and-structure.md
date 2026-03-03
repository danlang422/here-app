# Tech Stack & Project Structure

## Technology Stack

### Core Framework

- **Vite** — Build tool and dev server. Fast HMR, optimized production builds, native ESM support, simple configuration.
- **React 19** — UI library. Functional components with Hooks, `use()` hook for promises and context, ref as prop (no more forwardRef), improved Suspense for data fetching.

### Routing

- **React Router v7** — Client-side routing. Declarative routing configuration, nested routes, URL parameter handling, programmatic navigation.

### Backend & Database

- **Supabase** — Backend-as-a-Service built on PostgreSQL. Provides the database, built-in authentication, Row Level Security (RLS), real-time subscriptions via WebSocket channels, and storage for future file uploads. Edge Functions available for complex server-side logic if needed.

### Data Management

- **TanStack Query (React Query) v5** — Server state management. Automatic caching, background refetching, optimistic updates, pagination, infinite queries, mutations with rollback.

### Client State

- **Zustand** — Client state management. Lightweight (< 1kb), simple API, no boilerplate, DevTools support. Used for UI state: modals, sidebar visibility, role selection, date selection.

### Forms

- **React Hook Form** — Form state and validation. Minimal re-renders, built-in validation rules, TypeScript support, handles complex multi-step forms.

### UI & Styling

- **Tailwind CSS** — Utility-first CSS framework. Rapid development, consistent design system, tree-shakeable output.
- **DaisyUI** — Component library for Tailwind. Pre-built accessible components (buttons, cards, modals, badges, etc.), customizable themes, semantic class names.
- **React Icons** — Icon library. Tree-shakeable imports from Lucide, Hero Icons, Font Awesome, and others.
- **DiceBear** — Avatar generation. Deterministic SVG avatars from seed strings.

### Development Tools

- **ESLint** (flat config, ESLint 9+) — Code linting
- **Prettier** — Code formatting
- **Vite DevTools** — Development utilities

---

## Project Structure

> **Note (March 2026):** The structure below is the planned layout. Many files listed here don't exist yet — particularly in `src/hooks/`, `src/components/ui/`, `src/components/student/`, `src/components/teacher/`, and `src/components/shared/`. What currently exists: `src/hooks/useAuth.js`, `src/components/activities/`, `src/components/users/`, `src/components/layout/`, `src/api/` (activities, auth, calendar, enrollments, instances, organizations, supabase, users), `src/store/` (authStore, uiStore), and `src/lib/` (constants, date, utils, enrollmentValidation, business-logic/rotation.js, business-logic/scheduling.js). The structure also omits `src/lib/enrollmentValidation.js` which lives at the `lib/` level rather than inside `business-logic/`. Treat this as a target, not a directory listing.

```
here-app/
├── docs/                           # Project documentation
│   ├── architecture/              # This directory
│   ├── business-logic/            # Schedule, attendance, check-in rules
│   ├── schema/                    # Database schema (source of truth)
│   └── user-flows/                # Role-specific UX narratives
│
├── public/                         # Static assets
│   ├── favicon.ico
│   └── manifest.json              # PWA manifest (future)
│
├── src/
│   ├── api/                       # Supabase API functions (one file per domain)
│   │   ├── supabase.js           # Supabase client setup
│   │   ├── auth.js               # Authentication functions
│   │   ├── activities.js         # Activity queries (replaces sessions.js / students.js)
│   │   ├── attendance.js         # Attendance record queries
│   │   ├── checkins.js           # Check-in/out queries
│   │   ├── enrollments.js        # Enrollment queries
│   │   ├── instances.js          # Activity instance upsert/queries
│   │   ├── posts.js              # Posts, responses, comments
│   │   ├── notifications.js      # Notification queries
│   │   └── calendar.js           # Terms, school days, schedule templates
│   │
│   ├── components/                # Reusable components
│   │   ├── ui/                   # Base UI components (DaisyUI wrappers/custom)
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── Badge.jsx
│   │   │
│   │   ├── layout/               # Layout components
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── BottomNav.jsx
│   │   │   └── PageContainer.jsx
│   │   │
│   │   ├── student/              # Student-specific components
│   │   │   ├── BlockCard.jsx
│   │   │   ├── CheckInButton.jsx
│   │   │   ├── PresenceWaveButton.jsx
│   │   │   ├── FreeformTagPicker.jsx
│   │   │   └── StatusUpdateForm.jsx
│   │   │
│   │   ├── teacher/              # Teacher-specific components
│   │   │   ├── ActivityCard.jsx
│   │   │   ├── StudentRoster.jsx
│   │   │   ├── AttendanceRow.jsx
│   │   │   ├── CheckInMonitor.jsx
│   │   │   └── PostComposer.jsx
│   │   │
│   │   ├── admin/                # Admin-specific components
│   │   │   ├── CalendarEditor.jsx
│   │   │   ├── ActivityForm.jsx
│   │   │   ├── EnrollmentManager.jsx
│   │   │   └── UserManagement.jsx
│   │   │
│   │   └── shared/               # Cross-role components
│   │       ├── Avatar.jsx
│   │       ├── DatePicker.jsx
│   │       ├── LoadingSpinner.jsx
│   │       └── ErrorBoundary.jsx
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAuth.js            # Authentication hook
│   │   ├── useStudentSchedule.js # Student schedule for a date
│   │   ├── useTeacherRoster.js   # Teacher roster for a block/date
│   │   ├── useActivityInstance.js # Lazy instance upsert
│   │   ├── useCheckIn.js         # Check-in/out logic
│   │   ├── useGeolocation.js     # Location tracking
│   │   └── useRealtime.js        # Real-time subscription wrapper
│   │
│   ├── lib/                       # Utilities and helpers
│   │   ├── utils.js              # General utilities
│   │   ├── date.js               # Date formatting/manipulation
│   │   ├── validation.js         # Validation functions
│   │   ├── constants.js          # App constants
│   │   └── business-logic/       # Business logic implementations
│   │       ├── rotation.js       # Rotation day calculation
│   │       ├── scheduling.js     # "Activity meets today" resolution
│   │       ├── geofence.js       # Geofence validation
│   │       └── streak.js         # Presence wave streak calculation
│   │
│   ├── pages/                     # Page components (route targets)
│   │   ├── student/
│   │   │   ├── TodayView.jsx
│   │   │   ├── AttendanceHistory.jsx
│   │   │   └── Settings.jsx
│   │   │
│   │   ├── teacher/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── BlockDetail.jsx   # Roster view for a single block
│   │   │   └── AttendanceReports.jsx
│   │   │
│   │   ├── admin/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Calendar.jsx
│   │   │   ├── Activities.jsx    # Activity CRUD + enrollment management
│   │   │   ├── Users.jsx
│   │   │   └── Reports.jsx
│   │   │
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   └── ResetPassword.jsx
│   │   │
│   │   └── NotFound.jsx
│   │
│   ├── store/                     # Zustand stores
│   │   ├── uiStore.js            # UI state (modals, sidebar, selected date)
│   │   ├── authStore.js          # Auth state (current user, active role)
│   │   └── preferencesStore.js   # User preferences
│   │
│   ├── styles/                    # Global styles
│   │   └── index.css             # Tailwind imports + custom CSS
│   │
│   ├── App.jsx                    # Root component with routes
│   ├── main.jsx                   # Entry point
│   └── router.jsx                 # Route configuration
│
├── .env.example                   # Environment variables template
├── .env.local                     # Local environment (gitignored)
├── eslint.config.js               # ESLint flat config (ESLint 9+)
├── .prettierrc                    # Prettier configuration
├── index.html                     # HTML entry point
├── package.json                   # Dependencies and scripts
├── postcss.config.js              # PostCSS config (for Tailwind)
├── tailwind.config.js             # Tailwind + DaisyUI configuration
├── vite.config.js                 # Vite configuration
└── README.md                      # Project overview and setup
```

### Key differences from V1 structure

The `src/api/` directory reflects the unified activity model. There is no `sessions.js` — all activity queries go through `activities.js`. A new `instances.js` file handles the lazy `activity_instances` upsert pattern. The `posts.js` file replaces what would have been `interactions.js`, covering posts, post responses, and comments. The `calendar.js` file covers terms, school days, and schedule templates.

In `src/components/`, the teacher directory has `ActivityCard` instead of `SessionCard`, and includes `PostComposer` for the new social layer. The student directory adds `FreeformTagPicker` for the freeform block tagging flow. The admin directory has `ActivityForm` (unified form for all activity types) and `EnrollmentManager` instead of separate session/student-activity forms.

In `src/lib/business-logic/`, the old `conflicts.js` is replaced by `scheduling.js`, which handles the "does this activity meet today?" resolution logic using `days_of_week`, `rotation_day_type`, and the school day calendar. Scheduling overlaps are prevented at the application layer during enrollment by checking whether the new activity's block, days of week, and rotation day type overlap with any of the student's existing enrollments. There is no runtime conflict resolution — if a student's schedule has no overlaps at enrollment time, it has no overlaps at display time.

---

## Environment Setup

### Environment Variables

```bash
# .env.example (committed to repo)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# .env.local (gitignored, local development)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### Vite Configuration

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
```

### Initial Setup

```bash
git clone <repository-url>
cd here-app
npm install
cp .env.example .env.local
# Edit .env.local with Supabase credentials
npm run dev
```

---

## Build & Deployment

### Build Commands

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  }
}
```

### Deployment (Vercel)

Connect the GitHub repo to Vercel. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel dashboard. Auto-deploy on push to `main`.

Build settings: Framework Vite, build command `npm run build`, output directory `dist`.

### Performance: Code Splitting

Route-level code splitting via `React.lazy` and `Suspense`:

```jsx
import { lazy, Suspense } from 'react'

const TodayView = lazy(() => import('./pages/student/TodayView'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))

<Route
  path="/today"
  element={
    <Suspense fallback={<LoadingSpinner />}>
      <TodayView />
    </Suspense>
  }
/>
```

---

## Development Workflow

### Git Workflow

- `main` branch for production (auto-deploys to Vercel)
- Feature branches: `feature/check-in-flow`, `feature/admin-calendar`
- Conventional Commits format for commit messages

### Testing Strategy (Future)

- Unit tests: Vitest
- Component tests: React Testing Library
- E2E tests: Playwright
