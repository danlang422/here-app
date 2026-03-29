import { supabase } from '@/api/supabase'

export async function getCalendars(organizationId) {
  const { data, error } = await supabase
    .from('calendars')
    .select(`
      *,
      owner:user_profiles!owner_id(id, first_name, last_name)
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data
}

export async function createCalendar(calendar) {
  const { data, error } = await supabase
    .from('calendars')
    .insert(calendar)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCalendar(id, updates) {
  const { data, error } = await supabase
    .from('calendars')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCalendar(id) {
  // Hard delete — cascade sets activities.calendar_id = NULL (per migration ON DELETE SET NULL)
  const { error } = await supabase
    .from('calendars')
    .delete()
    .eq('id', id)
  if (error) throw error
}
