import { supabase } from './supabase'
import { upsertActivityInstance } from './instances'

// Fetch display name info for a profile via SECURITY DEFINER function.
// Bypasses RLS to avoid recursion when students need teacher names.
// Returns { id, first_name, last_name, preferred_name } or null.
async function getProfileDisplayInfo(profileId) {
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
async function batchGetProfileDisplayInfo(profileIds) {
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

// Fetch a student's actively enrolled activities with staff display names.
// Does NOT filter by date — returns all active enrollments. Date filtering
// happens client-side via activityMeetsToday (depends on school day record).
export async function getStudentActivitiesForDate(studentId, orgId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      activity:activities!inner(*)
    `)
    .eq('student_id', studentId)
    .eq('is_active', true)

  if (error) throw error

  const activities = data
    .filter((enrollment) => enrollment.activity?.is_active)
    .map((enrollment) => ({
      ...enrollment.activity,
      enrollment_id: enrollment.id,
      enrollment_block: enrollment.block,
    }))

  // Fetch teacher/monitor display names via SECURITY DEFINER function
  const staffIds = activities.flatMap((a) =>
    [a.teacher_id, a.monitor_id].filter(Boolean)
  )
  const staffProfiles = await batchGetProfileDisplayInfo(staffIds)

  // Attach staff profile info to each activity
  return activities.map((activity) => ({
    ...activity,
    teacher: activity.teacher_id
      ? staffProfiles.get(activity.teacher_id) ?? null
      : null,
    monitor: activity.monitor_id
      ? staffProfiles.get(activity.monitor_id) ?? null
      : null,
  }))
}

// Batch-ensure activity instances exist for a set of activities on a date.
// Fire-and-forget — callers don't await results for rendering.
export async function ensureActivityInstances(activityIds, orgId, date) {
  await Promise.all(
    activityIds.map((id) => upsertActivityInstance(id, orgId, date))
  )
}