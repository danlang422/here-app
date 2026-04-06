import { supabase } from './supabase'

// Get all enrollments for an activity
export async function getActivityEnrollments(activityId, { isActive = true } = {}) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      student:user_profiles!student_id(
        id, first_name, last_name, preferred_name, grade_level, is_active
      )
    `)
    .eq('activity_id', activityId)
    .eq('is_active', isActive)
    .order('student(last_name)')

  if (error) throw error
  return data
}

// Get all enrollments for a student
export async function getStudentEnrollments(studentId, { isActive = true } = {}) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      activity:activities(*)
    `)
    .eq('student_id', studentId)
    .eq('is_active', isActive)

  if (error) throw error
  return data
}

// Enroll a student in an activity
export async function enrollStudent(enrollment) {
  const { data, error } = await supabase
    .from('enrollments')
    .insert(enrollment)
    .select()
    .single()

  if (error) throw error
  return data
}

// Bulk enroll students in an activity
export async function bulkEnrollStudents(enrollments) {
  const { data, error } = await supabase
    .from('enrollments')
    .insert(enrollments)
    .select()

  if (error) throw error
  return data
}

// Unenroll a student (soft delete — sets is_active = false)
export async function unenrollStudent(enrollmentId) {
  const { data, error } = await supabase
    .from('enrollments')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', enrollmentId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Get all active enrollments for an org with joined activity schedule data
// Used as the client-side cache for conflict checking.
// Filters through activity.organization_id since enrollments don't have org_id directly.
export async function getOrgEnrollments(organizationId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id, student_id, activity_id, block, is_active,
      days_of_week, rotation_day_type, recurrence_interval, recurrence_anchor_date,
      activity:activities!inner(
        id, name, block, days_of_week, rotation_day_type,
        default_start_time, default_end_time,
        recurrence_interval, recurrence_anchor_date
      )
    `)
    .eq('activity.organization_id', organizationId)
    .eq('is_active', true)

  if (error) throw error
  return data
}

// Clean up enrollment day constraints after an activity's days_of_week is narrowed.
// For each enrollment that references removed days:
//   - removes the orphaned days from enrollment.days_of_week
//   - deactivates the enrollment if no valid days remain
export async function cleanOrphanedEnrollmentDays(activityId, removedDays) {
  const { data: affected, error } = await supabase
    .from('enrollments')
    .select('id, days_of_week')
    .eq('activity_id', activityId)
    .eq('is_active', true)
    .not('days_of_week', 'is', null)

  if (error) throw error

  const updates = affected
    .map((e) => ({
      id: e.id,
      newDays: e.days_of_week.filter((d) => !removedDays.includes(d)),
    }))
    .filter(({ newDays, id: _id }) => {
      const orig = affected.find((e) => e.id === _id)
      return newDays.length < orig.days_of_week.length
    })

  if (updates.length === 0) return 0

  await Promise.all(
    updates.map(({ id, newDays }) =>
      newDays.length > 0
        ? supabase
            .from('enrollments')
            .update({ days_of_week: newDays, updated_at: new Date().toISOString() })
            .eq('id', id)
        : supabase
            .from('enrollments')
            .update({
              is_active: false,
              notes: 'Deactivated: activity schedule changed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)
    )
  )

  return updates.length
}

// Bulk unenroll students (soft delete — sets is_active = false)
export async function bulkUnenrollStudents(enrollmentIds) {
  const { data, error } = await supabase
    .from('enrollments')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in('id', enrollmentIds)
    .select()

  if (error) throw error
  return data
}

// Update an enrollment
export async function updateEnrollment(enrollmentId, updates) {
  const { data, error } = await supabase
    .from('enrollments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', enrollmentId)
    .select()
    .single()

  if (error) throw error
  return data
}
