import { supabase } from './supabase'

// Fetch display name info for a profile via SECURITY DEFINER function.
// Bypasses RLS to avoid recursion when reading cross-role profiles.
export async function getProfileDisplayInfo(profileId) {
  const { data, error } = await supabase
    .rpc('get_profile_display_info', { profile_id: profileId })

  if (error) {
    console.error('Failed to fetch profile display info:', error)
    return null
  }

  return data?.[0] ?? null
}

// Batch-fetch display names for multiple profile IDs.
// Deduplicates IDs and returns a Map of id → profile info.
export async function batchGetProfileDisplayInfo(profileIds) {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const results = await Promise.all(
    uniqueIds.map(async (id) => {
      const info = await getProfileDisplayInfo(id)
      return [id, info]
    })
  )

  return new Map(results)
}

// Format a profile into a display name string.
export function formatDisplayName(profile) {
  if (!profile) return null
  const first = profile.preferred_name || profile.first_name
  return `${first} ${profile.last_name}`.trim()
}
