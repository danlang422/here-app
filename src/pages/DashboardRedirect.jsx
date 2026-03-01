import { Navigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'

// Role-based redirect hub. Sends authenticated users to the
// appropriate view based on their current role.
function DashboardRedirect() {
  const { currentRole } = useAuthStore()

  const roleRoutes = {
    student: '/student',
    teacher: '/teacher',
    admin: '/admin',
  }

  const target = roleRoutes[currentRole] || '/login'
  return <Navigate to={target} replace />
}

export default DashboardRedirect
