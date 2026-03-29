import { supabase } from './supabase'

// Term CRUD functions are in terms.js — this file handles school days and schedule templates.

// Get the school day record for a specific date
export async function getSchoolDay(organizationId, date) {
  const { data, error } = await supabase
    .from('school_days')
    .select('*, schedule_template:schedule_templates(*)')
    .eq('organization_id', organizationId)
    .eq('date', date)
    .maybeSingle()

  if (error) throw error
  return data
}

// Get school days for a date range
export async function getSchoolDays(organizationId, startDate, endDate) {
  const { data, error } = await supabase
    .from('school_days')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')

  if (error) throw error
  return data
}

// Upsert a school day (create or update)
export async function upsertSchoolDay(schoolDay) {
  const { data, error } = await supabase
    .from('school_days')
    .upsert(schoolDay, { onConflict: 'organization_id,date' })
    .select()
    .single()

  if (error) throw error
  return data
}

// Bulk upsert school days (e.g., generating a full term calendar)
export async function bulkUpsertSchoolDays(schoolDays) {
  const { data, error } = await supabase
    .from('school_days')
    .upsert(schoolDays, { onConflict: 'organization_id,date' })
    .select()

  if (error) throw error
  return data
}

// Delete school days in a date range (for term deletion/shrinking)
export async function deleteSchoolDaysInRange(organizationId, startDate, endDate) {
  const { error } = await supabase
    .from('school_days')
    .delete()
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error
}

// Get all schedule templates for an organization
export async function getScheduleTemplates(organizationId) {
  const { data, error } = await supabase
    .from('schedule_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .order('is_default', { ascending: false })

  if (error) throw error
  return data
}

// Get the default schedule template
export async function getDefaultScheduleTemplate(organizationId) {
  const { data, error } = await supabase
    .from('schedule_templates')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_default', true)
    .single()

  if (error) throw error
  return data
}

// Create a schedule template
export async function createScheduleTemplate(template) {
  const { data, error } = await supabase
    .from('schedule_templates')
    .insert(template)
    .select()
    .single()

  if (error) throw error
  return data
}

// Update a schedule template
export async function updateScheduleTemplate(templateId, updates) {
  const { data, error } = await supabase
    .from('schedule_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single()

  if (error) throw error
  return data
}
