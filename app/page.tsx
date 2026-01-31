import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's primary role and redirect to appropriate homepage
  const { data: profile } = await supabase
    .from('users')
    .select('primary_role')
    .eq('id', user.id)
    .single()

  const roleRedirects: Record<string, string> = {
    admin: '/admin/dashboard',
    teacher: '/teacher/agenda',
    student: '/student/agenda',
    mentor: '/student/agenda', // TODO: Create mentor homepage
  }

  const redirectUrl = roleRedirects[profile?.primary_role || 'student'] || '/student/agenda'
  redirect(redirectUrl)
}
