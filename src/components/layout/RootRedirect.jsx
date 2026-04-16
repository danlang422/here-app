import { Navigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import PublicLayout from '@/components/layout/PublicLayout'
import LandingPage from '@/pages/public/LandingPage'

function RootRedirect() {
  const { user, currentRole } = useAuthStore()

  // No authenticated user — show public landing page
  if (!user) {
    return <PublicLayout><LandingPage /></PublicLayout>
  }

  // Authenticated — redirect to role home
  if (currentRole === 'admin') return <Navigate to="/admin" replace />
  if (currentRole === 'teacher') return <Navigate to="/teacher" replace />
  if (currentRole === 'student') return <Navigate to="/student" replace />

  // Fallback — no valid role
  return <Navigate to="/login" replace />
}

export default RootRedirect
