import { supabase } from './supabase'
import { upsertActivityInstance, getInstancesForDate } from './instances'

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

// Fetch all activities assigned to a teacher (as teacher_id or monitor_id),
// plus active enrollment counts per activity. Does NOT filter by date —
// date filtering happens client-side via activityMeetsToday.
export async function getTeacherActivitiesForDate(teacherId, orgId) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('is_active', true)
    .eq('organization_id', orgId)
    .or(`teacher_id.eq.${teacherId},monitor_id.eq.${teacherId}`)

  if (error) throw error

  // Fetch enrollment counts for these activities
  const activityIds = data.map((a) => a.id)
  if (activityIds.length === 0) {
    return { activities: data, enrollmentCounts: new Map() }
  }

  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('activity_id')
    .in('activity_id', activityIds)
    .eq('is_active', true)

  if (enrollError) throw enrollError

  const countMap = new Map()
  for (const e of enrollments) {
    countMap.set(e.activity_id, (countMap.get(e.activity_id) ?? 0) + 1)
  }

  return { activities: data, enrollmentCounts: countMap }
}

// Fetch enrollment rosters for one or more activities with student profiles.
export async function getRosterForActivities(activityIds) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*, student:student_id(id, first_name, last_name, preferred_name)')
    .in('activity_id', activityIds)
    .eq('is_active', true)

  if (error) throw error
  return data
}

// Fetch existing attendance records for given activity instance IDs.
export async function getAttendanceForInstances(instanceIds) {
  if (instanceIds.length === 0) return []

  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}

// Create or update a single attendance record.
export async function upsertAttendanceRecord(instanceId, studentId, status, markedById) {
  const { data, error } = await supabase
    .from('attendance_records')
    .upsert(
      {
        activity_instance_id: instanceId,
        student_id: studentId,
        status,
        marked_by_id: markedById,
        marked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'activity_instance_id,student_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

// Fetch activity instances for a date, filtered to specific activity IDs.
// Used by roster modal to get instance IDs for attendance upserts.
export async function getInstancesForActivities(orgId, date, activityIds) {
  const instances = await getInstancesForDate(orgId, date)
  const filtered = instances.filter((i) => activityIds.includes(i.activity_id))
  return new Map(filtered.map((i) => [i.activity_id, i.id]))
}