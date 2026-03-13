import { useEffect } from 'react'
import { supabase } from '@/api/supabase'
import useAuthStore from '@/store/authStore'
import { queryClient } from '@/main'

// Fetches the user_profiles row for a given auth user ID.
// Uses raw fetch instead of the Supabase client because supabase-js v2
// deadlocks when client methods are called inside onAuthStateChange callbacks.
async function fetchProfile(userId, accessToken) {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL
    const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY

    const res = await fetch(`${url}/rest/v1/user_profiles?select=*&id=eq.${userId}`, {
      headers: {
        'apikey': apikey,
        'Authorization': `Bearer ${accessToken}`,
      }
    })

    if (!res.ok) {
      console.error('Failed to fetch user profile:', res.status)
      return null
    }

    const rows = await res.json()
    return rows?.[0] ?? null
  } catch (err) {
    console.error('Failed to fetch user profile:', err)
    return null
  }
}

// Initializes the Supabase auth listener and keeps the store in sync.
// Called once at the app root level via AuthProvider.
export function useAuthListener() {
  const { setSession, setProfile, setLoading, clearAuth } = useAuthStore()

  useEffect(() => {
    let mounted = true

    // Check for an existing session on mount (e.g. page refresh).
    // This handles the initial load — onAuthStateChange also fires
    // an INITIAL_SESSION event, but getSession resolves first and
    // clears the loading state so the app renders without delay.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setSession(session)

      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.access_token)
        if (!mounted) return
        setProfile(profile)
      }

      setLoading(false)
    }).catch((err) => {
      console.error('getSession failed:', err)
      if (mounted) setLoading(false)
    })

    // Subscribe to auth state changes (login, logout, token refresh).
    // Skips INITIAL_SESSION since getSession above handles that.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'INITIAL_SESSION') return

        setSession(session)

        if (session?.user) {
          const profile = await fetchProfile(session.user.id, session.access_token)
          if (!mounted) return
          setProfile(profile)
        } else {
          queryClient.clear()
          clearAuth()
        }

        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])
}

// Convenience hook for components that just need the current auth state
export function useAuth() {
  return useAuthStore()
}
