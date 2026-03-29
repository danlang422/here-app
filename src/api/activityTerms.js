import { supabase } from './supabase'

/**
 * Get all term associations for an activity.
 */
export async function getActivityTerms(activityId) {
  const { data, error } = await supabase
    .from('activity_terms')
    .select('*, term:academic_terms(id, name, start_date, end_date)')
    .eq('activity_id', activityId)
    .order('is_primary', { ascending: false }) // primary first
    .order('created_at')

  if (error) throw error
  return data
}

/**
 * Add a term to an activity.
 * If the activity has no existing term associations, marks this one as primary.
 */
export async function addActivityTerm(activityId, termId, { isPrimary = false } = {}) {
  const { data, error } = await supabase
    .from('activity_terms')
    .insert({ activity_id: activityId, term_id: termId, is_primary: isPrimary })
    .select('*, term:academic_terms(id, name, start_date, end_date)')
    .single()

  if (error) throw error
  return data
}

/**
 * Remove a term association from an activity.
 */
export async function removeActivityTerm(activityTermId) {
  const { error } = await supabase
    .from('activity_terms')
    .delete()
    .eq('id', activityTermId)

  if (error) throw error
}

/**
 * Replace all term associations for an activity.
 * Deletes existing terms and inserts the new set.
 * The first termId in the array is marked as primary.
 * Passing an empty array clears all terms.
 */
export async function replaceActivityTerms(activityId, termIds) {
  const { error: deleteError } = await supabase
    .from('activity_terms')
    .delete()
    .eq('activity_id', activityId)

  if (deleteError) throw deleteError

  if (termIds.length === 0) return

  const rows = termIds.map((termId, i) => ({
    activity_id: activityId,
    term_id: termId,
    is_primary: i === 0,
  }))

  const { error: insertError } = await supabase
    .from('activity_terms')
    .insert(rows)

  if (insertError) throw insertError
}
