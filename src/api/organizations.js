import { supabase } from './supabase'

// Get an organization by ID
export async function getOrganization(orgId) {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single()

  if (error) throw error
  return data
}

// Update organization settings (merges with existing settings JSONB)
export async function updateOrgSettings(orgId, settingsUpdate) {
  // First fetch current settings so we can merge
  const { data: org, error: fetchError } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single()

  if (fetchError) throw fetchError

  const mergedSettings = { ...org.settings, ...settingsUpdate }

  const { data, error } = await supabase
    .from('organizations')
    .update({ settings: mergedSettings, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Convenience: get just the settings object
export async function getOrgSettings(orgId) {
  const org = await getOrganization(orgId)
  return org.settings
}
