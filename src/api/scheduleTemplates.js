import { supabase } from './supabase'

export async function getDefaultTemplate(orgId) {
  const { data, error } = await supabase
    .from('schedule_templates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle()
  if (error) throw error
  return data // null if no default template exists yet
}

export async function upsertDefaultTemplate(orgId, blockDefinitions) {
  const existing = await getDefaultTemplate(orgId)

  if (existing) {
    const { data, error } = await supabase
      .from('schedule_templates')
      .update({
        block_definitions: blockDefinitions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('schedule_templates')
      .insert({
        organization_id: orgId,
        name: 'Regular',
        is_default: true,
        block_definitions: blockDefinitions,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }
}
