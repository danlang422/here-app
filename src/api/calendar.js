import { supabase } from './supabase'

// Get the current academic term for an organization
export async function getCurrentTerm(organizationId) {
  const { data, error } = await supabase
    .from('academic_terms')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_current', true)
    .single()

  if (error) throw error
  return data
}

// Get all terms for an organization
export async function getTerms(organizationId) {
  const { data, error } = await supabase
    .from('academic_terms')
    .select('*')
    .eq('organization_id', organizationId)
    .order('start_date', { ascending: false })

  if (error) throw error
  return data
}

// Create a new term
export async function createTerm(term) {
  const { data, error } = await supabase
    .from('academic_terms')
    .insert(term)
    .select()
    .single()

  if (error) throw error
  return data
}

// Update a term
export async function updateTerm(termId, updates) {
  const { data, error } = await supabase
    .from('academic_terms')
    .update(updates)
    .eq('id', termId)
    .select()
    .single()

  if (error) throw error
  return data
}

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
