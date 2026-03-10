import { supabase } from './supabase'

export async function getTerms(orgId) {
  const { data, error } = await supabase
    .from('academic_terms')
    .select('*')
    .eq('organization_id', orgId)
    .order('start_date', { ascending: true })
  if (error) throw error
  return data
}

export async function createTerm(orgId, termData) {
  const { data, error } = await supabase
    .from('academic_terms')
    .insert({ ...termData, organization_id: orgId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTerm(termId, updates) {
  const { data, error } = await supabase
    .from('academic_terms')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', termId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTerm(termId) {
  const { error } = await supabase
    .from('academic_terms')
    .delete()
    .eq('id', termId)
  if (error) throw error
}

export async function setCurrentTerm(orgId, termId) {
  // Unset any existing current term
  const { error: unsetError } = await supabase
    .from('academic_terms')
    .update({ is_current: false })
    .eq('organization_id', orgId)
    .eq('is_current', true)
  if (unsetError) throw unsetError

  // Set the new current term
  const { data, error } = await supabase
    .from('academic_terms')
    .update({ is_current: true, updated_at: new Date().toISOString() })
    .eq('id', termId)
    .select()
    .single()
  if (error) throw error
  return data
}
