'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type UserWithRoles = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  primary_role: 'student' | 'teacher' | 'admin' | 'mentor'
  created_at: string
  user_roles: {
    role_id: string
    roles: {
      id: string
      name: 'student' | 'teacher' | 'admin' | 'mentor'
    }
  }[]
}

export type Role = {
  id: string
  name: 'student' | 'teacher' | 'admin' | 'mentor'
  description: string | null
}

type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string }

/**
 * Fetch all users with their assigned roles
 */
export async function getUsers(): Promise<ActionResult<UserWithRoles[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        user_roles (
          role_id,
          roles (
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as UserWithRoles[] }
  } catch (error) {
    console.error('Error in getUsers:', error)
    return { success: false, error: 'Failed to fetch users' }
  }
}

/**
 * Fetch all available roles
 */
export async function getRoles(): Promise<ActionResult<Role[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching roles:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as Role[] }
  } catch (error) {
    console.error('Error in getRoles:', error)
    return { success: false, error: 'Failed to fetch roles' }
  }
}

/**
 * Create a new user with initial password and assign roles
 */
export async function createUser(formData: {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
  primary_role: 'student' | 'teacher' | 'admin' | 'mentor'
  role_ids: string[] // Array of role IDs to assign
}): Promise<ActionResult<string>> {
  try {
    const adminClient = createAdminClient()
    const supabase = await createClient()

    // 1. Create auth user (requires admin client with service role key)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: formData.email,
      password: formData.password,
      email_confirm: true, // Auto-confirm email
    })

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError)
      return { success: false, error: authError?.message || 'Failed to create user account' }
    }

    // 2. Update user profile (trigger already created a basic profile, we'll update it)
    const { error: profileError } = await supabase
      .from('users')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || null,
        primary_role: formData.primary_role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.error('Error updating user profile:', profileError)
      return { success: false, error: profileError.message }
    }

    // 3. Update roles (trigger already assigned student role, we'll replace with desired roles)
    // First, delete existing role assignments (the trigger created a student role)
    const { error: deleteRolesError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', authData.user.id)

    if (deleteRolesError) {
      console.error('Error deleting auto-assigned roles:', deleteRolesError)
      // Continue anyway - we'll try to insert the new roles
    }

    // Now insert the desired roles
    const roleInserts = formData.role_ids.map(role_id => ({
      user_id: authData.user.id,
      role_id,
    }))

    const { error: rolesError } = await supabase
      .from('user_roles')
      .insert(roleInserts)

    if (rolesError) {
      console.error('Error assigning roles:', rolesError)
      return { success: false, error: rolesError.message }
    }

    revalidatePath('/admin/users')
    return { success: true, data: authData.user.id }
  } catch (error) {
    console.error('Error in createUser:', error)
    return { success: false, error: 'Failed to create user' }
  }
}

/**
 * Update user profile and roles
 */
export async function updateUser(
  userId: string,
  formData: {
    first_name: string
    last_name: string
    phone?: string
    primary_role: 'student' | 'teacher' | 'admin' | 'mentor'
    role_ids: string[]
  }
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // 1. Update user profile
    const { error: profileError } = await supabase
      .from('users')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || null,
        primary_role: formData.primary_role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating user profile:', profileError)
      return { success: false, error: profileError.message }
    }

    // 2. Update roles - delete all existing and insert new ones
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting old roles:', deleteError)
      return { success: false, error: deleteError.message }
    }

    const roleInserts = formData.role_ids.map(role_id => ({
      user_id: userId,
      role_id,
    }))

    const { error: rolesError } = await supabase
      .from('user_roles')
      .insert(roleInserts)

    if (rolesError) {
      console.error('Error assigning new roles:', rolesError)
      return { success: false, error: rolesError.message }
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error in updateUser:', error)
    return { success: false, error: 'Failed to update user' }
  }
}

/**
 * Send password reset email to user
 */
export async function resetUserPassword(email: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
    })

    if (error) {
      console.error('Error sending password reset:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in resetUserPassword:', error)
    return { success: false, error: 'Failed to send password reset email' }
  }
}

/**
 * Delete a user (hard delete - removes from auth and database)
 */
export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const adminClient = createAdminClient()
    const supabase = await createClient()

    // Delete from auth (this will cascade to user_roles via RLS/triggers)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      return { success: false, error: authError.message }
    }

    // Delete user profile (should cascade to user_roles)
    const { error: profileError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Error deleting user profile:', profileError)
      // Auth user is deleted but profile remains - log but continue
    }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error in deleteUser:', error)
    return { success: false, error: 'Failed to delete user' }
  }
}
