import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { getAdminUserData } from '@/lib/auth/admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get authenticated user data with optimized parallel queries
  // This runs profile and roles queries concurrently for better performance
  let user, profile, availableRoles

  try {
    const adminData = await getAdminUserData()
    user = adminData.user
    profile = adminData.profile
    availableRoles = adminData.availableRoles
  } catch (error) {
    // User not authenticated - redirect to login
    redirect('/login')
  }

  // Get current role from cookie (set by role switcher)
  const cookieStore = await cookies()
  const currentRole = cookieStore.get('current_role')?.value || profile?.primary_role || 'admin'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar
        userEmail={user.email || ''}
        userRole={currentRole}
        availableRoles={availableRoles}
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
