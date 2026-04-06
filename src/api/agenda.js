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
      enrollment_days_of_week: enrollment.days_of_week,
      enrollment_rotation_day_type: enrollment.rotation_day_type,
      enrollment_recurrence_interval: enrollment.recurrence_interval,
      enrollment_recurrence_anchor_date: enrollment.recurrence_anchor_date,
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
    .select('activity_id, days_of_week, rotation_day_type, recurrence_interval, recurrence_anchor_date')
    .in('activity_id', activityIds)
    .eq('is_active', true)

  if (enrollError) throw enrollError

  // Return enrollment rows grouped by activity_id.
  // The hook computes date-filtered counts client-side where schoolDay is available.
  const enrollmentsByActivity = new Map()
  for (const e of enrollments) {
    if (!enrollmentsByActivity.has(e.activity_id)) enrollmentsByActivity.set(e.activity_id, [])
    enrollmentsByActivity.get(e.activity_id).push(e)
  }

  return { activities: data, enrollmentsByActivity }
}

// Fetch enrollment rosters for one or more activities with student profiles.
export async function getRosterForActivities(activityIds) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, activity_id, student_id, block, days_of_week, rotation_day_type, recurrence_interval, recurrence_anchor_date, student:student_id(id, first_name, last_name, preferred_name, grade_level)')
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

// --- Teacher action summary API functions ---

// Fetch all presence waves for a set of activity instances (teacher view).
export async function getWavesForInstances(instanceIds) {
  if (instanceIds.length === 0) return []

  const { data, error } = await supabase
    .from('presence_waves')
    .select('*')
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}

// Fetch all check-ins for a set of activity instances (teacher view).
export async function getCheckInsForInstances(instanceIds) {
  if (instanceIds.length === 0) return []

  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}

// Fetch all status updates for a set of activity instances (teacher view).
export async function getStatusUpdatesForInstances(instanceIds) {
  if (instanceIds.length === 0) return []

  const { data, error } = await supabase
    .from('status_updates')
    .select('*')
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}

// Fetch full detail for a single student on a single activity instance.
// Used by the student detail overlay.
export async function getStudentInstanceDetail(studentId, instanceId) {
  const [checkIns, waves, statusUpdates] = await Promise.all([
    supabase
      .from('check_ins')
      .select('*')
      .eq('student_id', studentId)
      .eq('activity_instance_id', instanceId)
      .maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data }),
    supabase
      .from('presence_waves')
      .select('*')
      .eq('student_id', studentId)
      .eq('activity_instance_id', instanceId)
      .maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data }),
    supabase
      .from('status_updates')
      .select('*')
      .eq('student_id', studentId)
      .eq('activity_instance_id', instanceId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => { if (error) throw error; return data ?? [] }),
  ])

  // If check-in exists, fetch freeform tags
  let freeformTags = []
  if (checkIns?.id) {
    const { data: tags, error: tagError } = await supabase
      .from('checkin_activity_tags')
      .select('*, activity:activity_id(name)')
      .eq('checkin_id', checkIns.id)

    if (!tagError && tags) {
      freeformTags = tags.map(t => t.activity?.name).filter(Boolean)
    }
  }

  return {
    checkIn: checkIns,
    wave: waves,
    statusUpdates,
    freeformTags,
  }
}

// --- Student action API functions ---

// Fetch existing check-ins for a student across multiple instances
export async function getStudentCheckIns(studentId, instanceIds) {
  if (instanceIds.length === 0) return []

  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('student_id', studentId)
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}

// Fetch existing waves for a student across multiple instances
export async function getStudentWaves(studentId, instanceIds) {
  if (instanceIds.length === 0) return []

  const { data, error } = await supabase
    .from('presence_waves')
    .select('*')
    .eq('student_id', studentId)
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}

// Fetch status update counts per instance for a student
export async function getStudentStatusCounts(studentId, instanceIds) {
  if (instanceIds.length === 0) return []

  const { data, error } = await supabase
    .from('status_updates')
    .select('activity_instance_id')
    .eq('student_id', studentId)
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}

// Fetch wave history for streak calculation
export async function getWaveHistory(studentId, activityIds, sinceDate) {
  if (activityIds.length === 0) return []

  const { data, error } = await supabase
    .from('presence_waves')
    .select('*, activity_instance:activity_instance_id(activity_id, date)')
    .eq('student_id', studentId)
    .gte('waved_at', sinceDate)

  if (error) throw error
  // Filter to relevant activities client-side (join doesn't filter by activity_id)
  return data.filter(
    (w) => w.activity_instance && activityIds.includes(w.activity_instance.activity_id)
  )
}

// Create a presence wave
export async function createPresenceWave(studentId, instanceId) {
  const { data, error } = await supabase
    .from('presence_waves')
    .insert({
      student_id: studentId,
      activity_instance_id: instanceId,
      waved_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Create a status update
export async function createStatusUpdate(studentId, instanceId, statusType, content, checkinId = null) {
  const { data, error } = await supabase
    .from('status_updates')
    .insert({
      student_id: studentId,
      activity_instance_id: instanceId,
      checkin_id: checkinId,
      status_type: statusType,
      content: content.trim(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Create a check-in record
export async function createCheckIn(studentId, instanceId, locationData = {}) {
  const { data, error } = await supabase
    .from('check_ins')
    .insert({
      student_id: studentId,
      activity_instance_id: instanceId,
      checked_in_at: new Date().toISOString(),
      check_in_location_lat: locationData.lat ?? null,
      check_in_location_lng: locationData.lng ?? null,
      geofence_validated: locationData.validated ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete a check-in (rollback on cancel)
export async function deleteCheckIn(checkinId) {
  const { error } = await supabase
    .from('check_ins')
    .delete()
    .eq('id', checkinId)

  if (error) throw error
}

// Create freeform activity tags for a check-in
export async function createCheckinTags(checkinId, activityIds) {
  const rows = activityIds.map((activityId) => ({
    checkin_id: checkinId,
    activity_id: activityId,
  }))

  const { data, error } = await supabase
    .from('checkin_activity_tags')
    .insert(rows)
    .select()

  if (error) throw error
  return data
}

// Check out (update existing check-in with checkout timestamp)
export async function checkOut(checkinId) {
  const { data, error } = await supabase
    .from('check_ins')
    .update({
      checked_out_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkinId)
    .select()
    .single()

  if (error) throw error
  return data
}