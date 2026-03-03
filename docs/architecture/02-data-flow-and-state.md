# Data Flow & State Management

> **Implementation status (March 2026):** React Query (TanStack Query v5) and React Hook Form are both installed but **not yet integrated**. Current pages (ActivityManagement, UserManagement, auth) use manual `useState` + `useEffect` fetch patterns. The patterns described below are the planned architecture — a dedicated refactor session to adopt them across existing pages is upcoming. Zustand is in use for auth and UI state.

## High-Level Data Flow

```
User Interaction
    ↓
React Component
    ↓
React Hook Form (if form) OR Direct Handler
    ↓
Custom Hook (useCheckIn, useStudentSchedule, useTeacherRoster, etc.)
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

Every read goes through React Query for caching and background refresh. Every write goes through a React Query mutation, which invalidates relevant query keys on success to trigger refetches. Supabase Realtime subscriptions supplement this by pushing changes from other users into the cache.

---

## Activity Instance Upsert Pattern

A critical data flow pattern in V2 is **lazy instance creation**. Many records — attendance, check-ins, presence waves, posts, status updates — reference an `activity_instance_id` rather than carrying `activity_id + date` directly. The instance record represents "this activity on this specific date" and is created on demand.

The `useActivityInstance` hook handles this transparently:

```jsx
// src/hooks/useActivityInstance.js
export function useActivityInstance(activityId, date) {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('activity_instances')
        .upsert(
          { activity_id: activityId, organization_id: orgId, date },
          { onConflict: 'activity_id,date' }
        )
        .select()
        .single()

      if (error) throw error
      return data
    }
  })
}
```

Any component that needs to write data against a specific activity + date calls this first, uses the returned `id` as the `activity_instance_id`, then proceeds with the actual insert. In practice this is wrapped into higher-level hooks so individual components don't manage the two-step flow themselves.

---

## Example: Student Check-In Flow

```jsx
// 1. Component calls custom hook
function CheckInButton({ activity, date }) {
  const { mutate: checkIn, isPending } = useCheckIn()

  const handleCheckIn = async () => {
    const location = await getCurrentLocation()
    checkIn({
      activityId: activity.id,
      date,
      location,
      requiresGeofence: activity.requires_geofence,
      geofenceCenter: { lat: activity.location_lat, lng: activity.location_lng },
      geofenceRadius: activity.geofence_radius
    })
  }

  return (
    <button onClick={handleCheckIn} disabled={isPending} className="btn btn-primary">
      {isPending ? 'Checking in...' : 'Check In'}
    </button>
  )
}

// 2. Custom hook ensures instance exists, then creates check-in
function useCheckIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ activityId, date, location, requiresGeofence, geofenceCenter, geofenceRadius }) => {
      // Step 1: Ensure activity instance exists
      const instance = await upsertActivityInstance(activityId, date)

      // Step 2: Validate geofence if required
      const geofenceValidated = requiresGeofence
        ? validateGeofence(location, geofenceCenter, geofenceRadius)
        : null

      // Step 3: Create check-in record
      const { data, error } = await supabase
        .from('check_ins')
        .insert({
          student_id: currentUserId,
          activity_instance_id: instance.id,
          checked_in_at: new Date().toISOString(),
          check_in_location_lat: location?.lat,
          check_in_location_lng: location?.lng,
          geofence_validated: geofenceValidated
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['check-ins'] })
    }
  })
}
```

---

## State Management Strategy

### Three Types of State

**Server State (React Query)** — Data from Supabase. Activities, enrollments, attendance records, check-ins, posts, notifications. Always use React Query for any data that lives in the database.

**Client State (Zustand)** — UI-only state that doesn't persist to the server. Modal visibility, sidebar open/closed, currently selected date, active role for multi-role users, user preferences like theme.

**Form State (React Hook Form)** — Input values, validation errors, submission state. Used for any form: status updates, attendance marking, activity creation, enrollment management.

### Decision Tree

```
Is this data from Supabase?
  YES → React Query
  NO ↓

Is this form input / validation?
  YES → React Hook Form
  NO ↓

Is this UI state (modals, preferences, navigation)?
  YES → Zustand
  NO ↓

Is this local to one component (toggle, counter)?
  YES → useState
```

---

## React Query Patterns

### Global Configuration

```jsx
// src/main.jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes
      gcTime: 10 * 60 * 1000,       // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

### Query Key Conventions

Query keys follow a hierarchical pattern so invalidation can target broad or narrow scopes:

```jsx
// Broad: invalidate everything for a student's schedule
['student-schedule', studentId]

// Narrow: invalidate one specific date
['student-schedule', studentId, date]

// Teacher roster for a block on a date
['teacher-roster', teacherId, block, date]

// Check-ins for a student on a date
['check-ins', studentId, date]

// Posts for an activity instance
['posts', activityInstanceId]

// Notifications for a user
['notifications', userId]
```

### Query Examples

```jsx
// Student schedule for a date
export function useStudentSchedule(studentId, date) {
  return useQuery({
    queryKey: ['student-schedule', studentId, date],
    queryFn: () => getStudentSchedule(studentId, date),
    staleTime: 5 * 60 * 1000,
    enabled: !!studentId && !!date,
  })
}

// Teacher roster for a block
export function useTeacherRoster(teacherId, block, date) {
  return useQuery({
    queryKey: ['teacher-roster', teacherId, block, date],
    queryFn: () => getTeacherRoster(teacherId, block, date),
    enabled: !!teacherId && block != null && !!date,
  })
}
```

### Mutation Pattern

All mutations follow the same shape: call the API function, invalidate relevant query keys on success.

```jsx
export function useMarkAttendance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ activityInstanceId, studentId, status }) => {
      const { data, error } = await supabase
        .from('attendance_records')
        .upsert(
          {
            activity_instance_id: activityInstanceId,
            student_id: studentId,
            status,
            marked_by_id: currentUserId,
            marked_at: new Date().toISOString()
          },
          { onConflict: 'activity_instance_id,student_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, { activityInstanceId }) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-roster'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', activityInstanceId] })
    }
  })
}
```

---

## Zustand Stores

### UI Store

```jsx
// src/store/uiStore.js
import { create } from 'zustand'

export const useUIStore = create((set) => ({
  statusModalOpen: false,
  openStatusModal: () => set({ statusModalOpen: true }),
  closeStatusModal: () => set({ statusModalOpen: false }),

  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),
}))
```

### Auth Store

```jsx
// src/store/authStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      currentRole: null,       // 'student' | 'teacher' | 'admin'
      availableRoles: [],      // from user_profiles.roles
      setCurrentRole: (role) => set({ currentRole: role }),
      setAvailableRoles: (roles) => set({ availableRoles: roles }),
    }),
    { name: 'auth-storage' }
  )
)
```

The `currentRole` is persisted to localStorage so multi-role users don't have to re-select on every page load. The available roles come from `user_profiles.roles` (a `TEXT[]` column) and are set on login.

---

## React Hook Form Patterns

### Form with Mutation

```jsx
function StatusUpdateForm({ activityInstanceId }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { status_type: 'plans', content: '' }
  })

  const createStatus = useMutation({
    mutationFn: (data) => supabase
      .from('status_updates')
      .insert({ ...data, student_id: currentUserId, activity_instance_id: activityInstanceId })
      .select(),
    onSuccess: () => reset()
  })

  return (
    <form onSubmit={handleSubmit((data) => createStatus.mutate(data))}>
      <select {...register('status_type')} className="select select-bordered">
        <option value="plans">📝 Plans</option>
        <option value="progress">📊 Progress</option>
        <option value="reflection">💭 Reflection</option>
      </select>

      <textarea
        {...register('content', {
          required: 'Content is required',
          maxLength: { value: 500, message: 'Max 500 characters' }
        })}
        className="textarea textarea-bordered"
        placeholder="What are you working on?"
      />
      {errors.content && <span className="text-error text-sm">{errors.content.message}</span>}

      <button type="submit" disabled={isSubmitting} className="btn btn-primary">
        {isSubmitting ? 'Posting...' : 'Post Update'}
      </button>
    </form>
  )
}
```

### Admin Activity Form

The unified activity form is the most complex form in the app. It uses the `type` field to conditionally show/hide field groups — for instance, `internship_opportunity_id` and geofence fields only appear when `type === 'internship'`, while `rotation_day_type` only appears when the organization uses rotation schedules. React Hook Form's `watch()` drives this conditional rendering without additional state management.

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

### API File Organization

One file per domain. Each file exports functions that return data (for queries) or perform writes (for mutations). All functions throw on error so React Query's error handling works.

```
src/api/
├── supabase.js        # Client setup
├── auth.js            # signIn, signOut, getCurrentUser, getCurrentUserProfile
├── activities.js      # getStudentSchedule, getTeacherRoster, getActivity, createActivity, updateActivity
├── attendance.js      # getAttendance, markAttendance, bulkMarkAttendance
├── checkins.js        # createCheckIn, checkOut, getCheckInsForDate
├── enrollments.js     # getEnrollments, enrollStudent, unenrollStudent
├── instances.js       # upsertActivityInstance, getInstancesForDate
├── posts.js           # createPost, getPostsForInstance, createComment, createPostResponse
├── notifications.js   # getNotifications, markNotificationRead
└── calendar.js        # getSchoolDay, getTerms, getScheduleTemplates
```

### Error Handling Pattern

```jsx
export async function getStudentSchedule(studentId, date) {
  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      enrollments!inner(student_id),
      activity_instances(id, cancelled)
    `)
    .eq('enrollments.student_id', studentId)
    .eq('enrollments.is_active', true)
    .eq('is_active', true)

  if (error) throw error
  return data
}
```

The `!inner` join modifier on enrollments ensures only activities where the student has an active enrollment are returned. Additional filtering for "does this activity meet today?" (checking `days_of_week`, `rotation_day_type`, and the school day calendar) happens either in the query or in a post-processing step — see business logic docs for the full resolution algorithm.
