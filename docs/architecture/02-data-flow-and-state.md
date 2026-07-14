# Data Flow & State Management

**Last updated:** July 2026 (docs-freshness pass — `useTeacherAgenda` corrected for the #70 `activity_staff` junction-table migration, which had already landed; added hooks/API files introduced since session 34: `useSidebarActivities`, `useAttendanceSubscription`, `useHistory`, `history.js`, `profiles.js`)

## High-Level Data Flow

```
User Interaction
    ↓
React Component
    ↓
React Hook Form (if collecting/validating form inputs)
  OR Direct Handler (if single action — e.g. attendance button)
    ↓
Custom Hook (src/hooks/)
    ↓
TanStack Query — useQuery (reads) or useMutation (writes)
    ↓
API Function (src/api/*.js)
    ↓
Supabase Client → PostgreSQL (with RLS)
    ↓
TanStack Query Cache Update → Component Re-render
```

Every database read goes through TanStack Query for caching and background refresh. Every write goes through a mutation, which on success invalidates the relevant query keys so dependent components re-fetch automatically.

React Hook Form vs. direct handler: use React Hook Form when a user is filling out multiple fields before submitting (creating an activity, editing a user, posting a status update). Use a direct onClick handler when the user is triggering a single action with no inputs to collect or validate (PAET attendance buttons, check-out, wave).

---

## Activity Instance Upsert Pattern

All student actions (check-ins, presence waves, status updates) and attendance records reference an `activity_instance_id` — a row representing "this specific activity on this specific date" — rather than storing `activity_id + date` directly. Instance rows are created lazily on first access via an `ensure_activity_instance` RPC function, so they don't need to be pre-generated for every activity on every day.

The `upsertActivityInstance` API function handles this:

```js
// src/api/instances.js
export async function upsertActivityInstance(activityId, organizationId, date) {
  const { data, error } = await supabase
    .rpc('ensure_activity_instance', {
      p_activity_id: activityId,
      p_organization_id: organizationId,
      p_date: date,
    })
  if (error) throw error
  return data?.[0] ?? data
}
```

Hooks that need to write student actions call `getInstancesForActivities` first (which resolves or creates instances for a set of activity IDs on a date), then use the returned instance IDs for their actual inserts. Components never manage the two-step flow directly — it's handled inside the hooks.

---

## Hooks Reference

All custom hooks live in `src/hooks/`. Each wraps one or more API functions with TanStack Query.

### Student hooks

**`useStudentAgenda(studentId, date, orgId)`**
Fetches all active enrollments for a student (via `getStudentActivitiesForDate` in `src/api/agenda.js`), then filters client-side using `enrollmentMeetsToday()` to show only activities that meet on the given date. Also fetches the school day record for that date. Returns `activities` (filtered), `allActivities` (unfiltered), `schoolDay`, `isLoading`, `error`.

**`useStudentActions(studentId, activities, date, orgId)`**
For a student's set of activities on a date: resolves instance IDs, then fetches the student's check-ins, waves, and status update counts for those instances in parallel. Returns Maps keyed by activityId. Drives the action button state on the student TodayView.

**`useStreakData(studentId, activities, orgId)`**
Fetches 90 days of wave history for wave-enabled activities and school day records for the same window, then calls `calculateStreak()` for each activity. Returns a Map of activityId → streak count. `staleTime` is 5 minutes.

**`useStudentInstanceDetail(studentId, instanceId, activity, orgId)`**
Fetches full detail for a single student on a single instance: check-in record, wave record, all status updates, and any freeform check-in tags. Also calculates streak for the activity if a wave exists. Used by the teacher roster's student detail overlay.

### Teacher hooks

**`useTeacherAgenda(teacherId, date, orgId)`**
Fetches all active activities the teacher is staffed on via the `activity_staff` junction table (`getTeacherActivitiesForDate` — queries `activity_staff` for the teacher's `activity_id`s, then fetches those activities with a full `activity_staff` embed), along with active enrollment rows for those activities. Filters activities client-side with `activityMeetsToday()`. Computes enrollment counts per activity filtered by `enrollmentMeetsToday()`. Returns `activities` (filtered), `enrollmentCounts` (Map), `schoolDay`.

**`useSidebarActivities(teacherId, orgId)`**
Fetches activities flagged `visible_to_all_staff = true` in the org (via `getVisibleToAllActivitiesForDate`), regardless of `activity_staff` assignment, and splits them into "yours" / "others" sections using `getViewerRole()` against the embedded `activity_staff` rows. Drives the teacher agenda sidebar's visible-to-all sections (#86.5).

**`useTeacherActionSummary(activityIds, date, orgId)`**
For a set of activity IDs on a date: resolves instance IDs, then fetches waves, check-ins, status updates, and attendance records for those instances in parallel. Returns aggregated Maps for rendering action icons on agenda cards and tracking whether attendance has been started. Used alongside `useTeacherAgenda` on the teacher dashboard.

**`useRoster(activityIds, date, orgId, activities, schoolDay)`**
Fetches enrollment rows with student profiles for a set of activity IDs, resolves instance IDs, and fetches existing attendance records. Computes a `scheduledToday` flag per student using `enrollmentMeetsToday()`. Returns `todayStudents` (scheduled today), `allStudents`, `attendanceByStudent` (Map), `instances` (Map).

### Admin hooks

**`useActivities(orgId)`** / **`useCreateActivity`** / **`useUpdateActivity`** / **`useDeleteActivity`**
Standard CRUD hooks for the activities table. Query key: `['activities', orgId]`.

**`useAttendanceRollup(orgId, date)`**
Four coordinated queries: all active enrollments (stale 5 min), school day for the date, all instances for the date, and attendance records for those instances. Merges everything into block-grouped rows with status sort order. The one place in the app where blocks drive structure — because attendance rollup is a reporting view, not a scheduling view.

**`useOrgEnrollments(orgId)`** / **`useActivityEnrollments(activityId)`**
Two variants: org-wide (all enrollments) and per-activity. Used by the admin enrollment panel. Mutations: `useBulkEnrollStudents`, `useBulkUnenrollStudents`, `useUpdateEnrollment`.

### Shared / infrastructure hooks

**`useOrgSettings(orgId)`** — Fetches org settings (block count, schedule config). Query key: `['org-settings', orgId]`.

**`useSchoolDays(orgId, startDate, endDate)`** / **`useCalendars(orgId)`** — Calendar data. `getSchoolDays` is called in multiple hooks; TanStack Query's deduplication means it only fires once per unique key even when multiple hooks request it simultaneously.

**`useUsers(orgId)`** / **`useStaffUsers(orgId)`** / **`useStudents(orgId)`** — User profile queries. Query keys: `['users', orgId]`, `['staff-users', orgId]`, `['students', orgId]`.

**`useAuth()`** — Convenience hook that returns the Zustand auth store directly (`user`, `profile`, `session`, `loading`, `currentRole`, `availableRoles`). Not a TanStack Query hook — auth state lives in Zustand, initialized by `useAuthListener()` in `AuthProvider`.

**`useAttendanceSubscription(instanceIds, onUpdate)`** — Not a TanStack Query hook. Opens a Supabase Realtime `postgres_changes` channel filtered to `attendance_records` rows for the given instance IDs and invokes `onUpdate` on insert/update/delete. Wired into `useRoster` so teacher rosters reflect attendance changes made elsewhere (e.g. another staff member marking attendance) without a manual refetch. See `docs/architecture/04-realtime-and-notifications.md`.

**`useHistory(...)`** — Action history feed queries (`src/api/history.js`) backing the `/history` route's student and teacher views.

---

## Query Key Reference

All active query keys in the codebase as of session 34:

| Key | Hook | Scope |
|-----|------|-------|
| `['activities', orgId]` | `useActivities` | All active activities for org |
| `['student-agenda', studentId, dateStr]` | `useStudentAgenda` | Student's enrollments |
| `['teacher-agenda', teacherId, dateStr]` | `useTeacherAgenda` | Teacher's activities + enrollment rows |
| `['teacher-action-summary', sortedKey, dateStr]` | `useTeacherActionSummary` | Waves/check-ins/status/attendance for instances |
| `['roster', sortedKey, dateStr]` | `useRoster` | Enrollments + attendance for activity set |
| `['student-actions', studentId, dateStr]` | `useStudentActions` | Student's check-ins/waves/statuses |
| `['streaks', studentId]` | `useStreakData` | 90-day wave history |
| `['student-instance-detail', studentId, instanceId]` | `useStudentInstanceDetail` | Single student × instance detail |
| `['enrollments', orgId]` | `useOrgEnrollments` | All org enrollments |
| `['enrollments', 'activity', activityId]` | `useActivityEnrollments` | Per-activity enrollments |
| `['rollup-enrollments', orgId]` | `useAttendanceRollup` | All active enrollments (stale 5 min) |
| `['rollup-school-day', orgId, dateStr]` | `useAttendanceRollup` | School day for rollup date |
| `['rollup-attendance', orgId, dateStr]` | `useAttendanceRollup` | Attendance records for rollup date |
| `['activity-instances', orgId, dateStr]` | `useAttendanceRollup` | All instances for a date |
| `['school-days', orgId, dateStr, dateStr]` | Multiple hooks | School day records for date range |
| `['org-settings', orgId]` | `useOrgSettings` | Org config including block count |
| `['users', orgId]` | `useUsers` | All user profiles |
| `['staff-users', orgId]` | `useStaffUsers` | Staff-role users (for dropdowns) |
| `['students', orgId]` | `useStudents` | Student-role users |

---

## State Management Strategy

### Three types of state

**Server state (TanStack Query)** — Any data that lives in Supabase. Activities, enrollments, attendance records, check-ins, waves, status updates, school days, users. Always goes through a custom hook wrapping `useQuery` or `useMutation`.

**Client state (Zustand)** — UI state that doesn't persist to the server. Two stores:
- `authStore` — session, user profile, current role, available roles. The `currentRole` field is persisted to localStorage so multi-role users don't re-select on page reload. Everything else is ephemeral.
- `uiStore` — selected date, sidebar open/closed, active modal + modal data.

**Form state (React Hook Form)** — Input values, validation errors, and submission state for forms. Used in `ActivityForm`, `UserForm`, `BulkUserEntry`, `StatusUpdateModal`, login, and password flows. React Hook Form's `watch()` drives conditional field visibility (e.g. geofence fields only appear when `requires_geofence` is true).

### Decision tree

```
Is this data from Supabase?
  YES → TanStack Query (custom hook in src/hooks/)
  NO ↓

Is this form input or validation state?
  YES → React Hook Form
  NO ↓

Is this shared UI state (date, modals, sidebar, auth)?
  YES → Zustand (uiStore or authStore)
  NO ↓

Is this local to one component?
  YES → useState
```

---

## API Layer

One file per domain in `src/api/`. All functions throw on error so TanStack Query's error handling works. All functions return data directly (not `{ data, error }`).

```
src/api/
├── supabase.js          — Supabase client singleton
├── auth.js              — signIn, signOut, getCurrentUser, password reset/update
├── activities.js        — getActivities, getActivity, createActivity, updateActivity,
│                          deleteActivity, getTeacherActivities, bulkUpdateActivityFields
├── agenda.js            — getStudentActivitiesForDate, getTeacherActivitiesForDate,
│                          getRosterForActivities, getAttendanceForInstances,
│                          upsertAttendanceRecord, getInstancesForActivities,
│                          getWavesForInstances, getCheckInsForInstances,
│                          getStatusUpdatesForInstances, getStudentInstanceDetail,
│                          getStudentCheckIns, getStudentWaves, getStudentStatusCounts,
│                          getWaveHistory, createPresenceWave, createStatusUpdate,
│                          createCheckIn, deleteCheckIn, createCheckinTags, checkOut
├── attendance.js        — getAllActiveEnrollments (used by rollup)
├── calendars.js         — calendar CRUD
├── enrollments.js       — getOrgEnrollments, getActivityEnrollments, bulkEnrollStudents,
│                          bulkUnenrollStudents, updateEnrollment
├── history.js           — action history feed queries (student + teacher /history views)
├── instances.js         — upsertActivityInstance (via ensure_activity_instance RPC),
│                          getInstancesForDate, cancelInstance
├── organizations.js     — getOrgSettings
├── profiles.js          — batchGetProfileDisplayInfo and other shared profile-name helpers
├── schoolDays.js        — getSchoolDays, getSchoolDay
├── scheduleTemplates.js — schedule template queries
├── terms.js             — academic term queries
├── activityTerms.js     — activity ↔ term junction queries
├── feedback.js          — submit feedback (posts to GitHub via Edge Function)
└── users.js             — getUsers, getStaffUsers, getStudents, createUser, updateUser
```

The `agenda.js` file is the largest and most complex — it handles everything related to what's happening on a given day for a given user, including student and teacher agenda queries, all action data (check-ins, waves, status updates), attendance writes, and instance resolution.
