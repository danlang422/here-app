import { supabase } from './supabase'

// Sign in with email + password
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Get the current auth user
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Get the user_profiles row for the current auth user
export async function getCurrentUserProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) throw error
  return data
}

// Get a user profile by ID
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

// Get all user profiles for an organization
export async function getOrgUsers(organizationId, { role, isActive = true } = {}) {
  let query = supabase
    .from('user_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', isActive)
    .order('last_name')

  if (role) {
    query = query.contains('roles', [role])
  }

  const { data, error } = await query
  if (error) throw error
  return data
}
