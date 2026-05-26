import { supabase } from './supabase'

// Fetch all active enrollments with student and activity data for a given org.
// Returns enrollment rows with nested student and activity objects.
// Does NOT filter by date — caller applies enrollmentMeetsToday client-side.
export async function getAllActiveEnrollments() {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      student_id,
      activity_id,
      block,
      days_of_week,
      rotation_day_type,
      recurrence_interval,
      recurrence_anchor_date,
      student:student_id(id, first_name, last_name, preferred_name, grade_level),
      activity:activity_id(
        id, name, block, is_active, is_not_scheduled, is_release,
        requires_attendance, days_of_week, rotation_day_type,
        recurrence_interval, recurrence_anchor_date,
        start_date, end_date
      )
    `)
    .eq('is_active', true)

  if (error) throw error

  return data.filter((e) => e.activity?.is_active)
}
