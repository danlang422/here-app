# Here App - System Architecture Documentation
**Date**: February 2026  
**Status**: Design complete, ready for implementation  
**Tech Stack Version**: v1.0

## Overview

This document defines the technical architecture for the Here attendance tracking application. It covers technology choices, project structure, data flow patterns, and implementation guidelines.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Project Structure](#project-structure)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Authentication & Authorization](#authentication--authorization)
5. [Real-Time Subscriptions](#real-time-subscriptions)
6. [State Management Strategy](#state-management-strategy)
7. [Form Handling](#form-handling)
8. [API Layer](#api-layer)
9. [Component Architecture](#component-architecture)
10. [Styling & Theming](#styling--theming)
11. [Build & Deployment](#build--deployment)
12. [Development Workflow](#development-workflow)

---

## Technology Stack

### Core Framework
- **Vite** - Build tool and dev server
  - Fast HMR (Hot Module Replacement)
  - Optimized production builds
  - Native ESM support
  - Simple configuration

- **React 19** - UI library
  - Functional components with Hooks
  - `use()` hook for promises and context
  - ref as prop (no more forwardRef)
  - Improved Suspense for data fetching

### Routing
- **React Router v6** - Client-side routing
  - Declarative routing configuration
  - Nested routes support
  - URL parameter handling
  - Programmatic navigation

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Built-in authentication
  - Row Level Security (RLS)
  - Real-time subscriptions
  - Storage for future file uploads
  - Edge Functions for complex logic

### Data Management
- **TanStack Query (React Query) v5** - Server state management
  - Automatic caching
  - Background refetching
  - Optimistic updates
  - Pagination support
  - Infinite queries
  - Mutations with rollback

### State Management
- **Zustand** - Client state management
  - Lightweight (< 1kb)
  - Simple API
  - No boilerplate
  - DevTools support
  - Perfect for UI state (modals, sidebars, preferences)

### Forms
- **React Hook Form** - Form state and validation
  - Minimal re-renders
  - Built-in validation
  - Easy integration with UI libraries
  - TypeScript support
  - Handles complex forms elegantly

### UI & Styling
- **Tailwind CSS** - Utility-first CSS framework
  - Rapid development
  - Consistent design system
  - Tree-shakeable (small bundle)
  - Custom configuration

- **DaisyUI** - Component library for Tailwind
  - Pre-built components (buttons, cards, modals, etc.)
  - Customizable themes
  - Accessibility built-in
  - Clean, semantic class names

- **React Icons** - Icon library
  - Includes Lucide, Hero Icons, Font Awesome, and more
  - Tree-shakeable imports
  - Consistent sizing with Tailwind

- **DiceBear** - Avatar generation
  - SVG avatars from seeds
  - Multiple style options
  - Deterministic generation
  - Free and lightweight

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Vite DevTools** - Development utilities

---

## Project Structure

```
here-app/
├── docs/                           # Project documentation
│   ├── DATABASE_SCHEMA.md
│   ├── USER_FLOWS.md
│   ├── BUSINESS_LOGIC.md
│   ├── SYSTEM_ARCHITECTURE.md
│   └── API_REFERENCE.md           # (future)
│
├── public/                         # Static assets
│   ├── favicon.ico
│   └── manifest.json              # PWA manifest (future)
│
├── src/
│   ├── api/                       # Supabase API functions
│   │   ├── supabase.js           # Supabase client setup
│   │   ├── auth.js               # Authentication functions
│   │   ├── students.js           # Student-related queries
│   │   ├── sessions.js           # Session queries
│   │   ├── attendance.js         # Attendance queries
│   │   └── checkins.js           # Check-in/status queries
│   │
│   ├── components/                # Reusable components
│   │   ├── ui/                   # Base UI components (from DaisyUI/custom)
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
│   │   │   └── StatusUpdateForm.jsx
│   │   │
│   │   ├── teacher/              # Teacher-specific components
│   │   │   ├── SessionCard.jsx
│   │   │   ├── StudentRoster.jsx
│   │   │   ├── AttendanceRow.jsx
│   │   │   └── CheckInMonitor.jsx
│   │   │
│   │   ├── admin/                # Admin-specific components
│   │   │   ├── CalendarEditor.jsx
│   │   │   ├── SessionForm.jsx
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
│   │   ├── useStudentSchedule.js # Get student schedule
│   │   ├── useCheckIn.js         # Check-in logic
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
│   │       ├── conflicts.js      # Schedule conflict resolution
│   │       ├── geofence.js       # Geofence validation
│   │       └── streak.js         # Streak calculation
│   │
│   ├── pages/                     # Page components (route targets)
│   │   ├── student/
│   │   │   ├── TodayView.jsx
│   │   │   ├── AttendanceHistory.jsx
│   │   │   └── Settings.jsx
│   │   │
│   │   ├── teacher/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── SessionDetail.jsx
│   │   │   └── AttendanceReports.jsx
│   │   │
│   │   ├── admin/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Calendar.jsx
│   │   │   ├── Sessions.jsx
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
│   │   ├── uiStore.js            # UI state (modals, sidebar, etc.)
│   │   ├── authStore.js          # Auth state (current user, role)
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

---

## Data Flow Architecture

### High-Level Flow

```
User Interaction
    ↓
React Component
    ↓
React Hook Form (if form) OR Direct Handler
    ↓
Custom Hook (useCheckIn, useStudentSchedule, etc.)
    ↓
React Query (useQuery or useMutation)
    ↓
API Function (src/api/*.js)
    ↓
Supabase Client
    ↓
PostgreSQL Database (with RLS)
    ↓
Real-time Subscription (if applicable)
    ↓
React Query Cache Update
    ↓
Component Re-render
```

### Example: Student Check-In Flow

```jsx
// 1. User clicks Check In button
<CheckInButton onClick={handleCheckIn} />

// 2. Component calls custom hook
function CheckInButton({ activityId }) {
  const { mutate: checkIn, isPending } = useCheckIn()
  
  const handleCheckIn = () => {
    checkIn({ activityId, location: getCurrentLocation() })
  }
  
  return (
    <button 
      onClick={handleCheckIn}
      disabled={isPending}
      className="btn btn-primary"
    >
      {isPending ? 'Checking in...' : 'Check In'}
    </button>
  )
}

// 3. Custom hook uses React Query mutation
function useCheckIn() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ activityId, location }) => 
      checkInStudent(activityId, location),
    
    onSuccess: () => {
      // Invalidate relevant queries to refetch
      queryClient.invalidateQueries(['student-schedule'])
      queryClient.invalidateQueries(['check-ins'])
    }
  })
}

// 4. API function interacts with Supabase
async function checkInStudent(activityId, location) {
  const { data, error } = await supabase
    .from('check_ins')
    .insert({
      student_activity_id: activityId,
      checked_in_at: new Date().toISOString(),
      check_in_location_lat: location.lat,
      check_in_location_lng: location.lng
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}

// 5. React Query updates cache and re-renders components
```

---

## Authentication & Authorization

### Supabase Auth Setup

**Authentication Flow:**

```jsx
// src/api/auth.js
import { supabase } from './supabase'

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentUserProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  if (error) throw error
  return data
}
```

**Protected Routes:**

```jsx
// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, isLoading } = useAuth()
  
  if (isLoading) return <LoadingSpinner />
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (requiredRole && !profile?.roles.includes(requiredRole)) {
    return <Navigate to="/unauthorized" replace />
  }
  
  return children
}

// Usage in router
<Route 
  path="/admin/*" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  } 
/>
```

**Role Switching (Multi-Role Users):**

```jsx
// src/store/authStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      currentRole: null,
      availableRoles: [],
      
      setCurrentRole: (role) => set({ currentRole: role }),
      setAvailableRoles: (roles) => set({ availableRoles: roles }),
    }),
    {
      name: 'auth-storage',
    }
  )
)

// Component for role switching
function RoleSwitcher() {
  const { currentRole, availableRoles, setCurrentRole } = useAuthStore()
  
  if (availableRoles.length <= 1) return null
  
  return (
    <select 
      value={currentRole} 
      onChange={(e) => setCurrentRole(e.target.value)}
      className="select select-bordered"
    >
      {availableRoles.map(role => (
        <option key={role} value={role}>
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </option>
      ))}
    </select>
  )
}
```

### Row Level Security (RLS)

All data access is controlled by Supabase RLS policies (defined in DATABASE_SCHEMA.md). The frontend doesn't need additional authorization checks beyond verifying user roles for UI purposes.

**Example RLS Policy (enforced at database level):**
```sql
-- Students can only read their own check-ins
CREATE POLICY "Students read own check-ins"
  ON check_ins FOR SELECT
  USING (student_id = auth.uid());
```

---

## Real-Time Subscriptions

### Use Cases for Real-Time

1. **Teacher monitoring student check-ins** (live updates as students check in)
2. **Student viewing teacher comments** (instant notifications)
3. **Attendance updates** (teacher marks attendance, student sees immediately)
4. **Schedule changes** (admin updates calendar, affected users see changes)

### Implementation Pattern

```jsx
// src/hooks/useRealtime.js
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../api/supabase'

export function useRealtimeCheckIns(sessionId, date) {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const channel = supabase
      .channel('check-ins-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'check_ins',
          filter: `date=eq.${date}`
        },
        (payload) => {
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries(['session-roster', sessionId])
          queryClient.invalidateQueries(['check-ins', date])
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, date, queryClient])
}

// Usage in component
function SessionRoster({ sessionId, date }) {
  const { data: roster } = useQuery({
    queryKey: ['session-roster', sessionId, date],
    queryFn: () => getSessionRoster(sessionId, date)
  })
  
  // Enable real-time updates
  useRealtimeCheckIns(sessionId, date)
  
  return (
    <div>
      {roster?.map(student => (
        <StudentRow key={student.id} student={student} />
      ))}
    </div>
  )
}
```

### Subscription Strategy

**Enable real-time for:**
- Teacher roster views (check-ins, attendance)
- Student notification center
- Admin dashboard stats

**Don't use real-time for:**
- Historical data (attendance reports)
- Calendar views (not changing frequently)
- User profiles

**Performance Considerations:**
- Limit subscriptions to active views only
- Unsubscribe when component unmounts
- Use channel multiplexing when possible
- Throttle rapid updates (debounce invalidations)

---

## State Management Strategy

### Three Types of State

#### 1. Server State (React Query)
**What:** Data from Supabase (students, sessions, check-ins, etc.)

**When:** Always use React Query for server data

**Example:**
```jsx
// Get student schedule
const { data: schedule, isLoading } = useQuery({
  queryKey: ['student-schedule', studentId, date],
  queryFn: () => getStudentSchedule(studentId, date),
  staleTime: 5 * 60 * 1000, // 5 minutes
})

// Create check-in
const { mutate: checkIn } = useMutation({
  mutationFn: createCheckIn,
  onSuccess: () => {
    queryClient.invalidateQueries(['student-schedule'])
  }
})
```

#### 2. Client State (Zustand)
**What:** UI state, preferences, temporary data

**When:** Modal visibility, sidebar state, theme, role selection

**Example:**
```jsx
// src/store/uiStore.js
import { create } from 'zustand'

export const useUIStore = create((set) => ({
  // Modal state
  statusModalOpen: false,
  openStatusModal: () => set({ statusModalOpen: true }),
  closeStatusModal: () => set({ statusModalOpen: false }),
  
  // Sidebar state
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  // Current date for calendar
  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),
}))

// Usage
function StatusUpdateButton() {
  const { openStatusModal } = useUIStore()
  
  return (
    <button onClick={openStatusModal} className="btn">
      💬 Status
    </button>
  )
}
```

#### 3. Form State (React Hook Form)
**What:** Input values, validation, errors

**When:** Any form (check-in, status update, attendance, admin forms)

**Example:**
```jsx
import { useForm } from 'react-hook-form'

function StatusUpdateForm() {
  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm({
    defaultValues: {
      type: 'plans',
      content: ''
    }
  })
  
  const onSubmit = (data) => {
    // Submit to Supabase via React Query mutation
    createStatusUpdate(data)
  }
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <select {...register('type')} className="select">
        <option value="plans">📝 Plans</option>
        <option value="progress">📊 Progress</option>
        <option value="reflection">💭 Reflection</option>
      </select>
      
      <textarea 
        {...register('content', { 
          required: 'Content is required',
          maxLength: { value: 500, message: 'Max 500 characters' }
        })}
        className="textarea"
        placeholder="What are you working on?"
      />
      {errors.content && (
        <span className="text-error text-sm">{errors.content.message}</span>
      )}
      
      <button type="submit" className="btn btn-primary">
        Post Update
      </button>
    </form>
  )
}
```

### State Management Decision Tree

```
Is this data from Supabase?
  YES → Use React Query
  NO ↓

Is this form-related (inputs, validation)?
  YES → Use React Hook Form
  NO ↓

Is this UI state (modals, preferences, temporary data)?
  YES → Use Zustand
  NO ↓

Is this local component state (toggle, counter)?
  YES → Use useState
```

---

## Form Handling

### React Hook Form Patterns

#### Basic Form
```jsx
import { useForm } from 'react-hook-form'

function SimpleForm() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  
  const onSubmit = (data) => console.log(data)
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email', { required: true })} />
      {errors.email && <span>This field is required</span>}
      
      <button type="submit">Submit</button>
    </form>
  )
}
```

#### Form with Validation
```jsx
function ValidatedForm() {
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting } 
  } = useForm()
  
  const onSubmit = async (data) => {
    await submitToSupabase(data)
  }
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input 
        {...register('content', {
          required: 'Content is required',
          minLength: { value: 1, message: 'Too short' },
          maxLength: { value: 500, message: 'Too long (max 500)' },
          validate: (value) => {
            if (value.trim().length === 0) {
              return 'Cannot be only whitespace'
            }
          }
        })}
        className="input input-bordered"
      />
      {errors.content && (
        <span className="text-error text-sm">
          {errors.content.message}
        </span>
      )}
      
      <button 
        type="submit" 
        disabled={isSubmitting}
        className="btn btn-primary"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
```

#### Form with React Query Mutation
```jsx
function FormWithMutation() {
  const { register, handleSubmit, reset } = useForm()
  
  const createStatus = useMutation({
    mutationFn: (data) => supabase
      .from('status_updates')
      .insert(data),
    onSuccess: () => {
      reset() // Clear form
      // Show success message
    },
    onError: (error) => {
      // Show error message
    }
  })
  
  const onSubmit = (data) => {
    createStatus.mutate(data)
  }
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <textarea {...register('content')} />
      
      <button 
        type="submit"
        disabled={createStatus.isPending}
      >
        {createStatus.isPending ? 'Saving...' : 'Save'}
      </button>
      
      {createStatus.isError && (
        <div className="alert alert-error">
          {createStatus.error.message}
        </div>
      )}
    </form>
  )
}
```

---

## API Layer

### Supabase Client Setup

```jsx
// src/api/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### API Function Organization

**Pattern:** One file per domain/table

```jsx
// src/api/students.js
import { supabase } from './supabase'

export async function getStudentSchedule(studentId, date) {
  const { data, error } = await supabase
    .from('student_activities')
    .select(`
      *,
      activity_type:activity_types(*),
      session:sessions(*)
    `)
    .eq('student_id', studentId)
    // Additional filters for date/day logic
  
  if (error) throw error
  return data
}

export async function getStudentProfile(studentId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', studentId)
    .single()
  
  if (error) throw error
  return data
}
```

```jsx
// src/api/checkins.js
import { supabase } from './supabase'

export async function createCheckIn({ activityId, location }) {
  const { data, error } = await supabase
    .from('check_ins')
    .insert({
      student_activity_id: activityId,
      checked_in_at: new Date().toISOString(),
      check_in_location_lat: location?.lat,
      check_in_location_lng: location?.lng,
      date: new Date().toISOString().split('T')[0]
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function checkOut(checkInId) {
  const { data, error } = await supabase
    .from('check_ins')
    .update({
      checked_out_at: new Date().toISOString()
    })
    .eq('id', checkInId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function getCheckInsForDate(studentId, date) {
  const { data, error } = await supabase
    .from('check_ins')
    .select('*, student_activity:student_activities(*)')
    .eq('student_id', studentId)
    .eq('date', date)
  
  if (error) throw error
  return data
}
```

### Custom Hooks for API Calls

```jsx
// src/hooks/useStudentSchedule.js
import { useQuery } from '@tanstack/react-query'
import { getStudentSchedule } from '../api/students'

export function useStudentSchedule(studentId, date) {
  return useQuery({
    queryKey: ['student-schedule', studentId, date],
    queryFn: () => getStudentSchedule(studentId, date),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!studentId && !!date,
  })
}
```

```jsx
// src/hooks/useCheckIn.js
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCheckIn, checkOut } from '../api/checkins'

export function useCheckIn() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createCheckIn,
    onSuccess: () => {
      queryClient.invalidateQueries(['student-schedule'])
      queryClient.invalidateQueries(['check-ins'])
    }
  })
}

export function useCheckOut() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: checkOut,
    onSuccess: () => {
      queryClient.invalidateQueries(['check-ins'])
    }
  })
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
│       │   │       └── StatusUpdateButton
│       │   └── AttendanceHistory
│       ├── TeacherRoutes
│       │   ├── Dashboard
│       │   │   └── SessionCard[]
│       │   └── SessionDetail
│       │       ├── StudentRoster
│       │       │   └── StudentRow[]
│       │       └── AttendanceMarking
│       └── AdminRoutes
│           ├── Calendar
│           ├── Sessions
│           └── Users
└── GlobalComponents
    ├── Header
    ├── BottomNav (mobile)
    └── NotificationCenter
```

### Component Patterns

#### Container/Presenter Pattern

```jsx
// Container - handles data/logic
function TodayViewContainer() {
  const { user } = useAuth()
  const { data: schedule, isLoading } = useStudentSchedule(user.id, new Date())
  
  if (isLoading) return <LoadingSpinner />
  
  return <TodayViewPresenter schedule={schedule} />
}

// Presenter - handles UI only
function TodayViewPresenter({ schedule }) {
  return (
    <div className="space-y-4">
      {schedule.map(block => (
        <BlockCard key={block.id} block={block} />
      ))}
    </div>
  )
}
```

#### Compound Components

```jsx
// BlockCard with sub-components
function BlockCard({ block }) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <BlockCard.Header block={block} />
        <BlockCard.Content block={block} />
        <BlockCard.Actions block={block} />
      </div>
    </div>
  )
}

BlockCard.Header = ({ block }) => (
  <div className="flex justify-between">
    <h2 className="card-title">{block.name}</h2>
    <Badge status={block.status} />
  </div>
)

BlockCard.Content = ({ block }) => (
  <div className="text-sm">
    <p>{block.teacher}</p>
    <p>{block.location}</p>
  </div>
)

BlockCard.Actions = ({ block }) => (
  <div className="card-actions justify-end">
    {block.requiresCheckin && <CheckInButton activityId={block.id} />}
    {block.allowsPresence && <PresenceWaveButton activityId={block.id} />}
  </div>
)
```

---

## Styling & Theming

### Tailwind Configuration

```js
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Custom extensions if needed
    },
  },
  plugins: [
    require('daisyui'),
  ],
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

/* Custom global styles */
@layer base {
  html {
    @apply h-full;
  }
  
  body {
    @apply h-full bg-base-200 text-base-content;
  }
}

@layer components {
  /* Custom component classes if needed */
  .btn-check-in {
    @apply btn btn-primary btn-lg;
  }
}
```

### DaisyUI Component Usage

```jsx
// Buttons
<button className="btn btn-primary">Primary</button>
<button className="btn btn-secondary">Secondary</button>
<button className="btn btn-ghost">Ghost</button>

// Cards
<div className="card bg-base-100 shadow-xl">
  <div className="card-body">
    <h2 className="card-title">Title</h2>
    <p>Content</p>
    <div className="card-actions justify-end">
      <button className="btn btn-primary">Action</button>
    </div>
  </div>
</div>

// Badges
<div className="badge badge-primary">Primary</div>
<div className="badge badge-success">Success</div>

// Modals
<dialog className="modal modal-open">
  <div className="modal-box">
    <h3 className="font-bold text-lg">Title</h3>
    <p className="py-4">Content</p>
    <div className="modal-action">
      <button className="btn">Close</button>
    </div>
  </div>
</dialog>
```

---

## Build & Deployment

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
    port: 5173, // Vite default
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
```

### Build Commands

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0"
  }
}
```

### Deployment (Vercel)

**Setup:**
1. Connect GitHub repo to Vercel
2. Configure environment variables in Vercel dashboard
3. Auto-deploy on push to `main` branch

**Build Settings:**
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

**Environment Variables (in Vercel):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Performance Optimizations

**Code Splitting:**
```jsx
// Lazy load route components
import { lazy, Suspense } from 'react'

const TodayView = lazy(() => import('./pages/student/TodayView'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))

// In router
<Route 
  path="/today" 
  element={
    <Suspense fallback={<LoadingSpinner />}>
      <TodayView />
    </Suspense>
  } 
/>
```

**React Query Configuration:**
```jsx
// src/main.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

---

## Development Workflow

### Initial Setup

```bash
# 1. Clone and install
git clone <repository-url>
cd here-app
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with Supabase credentials

# 3. Start dev server
npm run dev
```

### Development Practices

**Git Workflow:**
- `main` branch for production
- Feature branches: `feature/check-in-flow`, `feature/admin-calendar`
- Commit messages: Conventional Commits format

**Code Review:**
- All changes via pull requests
- Review checklist:
  - Code follows project structure
  - Components are properly organized
  - No console.logs in production code
  - Error handling implemented
  - Loading states handled

**Testing Strategy (Future):**
- Unit tests: Vitest
- Component tests: React Testing Library
- E2E tests: Playwright

### Debug Tools

**React Query DevTools:**
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

**Zustand DevTools:**
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

---

## Future Enhancements

### Phase 2 Features
- Progressive Web App (PWA) support
  - Service worker for offline capability
  - Add to home screen
  - Push notifications
- File uploads (Supabase Storage)
- Advanced analytics dashboard
- Export functionality (CSV, PDF)

### Phase 3 Features
- Native mobile apps (React Native)
- Parent portal
- Integration with district SIS
- Multi-school coordination

---

## Quick Reference

### Key File Locations
- **Supabase client:** `src/api/supabase.js`
- **Auth logic:** `src/hooks/useAuth.js`
- **Routes:** `src/router.jsx`
- **UI state:** `src/store/uiStore.js`
- **Theme config:** `tailwind.config.js`

### Common Commands
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Environment Setup
```bash
# Required environment variables
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

---

**End of System Architecture Documentation**

*This document should be updated as the architecture evolves during implementation.*
