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
