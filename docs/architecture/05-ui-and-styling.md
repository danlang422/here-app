# UI & Styling

## Tailwind + DaisyUI Configuration

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

### Global Styles

```css
/* src/styles/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { @apply h-full; }
  body { @apply h-full bg-base-200 text-base-content; }
}
```

---

## Component Architecture

### Component Hierarchy

```
App
├── Router
│   ├── PublicRoutes (login, password reset)
│   └── ProtectedRoutes
│       ├── StudentRoutes
│       │   ├── TodayView
│       │   │   ├── DateSelector
│       │   │   └── BlockCard[]
│       │   │       ├── CheckInButton
│       │   │       ├── PresenceWaveButton
│       │   │       ├── FreeformTagPicker (if allows_freeform)
│       │   │       └── StatusUpdateButton
│       │   └── AttendanceHistory
│       │
│       ├── TeacherRoutes
│       │   ├── Dashboard
│       │   │   └── BlockCard[] (one per block with activities)
│       │   └── BlockDetail
│       │       ├── StudentRoster
│       │       │   └── StudentRow[] (attendance + check-in status)
│       │       └── PostComposer
│       │
│       └── AdminRoutes
│           ├── Calendar (school days + schedule templates)
│           ├── Activities (CRUD + enrollment management)
│           └── Users (user profiles + role assignment)
│
└── GlobalComponents
    ├── Header (with RoleSwitcher for multi-role users)
    ├── BottomNav (mobile)
    └── NotificationCenter
```

### Component Patterns

**Container/Presenter** — Containers handle data loading via hooks; presenters receive props and render UI. This keeps data logic out of presentational components and makes both easier to test.

```jsx
// Container
function TodayViewContainer() {
  const { user } = useAuth()
  const date = useUIStore(s => s.selectedDate)
  const { data: schedule, isLoading } = useStudentSchedule(user.id, date)

  if (isLoading) return <LoadingSpinner />
  return <TodayViewPresenter schedule={schedule} />
}

// Presenter
function TodayViewPresenter({ schedule }) {
  return (
    <div className="space-y-4">
      {schedule.map(activity => (
        <BlockCard key={activity.id} activity={activity} />
      ))}
    </div>
  )
}
```

**Compound Components** — Complex components like `BlockCard` expose sub-components for flexible composition:

```jsx
function BlockCard({ activity }) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <BlockCard.Header activity={activity} />
        <BlockCard.Content activity={activity} />
        <BlockCard.Actions activity={activity} />
      </div>
    </div>
  )
}

BlockCard.Header = ({ activity }) => (
  <div className="flex justify-between">
    <h2 className="card-title">{activity.name}</h2>
    <Badge type={activity.type} />
  </div>
)

BlockCard.Content = ({ activity }) => (
  <div className="text-sm">
    {activity.teacher_id && <p>{activity.teacherName}</p>}
    {activity.instructor_name && <p>{activity.instructor_name} (external)</p>}
    {activity.location && <p>{activity.location}</p>}
  </div>
)

BlockCard.Actions = ({ activity }) => (
  <div className="card-actions justify-end">
    {activity.requires_checkin && <CheckInButton activity={activity} />}
    {activity.allows_presence_wave && <PresenceWaveButton activity={activity} />}
    {activity.allows_freeform && <FreeformTagPicker activity={activity} />}
  </div>
)
```

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

// Badges for activity types and attendance status
<div className="badge badge-primary">regular_class</div>
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

The app is mobile-first — students will primarily use it on phones. Teachers may use tablets or desktop.

### Layout Strategy

- **Mobile (< 768px)**: Single column, bottom navigation bar, cards stack vertically. The student TodayView is the primary mobile experience.
- **Tablet (768px–1024px)**: Side-by-side panels where useful (e.g., teacher roster on left, detail on right).
- **Desktop (> 1024px)**: Full sidebar navigation, multi-column layouts for admin views.

### Navigation

- **Mobile**: `BottomNav` component with role-specific tabs (Today / History / Settings for students; Dashboard / Reports for teachers).
- **Desktop**: `Sidebar` component with full navigation tree. Role switcher in the header.

### Avatars

DiceBear generates deterministic SVG avatars from a seed string (user ID or name). These appear in roster views, comments, and notification items. No user-uploaded avatars for MVP.

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
