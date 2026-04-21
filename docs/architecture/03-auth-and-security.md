# Auth & Security

**Last updated:** April 2026 (session 34)

## Supabase Auth

Authentication is handled entirely by Supabase Auth using email/password. Supabase manages sessions, JWT tokens, and password reset flows.

### Auth initialization

Auth state is managed in Zustand (not TanStack Query) because it's global session state, not server data. The `useAuthListener` hook in `src/hooks/useAuth.js` initializes once at app startup via `AuthProvider`, calls `supabase.auth.getSession()` on mount, and subscribes to `onAuthStateChange` for subsequent login/logout/token-refresh events.

A notable quirk: `fetchProfile` uses raw `fetch` instead of the Supabase client because calling Supabase client methods inside `onAuthStateChange` callbacks causes a deadlock in supabase-js v2.95 (#9). This is intentional — don't change it until supabase-js is upgraded.

```js
// src/hooks/useAuth.js (simplified)
export function useAuthListener() {
  const { setSession, setProfile, setLoading, clearAuth } = useAuthStore()

  useEffect(() => {
    // 1. Check for existing session on mount (handles page refresh)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.access_token)
        setProfile(profile)
      }
      setLoading(false)
    })

    // 2. Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return // handled above
        setSession(session)
        if (session?.user) {
          const profile = await fetchProfile(session.user.id, session.access_token)
          setProfile(profile)
        } else {
          queryClient.clear()
          clearAuth()
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])
}

// Convenience hook for components
export function useAuth() {
  return useAuthStore()
}
```

### Auth API functions (`src/api/auth.js`)

- `signIn(email, password)` — wraps `supabase.auth.signInWithPassword`
- `signOut()` — wraps `supabase.auth.signOut`
- `requestPasswordReset(email)` — sends reset email with redirect to `/reset-password`
- `updatePassword(newPassword)` — updates current user's password
- `getCurrentUser()` / `getCurrentUserProfile()` — utility functions

---

## Role System

Roles are stored as a `TEXT[]` array on `user_profiles.roles`. Valid values: `'student'`, `'teacher'`, `'admin'`. A user can hold multiple roles — the most common combination is `['teacher', 'admin']`.

The `substitute` role is planned (#77) but not yet implemented. When added, it will be treated identically to `teacher` for routing and RLS purposes initially.

### Auth store (`src/store/authStore.js`)

```js
const useAuthStore = create(
  persist(
    (set, get) => ({
      // Session state (ephemeral)
      user: null,       // Supabase auth user object
      profile: null,    // user_profiles row
      session: null,    // Supabase session
      loading: true,

      // Role state
      currentRole: null,     // active role for this session
      availableRoles: [],    // from user_profiles.roles

      setProfile: (profile) => {
        const roles = profile?.roles ?? []
        // Restore persisted role if still valid, else pick first
        let selectedRole = get().currentRole
        if (!selectedRole || !roles.includes(selectedRole)) {
          selectedRole = roles[0] ?? null
        }
        set({ profile, availableRoles: roles, currentRole: selectedRole })
      },
      // ... setSession, setCurrentRole, setLoading, clearAuth
    }),
    {
      name: 'here-auth',
      partialize: (state) => ({ currentRole: state.currentRole }), // only persist role
    }
  )
)
```

Only `currentRole` is persisted to localStorage — session state is always restored fresh from Supabase on page load.

---

## Protected Routes

`ProtectedRoute` in `src/components/layout/ProtectedRoute.jsx` reads directly from the Zustand auth store (no loading spinner needed since the store initializes synchronously from localStorage).

```jsx
function ProtectedRoute({ children, requiredRole }) {
  const { user, currentRole } = useAuthStore()
  const location = useLocation()

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (requiredRole && currentRole !== requiredRole) return <Navigate to="/dashboard" replace />

  return children
}
```

Routes without `requiredRole` are accessible to any authenticated user (e.g. `/account`, `/help`). Routes with `requiredRole` redirect to `/dashboard` on role mismatch — which then redirects to the correct role-appropriate view via `DashboardRedirect`.

---

## Row Level Security (RLS)

All data access is enforced at the database level through Supabase RLS policies. The frontend role-based routing is a UX layer only — even if a student navigated to a teacher URL, API calls would return empty results because RLS would block the data.

RLS policies are documented in `docs/schema/10-rls-policies.md`. Key principles:

- **Organization scoping:** All queries are implicitly scoped to the user's organization.
- **Role-based access:** Policies check `user_profiles.roles` via helper functions (`is_role()`, `is_staff_of()`) rather than checking columns directly.
- **Ownership checks:** Students can only create/read their own check-ins, waves, and status updates (`student_id = auth.uid()`).
- **Teacher scope:** Currently `teacher_id = me OR monitor_id = me` on activities — this will move to a junction table query when #70 lands.
- **Admin:** Full read/write on all org data.

Performance note: `organization_id` is denormalized onto several tables (including `activity_instances`) so RLS can check org membership without additional joins on high-traffic queries.
