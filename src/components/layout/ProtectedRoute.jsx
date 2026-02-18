import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

// Wraps protected routes. Redirects to /login if there's no active session,
// preserving the intended destination so we can redirect back after login.
function ProtectedRoute({ children }) {
  const { user } = useAuthStore()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
