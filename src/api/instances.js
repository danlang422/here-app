import { supabase } from './supabase'

// Get or create an activity instance for a given activity + date.
// Uses upsert so concurrent calls are safe.
export async function upsertActivityInstance(activityId, organizationId, date) {
  const { data, error } = await supabase
    .from('activity_instances')
    .upsert(
      { activity_id: activityId, organization_id: organizationId, date },
      { onConflict: 'activity_id,date' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

// Get instances for a specific date (optionally filtered by activity)
export async function getInstancesForDate(organizationId, date, { activityId } = {}) {
  let query = supabase
    .from('activity_instances')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('date', date)

  if (activityId) {
    query = query.eq('activity_id', activityId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

// Cancel an instance
export async function cancelInstance(instanceId, notes) {
  const { data, error } = await supabase
    .from('activity_instances')
    .update({ cancelled: true, notes })
    .eq('id', instanceId)
    .select()
    .single()

  if (error) throw error
  return data
}
