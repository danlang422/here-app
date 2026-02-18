import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user: null,       // Supabase auth user object
  profile: null,    // user_profiles row
  session: null,    // Supabase session object
  loading: true,    // true until initial session check completes

  setSession: (session) => set({
    session,
    user: session?.user ?? null,
  }),

  setProfile: (profile) => set({ profile }),

  setLoading: (loading) => set({ loading }),

  clearAuth: () => set({
    user: null,
    profile: null,
    session: null,
    loading: false,
  }),
}))

export default useAuthStore
