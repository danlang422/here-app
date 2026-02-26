# Auth & Security

## Supabase Auth

Authentication is handled entirely by Supabase Auth. The app uses email/password authentication for MVP. Supabase manages sessions, JWT tokens, and password reset flows.

### Auth Functions

```jsx
// src/api/auth.js
import { supabase } from './supabase'

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
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

### Auth Hook

The `useAuth` hook wraps profile loading in React Query and exposes the current user, their profile (including `roles`), and loading state:

```jsx
// src/hooks/useAuth.js
export function useAuth() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: getCurrentUserProfile,
    staleTime: Infinity, // Profile rarely changes mid-session
  })

  return { user: profile, isLoading }
}
```

---

## Role System

Roles are stored as a `TEXT[]` array on `user_profiles.roles`. Possible values are `'student'`, `'teacher'`, and `'admin'`. A user can hold multiple roles — the most common combination is `['teacher', 'admin']`.

### Role Switching

Multi-role users select which role they're currently operating as. This drives which routes, views, and data they see. The active role is persisted in Zustand with localStorage so it survives page reloads.

```jsx
// src/store/authStore.js
export const useAuthStore = create(
  persist(
    (set) => ({
      currentRole: null,
      availableRoles: [],
      setCurrentRole: (role) => set({ currentRole: role }),
      setAvailableRoles: (roles) => set({ availableRoles: roles }),
    }),
    { name: 'auth-storage' }
  )
)
```

On login, `availableRoles` is populated from `user_profiles.roles`. If only one role exists, `currentRole` is set automatically. If multiple roles exist, the user is prompted to choose (or the last-used role is restored from localStorage).

```jsx
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

Role switching does **not** change the Supabase session or JWT. The user's full set of roles is always available to RLS policies via the `user_profiles` table. Switching roles only changes which UI views are rendered.

---

## Protected Routes

Route protection checks both authentication (is the user logged in?) and authorization (does the user have the required role?).

```jsx
// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'

export function ProtectedRoute({ children, requiredRole }) {
  const { user, isLoading } = useAuth()
  const { currentRole } = useAuthStore()

  if (isLoading) return <LoadingSpinner />

  if (!user) return <Navigate to="/login" replace />

  if (requiredRole && currentRole !== requiredRole) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
```

Usage in the router:

```jsx
<Route
  path="/admin/*"
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

---

## Row Level Security (RLS)

All data access is enforced at the database level through Supabase RLS policies. The frontend does not need to implement its own authorization checks beyond role-based UI routing — even if a student somehow navigated to a teacher URL, the API calls would return empty results because RLS would block the data.

### Policy Strategy

RLS policies are defined in the [schema documentation](../schema/10-rls-policies.md). Key principles:

- **Organization scoping**: All queries are implicitly scoped to the user's organization. A user can never see data from another organization.
- **Role-based access**: Policies check `user_profiles.roles` using `ANY(roles)` to determine read/write permissions. Teachers can read all activities in their org; students can only read activities they're enrolled in.
- **Ownership checks**: Students can only create/read their own check-ins, status updates, and presence waves. The `student_id = auth.uid()` pattern enforces this.
- **Teacher scope**: Teachers see activities where `teacher_id = me OR monitor_id = me`. Admin role grants full read/write to all org data.

### Performance Note

RLS policies that join to `user_profiles` to check roles are evaluated on every query. For frequently-hit tables like `activity_instances` and `attendance_records`, the `organization_id` column is denormalized from the parent `activities` table so RLS can check org membership without an additional join. This is why `activity_instances` carries its own `organization_id` even though it could be derived from `activities.organization_id`.
