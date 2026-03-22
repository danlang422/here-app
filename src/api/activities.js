import { supabase } from './supabase'

// Get a single activity by ID
export async function getActivity(activityId) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('id', activityId)
    .single()

  if (error) throw error
  return data
}

// Get all activities for an organization, with optional filters
export async function getActivities(organizationId, { termId, isActive = true } = {}) {
  let query = supabase
    .from('activities')
    .select(`
      *,
      teacher:user_profiles!teacher_id(first_name, last_name),
      monitor:user_profiles!monitor_id(first_name, last_name),
      activity_terms(id, term_id, is_primary, term:academic_terms(id, name, start_date, end_date))
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', isActive)
    .order('block', { ascending: true, nullsFirst: false })
    .order('name')

  const { data, error } = await query
  if (error) throw error

  // Client-side term filter (PostgREST filters nested arrays but still returns all rows)
  if (termId) {
    return data.filter((a) => a.activity_terms?.some((at) => at.term_id === termId))
  }

  return data
}

// Get activities that need scheduling (admin view)
export async function getNeedsScheduling(organizationId) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('is_not_scheduled', false)
    .eq('is_release', false)
    .or('days_of_week.is.null,default_start_time.is.null')
    .order('created_at')

  if (error) throw error
  return data
}

// Create a new activity
export async function createActivity(activity) {
  const { data, error } = await supabase
    .from('activities')
    .insert(activity)
    .select()
    .single()

  if (error) throw error
  return data
}

// Update an activity
export async function updateActivity(activityId, updates) {
  const { data, error } = await supabase
    .from('activities')
    .update(updates)
    .eq('id', activityId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Get activities for a teacher (where they are teacher or monitor)
export async function getTeacherActivities(teacherId, organizationId) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .or(`teacher_id.eq.${teacherId},monitor_id.eq.${teacherId}`)
    .order('block')

  if (error) throw error
  return data
}

// Get a student's schedule — all activities they're enrolled in
export async function getStudentActivities(studentId) {
  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      enrollments!inner(id, student_id, block, is_active, notes)
    `)
    .eq('enrollments.student_id', studentId)
    .eq('enrollments.is_active', true)
    .eq('is_active', true)
    .order('block', { ascending: true, nullsFirst: false })

  if (error) throw error
  return data
}

// Get internship opportunities for an organization
export async function getInternshipOpportunities(organizationId, { isAvailable = true } = {}) {
  let query = supabase
    .from('internship_opportunities')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name')

  if (isAvailable !== null) {
    query = query.eq('is_available', isAvailable)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}
