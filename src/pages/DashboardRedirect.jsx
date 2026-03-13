import { Navigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'

function DashboardRedirect() {
  const { currentRole, loading } = useAuthStore()

  // Profile hasn't loaded yet — wait rather than redirecting to /login
  if (!currentRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    )
  }

  const roleRoutes = {
    student: '/student',
    teacher: '/teacher',
    admin: '/admin',
  }

  const target = roleRoutes[currentRole] || '/login'
  return <Navigate to={target} replace />
}

export default DashboardRedirect