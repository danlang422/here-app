import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Auth store manages two concerns:
// 1. Session state (user, profile, session) — ephemeral, cleared on logout
// 2. Role selection (currentRole, availableRoles) — persisted to localStorage
//    so multi-role users don't re-select on every page load

const useAuthStore = create(
  persist(
    (set, get) => ({
      // Session state
      user: null,        // Supabase auth user object
      profile: null,     // user_profiles row
      session: null,     // Supabase session object
      loading: true,     // true until initial session check completes

      // Role state
      currentRole: null,     // 'student' | 'teacher' | 'admin'
      availableRoles: [],    // from user_profiles.roles

      setSession: (session) => set({
        session,
        user: session?.user ?? null,
      }),

      setProfile: (profile) => {
        const roles = profile?.roles ?? []
        const currentRole = get().currentRole

        // Auto-select role: restore persisted role if still valid,
        // otherwise pick the first available role
        let selectedRole = currentRole
        if (!selectedRole || !roles.includes(selectedRole)) {
          selectedRole = roles[0] ?? null
        }

        set({
          profile,
          availableRoles: roles,
          currentRole: selectedRole,
        })
      },

      setCurrentRole: (role) => {
        const { availableRoles } = get()
        if (availableRoles.includes(role)) {
          set({ currentRole: role })
        }
      },

      setLoading: (loading) => set({ loading }),

      clearAuth: () => set({
        user: null,
        profile: null,
        session: null,
        loading: false,
        currentRole: null,
        availableRoles: [],
      }),
    }),
    {
      name: 'here-auth',
      // Only persist role selection — session state comes from Supabase
      partialize: (state) => ({
        currentRole: state.currentRole,
      }),
    }
  )
)

export default useAuthStore
