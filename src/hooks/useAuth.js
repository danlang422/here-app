import { useEffect } from 'react'
import { supabase } from '@/api/supabase'
import useAuthStore from '@/store/authStore'

// Fetches the user_profiles row for a given auth user ID
async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Failed to fetch user profile:', error.message)
    return null
  }

  return data
}

// Initializes the Supabase auth listener and keeps the store in sync.
// Called once at the app root level via AuthProvider.
export function useAuthListener() {
  const { setSession, setProfile, setLoading, clearAuth } = useAuthStore()

  useEffect(() => {
    // Check for an existing session on mount (e.g. page refresh)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)

      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setProfile(profile)
      }

      setLoading(false)
    })

    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)

        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          setProfile(profile)
        } else {
          clearAuth()
        }

        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [setSession, setProfile, setLoading, clearAuth])
}

// Convenience hook for components that just need the current auth state
export function useAuth() {
  return useAuthStore()
}
