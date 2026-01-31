import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import StudentSidebar from '@/components/student/StudentSidebar'
import { createClient } from '@/lib/supabase/server'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // Get user profile and roles in parallel
  const [profileResult, rolesResult] = await Promise.all([
    supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_roles')
      .select('role_id, roles(name)')
      .eq('user_id', user.id)
  ])

  const profile = profileResult.data
  const userRoles = rolesResult.data?.map(ur => (ur.roles as any).name) || []

  // Verify user has student role
  const hasStudentAccess = userRoles.includes('student') || userRoles.includes('admin')
  
  if (!hasStudentAccess) {
    // Redirect to appropriate page based on their actual role
    if (userRoles.includes('teacher')) {
      redirect('/teacher/agenda')
    } else if (userRoles.includes('admin')) {
      redirect('/admin/dashboard')
    } else {
      redirect('/login')
    }
  }

  // Get current role from cookie (set by role switcher)
  const cookieStore = await cookies()
  const currentRole = cookieStore.get('current_role')?.value || profile?.primary_role || 'student'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <StudentSidebar
        userEmail={user.email || ''}
        userRole={currentRole}
        availableRoles={userRoles}
      />
      
      {/* Main content area - offset by sidebar width, no padding (pages handle their own spacing) */}
      <main className="flex-1 transition-all duration-300" style={{ marginLeft: 'var(--sidebar-width, 16rem)' }}>
        {children}
      </main>
    </div>
  )
}
