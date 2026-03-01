import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '@/store/authStore'

// Wraps protected routes. Redirects to /login if not authenticated.
// If requiredRole is specified, redirects to /unauthorized if the
// user's current role doesn't match.
function ProtectedRoute({ children, requiredRole }) {
  const { user, currentRole } = useAuthStore()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole && currentRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
