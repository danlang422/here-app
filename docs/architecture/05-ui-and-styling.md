# UI & Styling

**Last updated:** July 2026 (docs-freshness pass — removed a stale `regular_class` badge example; activities have had no `type` column since `20260309000000_remove_activity_type.sql`. Rest of file unchanged since session 35.)

## Tailwind + DaisyUI Configuration

The project uses Tailwind CSS v4 (`@tailwindcss/postcss` 4.x) and DaisyUI v5 (5.x). The CSS entry point uses v4 syntax; a legacy `tailwind.config.js` also exists and is read by Tailwind v4 for backwards compatibility.

**DaisyUI v5 CSS variable format:** DaisyUI v5 stores theme color variables as full color values (e.g. `--color-primary: oklch(62.31% 0.1881 259.82)`), not as raw channel values. Use `var(--color-primary)` directly in CSS — never `oklch(var(--color-primary))`, which double-wraps the value and produces invalid CSS.

### CSS Entry Point (Tailwind v4 style)

```css
/* src/index.css */
@import "tailwindcss";
@plugin "daisyui";
```

### Legacy JS Config (still present, read by Tailwind v4 for backwards compatibility)

```js
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        cityview: {
          "primary": "#3b82f6",
          "secondary": "#8b5cf6",
          "accent": "#10b981",
          "neutral": "#1f2937",
          "base-100": "#ffffff",
          "info": "#0ea5e9",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
    ],
  },
}
```

The DaisyUI cityview theme defines the color palette. Once the config is migrated to CSS-only, this will move into `src/index.css` using Tailwind v4's `@theme` directive.

---

## Component Architecture

### Component Hierarchy

Routes and layouts are defined in `App.jsx`. The layout shell (`AppLayout`, `AdminLayout`, `PublicLayout`) wraps role-specific page components.

```
App (App.jsx)
├── PublicLayout
│   ├── LandingPage / AboutPage / TrustPage
│   └── auth/ (Login, ForgotPassword, ResetPassword)
│
├── AppLayout (authenticated shell)
│   ├── RootRedirect / DashboardRedirect
│   ├── student/TodayView
│   │   └── SingleDayAgenda
│   │       ├── StudentActivityCard[]
│   │       └── AgendaBlockOverlay
│   ├── teacher/Dashboard
│   │   └── SingleDayAgenda
│   │       └── TeacherActivityCard[]
│   ├── Account
│   └── HelpPage
│       └── FeedbackModal (BugReportForm, ScheduleIssueForm, FeedbackForm)
│
└── AdminLayout (admin shell)
    ├── admin/Dashboard
    ├── admin/ActivityManagement
    │   ├── ActivityToolbar / ActivityTable / ActivityDetail
    │   ├── ActivityDetailModal
    │   ├── BulkEditModal
    │   └── EnrollmentPanel
    │       └── RosterModal / StudentDetailOverlay
    ├── admin/CalendarManagement
    │   └── CalendarGrid / DayPopover (school-calendar)
    ├── admin/UserManagement
    │   └── UserTable / UserForm / BulkUserEntry
    ├── admin/OrgSettings
    ├── admin/Reports
    │   └── AttendanceRollup (RollupBlockSection, RollupDatePicker, RollupStudentRow)
    └── FloatingPanel (panels/) — used for slide-over detail views
```

### Component Conventions

- Data fetching lives in custom hooks (`src/hooks/`); components receive data as props or call hooks directly.
- Admin forms use React Hook Form with `register`, `watch`, and `setValue`. Mutations invalidate parent list queries on success.
- `ActivityDetailModal` is the primary admin UI for editing a single activity and managing its enrollments. It's designed to work in a modal or floating panel context.
- `SingleDayAgenda` is shared between student and teacher views; it receives `StudentActivityCard` or `TeacherActivityCard` depending on role.

---

## DaisyUI Component Usage

DaisyUI provides semantic CSS classes that layer on top of Tailwind. The app uses DaisyUI for structural components (cards, modals, badges, buttons, form controls) and raw Tailwind utilities for spacing, layout, and fine-grained adjustments.

### Common Patterns

```jsx
// Cards
<div className="card bg-base-100 shadow-xl">
  <div className="card-body">
    <h2 className="card-title">Activity Name</h2>
    <p>Details</p>
    <div className="card-actions justify-end">
      <button className="btn btn-primary">Action</button>
    </div>
  </div>
</div>

// Badges for attendance status (activities have no type system — see CLAUDE.md
// "Key Architectural Decisions" — so badges reflect behavior flags/state, not a type field)
<div className="badge badge-success">present</div>
<div className="badge badge-error">absent</div>
<div className="badge badge-warning">tardy</div>

// Modals via <dialog>
<dialog className="modal modal-open">
  <div className="modal-box">
    <h3 className="font-bold text-lg">Status Update</h3>
    <div className="py-4">{/* form content */}</div>
    <div className="modal-action">
      <button className="btn" onClick={close}>Cancel</button>
      <button className="btn btn-primary" onClick={submit}>Post</button>
    </div>
  </div>
  <form method="dialog" className="modal-backdrop"><button>close</button></form>
</dialog>
```

---

## Responsive Design

The app is mobile-first — students will primarily use it on phones. Teachers and admins may use tablets or desktop.

### Avatars

DiceBear generates deterministic SVG avatars from a seed string (user ID or name). These appear in roster and detail views. No user-uploaded avatars.

---

## Debug Tools

### React Query DevTools

```jsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### Zustand DevTools

```jsx
import { devtools } from 'zustand/middleware'

export const useUIStore = create(
  devtools(
    (set) => ({
      // store definition
    }),
    { name: 'UI Store' }
  )
)
```

Both dev tools are only included in development builds and are tree-shaken from production.
