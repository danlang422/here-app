'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Switch the user's current active role
 * Validates that the user actually has the role they're trying to switch to
 */
export async function switchRole(newRole: string) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  // Get user's profile and all roles
  const { data: profile } = await supabase
    .from('users')
    .select('primary_role')
    .eq('id', user.id)
    .single()

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id)

  // Build list of all roles user has
  const allRoles = [
    profile?.primary_role,
    ...(userRoles?.map((ur: any) => ur.roles?.name) || [])
  ].filter(Boolean)

  // Validate that user has the role they're trying to switch to
  if (!allRoles.includes(newRole)) {
    return { error: 'You do not have access to that role' }
  }

  // Set the new role in cookie
  const cookieStore = await cookies()
  cookieStore.set('current_role', newRole, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  })

  // Redirect to appropriate dashboard for the new role
  const roleRedirects: Record<string, string> = {
    admin: '/admin/dashboard',
    teacher: '/teacher/dashboard',
    student: '/student/agenda',
    mentor: '/mentor/dashboard',
  }

  const redirectUrl = roleRedirects[newRole] || '/admin/dashboard'
  redirect(redirectUrl)
}
