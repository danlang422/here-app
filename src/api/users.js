import { supabase } from './supabase'

// Get all users for an organization
export async function getUsers(organizationId, { roles, isActive = true } = {}) {
  let query = supabase
    .from('user_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', isActive)
    .order('last_name')
    .order('first_name')

  // Filter by role if specified (e.g., ['teacher', 'admin'])
  // Uses the Postgres overlap operator via PostgREST
  if (roles && roles.length > 0) {
    query = query.overlaps('roles', roles)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

// Get staff members (teachers and admins) — convenience for activity form dropdowns
export async function getStaffUsers(organizationId) {
  return getUsers(organizationId, { roles: ['teacher', 'admin'] })
}

// Get students — convenience for enrollment workflows
export async function getStudents(organizationId) {
  return getUsers(organizationId, { roles: ['student'] })
}

// Get a single user by ID
export async function getUser(userId) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

// Create a new user via Edge Function (requires service role)
export async function createUser(userData) {
  const { data: { session } } = await supabase.auth.getSession()

  const { data, error } = await supabase.functions.invoke('create-user', {
    body: userData,
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
    },
  })

  if (error) {
    // functions.invoke() swallows the response body on non-2xx status.
    // error.context is a Response object — read the JSON body for the real message.
    try {
      const body = await error.context.json()
      if (body?.error) throw new Error(body.error)
    } catch (parseErr) {
      if (parseErr.message && parseErr.message !== error.message) throw parseErr
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data.user
}

// Update a user profile
export async function updateUser(userId, updates) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Format a user's display name
export function formatUserName(user) {
  if (!user) return ''
  const first = user.preferred_name || user.first_name
  return `${first} ${user.last_name}`
}
