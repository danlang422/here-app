import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function proxy(request: NextRequest) {
  const supabase = await createClient()
  const response = NextResponse.next()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/reset-password', '/auth/update-password']
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // If user is not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If user is authenticated and trying to access auth pages, redirect based on role
  if (user && isPublicRoute) {
    // Get user profile to determine their role
    const { data: profile } = await supabase
      .from('users')
      .select('primary_role')
      .eq('id', user.id)
      .single()

    // Get current role from cookie, default to primary_role
    const currentRole = request.cookies.get('current_role')?.value || profile?.primary_role || 'student'

    // Redirect to appropriate dashboard based on current role
    const roleRedirects: Record<string, string> = {
      admin: '/admin/dashboard',
      teacher: '/teacher/dashboard',
      student: '/student/agenda',
      mentor: '/mentor/dashboard',
    }

    const redirectUrl = roleRedirects[currentRole] || '/admin/dashboard'
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }

  // For authenticated users accessing protected routes, verify role access
  if (user && !isPublicRoute) {
    // Get user profile and their roles
    const { data: profile } = await supabase
      .from('users')
      .select('primary_role')
      .eq('id', user.id)
      .single()

    // Get all roles for this user
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id)

    const allRoles = [
      profile?.primary_role,
      ...(userRoles?.map((ur: any) => ur.roles?.name) || [])
    ].filter(Boolean)

    // Get current role from cookie, default to primary_role
    const currentRole = request.cookies.get('current_role')?.value || profile?.primary_role

    // Check if user is trying to access a role-specific route
    const path = request.nextUrl.pathname
    const roleFromPath = path.split('/')[1] // Extract role from /role/...

    // If path starts with a role and user doesn't have that role, redirect
    if (['admin', 'teacher', 'student', 'mentor'].includes(roleFromPath)) {
      if (!allRoles.includes(roleFromPath)) {
        // User doesn't have this role, redirect to their current role's dashboard
        const roleRedirects: Record<string, string> = {
          admin: '/admin/dashboard',
          teacher: '/teacher/dashboard',
          student: '/student/agenda',
          mentor: '/mentor/dashboard',
        }
        const redirectUrl = roleRedirects[currentRole as string] || '/admin/dashboard'
        return NextResponse.redirect(new URL(redirectUrl, request.url))
      }
    }

    // Set current_role cookie if not already set or if accessing different role path
    if (!currentRole || (roleFromPath && currentRole !== roleFromPath && allRoles.includes(roleFromPath))) {
      response.cookies.set('current_role', roleFromPath || currentRole || profile?.primary_role || 'student', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      })
    }
  }

  return response
}

// Specify which routes this proxy should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
