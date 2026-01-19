import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile with role information
  const { data: profile } = await supabase
    .from('users')
    .select('primary_role, first_name, last_name')
    .eq('id', user.id)
    .single()

  // Get all roles for this user
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id)

  // Build list of all available roles
  const availableRoles = [
    profile?.primary_role,
    ...(userRoles?.map((ur: any) => ur.roles?.name) || [])
  ].filter((role, index, self) => role && self.indexOf(role) === index) // Remove duplicates and nulls

  // Get current role from cookie (set by proxy)
  const cookieStore = await cookies()
  const currentRole = cookieStore.get('current_role')?.value || profile?.primary_role || 'admin'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar 
        userEmail={user.email || ''} 
        userRole={currentRole}
        availableRoles={availableRoles as string[]}
      />
      
      {/* Main content area - offset by sidebar width using CSS variable */}
      <main className="flex-1 transition-all duration-300" style={{ marginLeft: 'var(--sidebar-width, 16rem)' }}>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
