import { supabase } from './supabase'
import { upsertActivityInstance } from './instances'

// Fetch a student's actively enrolled activities with teacher profile joins.
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

  return data
    .filter((enrollment) => enrollment.activity?.is_active)
    .map((enrollment) => ({
      ...enrollment.activity,
      enrollment_id: enrollment.id,
      enrollment_block: enrollment.block,
    }))
}

// Batch-ensure activity instances exist for a set of activities on a date.
// Fire-and-forget — callers don't await results for rendering.
export async function ensureActivityInstances(activityIds, orgId, date) {
  await Promise.all(
    activityIds.map((id) => upsertActivityInstance(id, orgId, date))
  )
}
