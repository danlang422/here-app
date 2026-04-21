# Tech Stack & Project Structure

**Last updated:** April 2026 (session 35)

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
- **Phosphor Icons** (`@phosphor-icons/react`) — Icon library. Consistent design language, tree-shakeable imports.
- **DiceBear** (`@dicebear/core`, `@dicebear/collection`) — Avatar generation. Deterministic SVG avatars from seed strings.
- **Variable fonts** — `@fontsource-variable/outfit` and `@fontsource-variable/plus-jakarta-sans` for UI typography.

### Development Tools

- **ESLint** (flat config, ESLint 9+) — Code linting
- **Prettier** — Code formatting
- **Vite DevTools** — Development utilities

---

## Project Structure

```
here-app/
├── docs/                           # Project documentation
│   ├── architecture/              # This directory
│   ├── business-logic/            # Schedule, attendance, check-in rules
│   ├── schema/                    # Database schema (source of truth)
│   └── user-flows/                # Role-specific UX narratives
│
├── public/                         # Static assets
│
├── src/
│   ├── api/                       # Supabase query functions, one file per domain
│   │   ├── supabase.js           # Supabase client setup
│   │   ├── auth.js               # Authentication functions
│   │   ├── activities.js         # Activity CRUD
│   │   ├── activityTerms.js      # Activity ↔ term relationships
│   │   ├── agenda.js             # Agenda queries (student + teacher)
│   │   ├── attendance.js         # Attendance record queries
│   │   ├── calendars.js          # School calendar queries
│   │   ├── enrollments.js        # Enrollment queries
│   │   ├── feedback.js           # User feedback submissions
│   │   ├── instances.js          # Activity instance upsert/queries
│   │   ├── organizations.js      # Org settings queries
│   │   ├── scheduleTemplates.js  # Schedule template queries
│   │   ├── schoolDays.js         # School day calendar queries
│   │   ├── terms.js              # Term queries
│   │   └── users.js              # User profile queries
│   │
│   ├── components/
│   │   ├── activities/           # ActivityDetailModal, ActivityTable, ActivityToolbar,
│   │   │                         #   ActivityDetail, StaffRows, ActivitySelectionBar, BulkEditModal
│   │   ├── agenda/               # SingleDayAgenda, StudentActivityCard, TeacherActivityCard,
│   │   │                         #   AgendaBlockOverlay
│   │   ├── attendance-rollup/    # AttendanceRollup, RollupBlockSection, RollupDatePicker,
│   │   │                         #   RollupStudentRow
│   │   ├── enrollment/           # EnrollmentPanel
│   │   ├── feedback/             # FeedbackModal, FeedbackForm, BugReportForm,
│   │   │                         #   ScheduleIssueForm, ScreenshotPicker
│   │   ├── layout/               # AppLayout, AdminLayout, AuthProvider, ProtectedRoute,
│   │   │                         #   PublicLayout, RootRedirect
│   │   ├── panels/               # FloatingPanel
│   │   ├── roster/               # RosterModal, StudentDetailOverlay
│   │   ├── schedule-calendar/    # CalendarView, CalendarWeekGrid, CalendarWeekNav,
│   │   │                         #   CalendarDayColumn, CalendarEventCard, CalendarEventPopover,
│   │   │                         #   CalendarAggregatePopover, CalendarFilterBar, CalendarSidebar
│   │   ├── school-calendar/      # CalendarGrid, DayPopover
│   │   ├── student/              # ActionButton, FreeformTagSelector, StatusUpdateModal
│   │   ├── ui/                   # Toast
│   │   └── users/                # UserTable, UserForm, BulkUserEntry
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAuth.js
│   │   ├── useActivities.js
│   │   ├── useActivityTerms.js
│   │   ├── useAttendanceRollup.js
│   │   ├── useBulkEditActivities.js
│   │   ├── useCalendars.js
│   │   ├── useEnrollments.js
│   │   ├── useOrgSettings.js
│   │   ├── useRoster.js
│   │   ├── useScheduleTemplate.js
│   │   ├── useSchoolDays.js
│   │   ├── useStreakData.js
│   │   ├── useStudentActions.js
│   │   ├── useStudentAgenda.js
│   │   ├── useStudentInstanceDetail.js
│   │   ├── useTeacherActionSummary.js
│   │   ├── useTeacherAgenda.js
│   │   ├── useTerms.js
│   │   └── useUsers.js
│   │
│   ├── lib/
│   │   ├── actionAvailability.js  # Rules for which student actions are available
│   │   ├── constants.js           # Block labels, org constants
│   │   ├── date.js                # Date formatting helpers
│   │   ├── devOverrides.js        # Dev-only overrides
│   │   ├── enrollmentValidation.js # Conflict detection logic
│   │   ├── geofenceUtils.js       # Geofence validation
│   │   ├── nominatimSearch.js     # Address search (Nominatim API)
│   │   ├── scheduleUtils.js       # Pure date/schedule utilities (no external library)
│   │   ├── streakUtils.js         # Presence wave streak calculation
│   │   ├── utils.js               # General utilities
│   │   └── business-logic/
│   │       ├── rotation.js        # Rotation day calculation
│   │       ├── scheduling.js      # "Does this activity meet today?" logic
│   │       └── schoolDayGeneration.js
│   │
│   ├── pages/
│   │   ├── admin/                 # Dashboard, ActivityManagement, CalendarManagement,
│   │   │                          #   UserManagement, OrgSettings, Reports
│   │   ├── auth/                  # Login, ForgotPassword, ResetPassword
│   │   ├── public/                # LandingPage, AboutPage, TrustPage
│   │   ├── student/               # TodayView
│   │   ├── teacher/               # Dashboard
│   │   ├── Account.jsx
│   │   ├── DashboardRedirect.jsx
│   │   └── HelpPage.jsx
│   │
│   ├── store/
│   │   ├── authStore.js           # Auth state (current user, active role)
│   │   ├── calendarUiStore.js     # Calendar view state
│   │   ├── toastStore.js          # Toast notification queue
│   │   └── uiStore.js             # General UI state (modals, selected date)
│   │
│   ├── App.jsx                    # Root component with routes
│   ├── index.css                  # Tailwind imports + global CSS
│   └── main.jsx                   # Entry point
│
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── vite.config.js
└── README.md
```

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
