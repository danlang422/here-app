import { createClient } from '@/lib/supabase/server'
import { User } from '@supabase/supabase-js'

/**
 * User profile data from the users table
 */
export interface UserProfile {
  primary_role: string | null
  first_name: string | null
  last_name: string | null
}

/**
 * User role data from the user_roles table
 */
interface UserRoleRow {
  roles: {
    name: string
  } | null
}

/**
 * Complete admin user data including authentication, profile, and roles
 */
export interface AdminUserData {
  user: User
  profile: UserProfile | null
  availableRoles: string[]
}

/**
 * Get admin user data with optimized parallel queries
 *
 * This function:
 * 1. Authenticates the user (fails fast if not authenticated)
 * 2. Fetches profile and roles data in parallel for better performance
 * 3. Builds a deduplicated list of available roles
 *
 * @returns AdminUserData object containing user, profile, and available roles
 * @throws Error if user is not authenticated
 */
export async function getAdminUserData(): Promise<AdminUserData> {
  const supabase = await createClient()

  // Step 1: Get authenticated user (fail fast if not authenticated)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('User not authenticated')
  }

  // Step 2: Fetch profile and roles in parallel for better performance
  const [profileResult, rolesResult] = await Promise.all([
    // Get user profile with role information
    supabase
      .from('users')
      .select('primary_role, first_name, last_name')
      .eq('id', user.id)
      .single(),

    // Get all roles for this user
    supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id)
  ])

  const profile = profileResult.data
  const userRoles = rolesResult.data as UserRoleRow[] | null

  // Step 3: Build deduplicated list of available roles
  // Includes primary role and all additional roles from user_roles table
  const availableRoles = [
    profile?.primary_role,
    ...(userRoles?.map(ur => ur.roles?.name) || [])
  ].filter((role, index, self) =>
    role && self.indexOf(role) === index // Remove duplicates and nulls
  ) as string[]

  return {
    user,
    profile,
    availableRoles
  }
}
