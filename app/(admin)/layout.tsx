import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

  // TODO: Fetch organization name from organizations table
  // For now, hardcoded as "People"
  const organizationName = 'People'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar 
        userEmail={user.email || ''} 
        userRole={profile?.primary_role || 'user'}
        organizationName={organizationName}
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
