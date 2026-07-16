import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '@/store/authStore'

// Wraps protected routes. Redirects to /login if not authenticated.
// If requiredRole is specified, redirects to /unauthorized if the
// user's current role doesn't match.
function ProtectedRoute({ children, requiredRole }) {
  const { user, currentRole, passwordSetupPending } = useAuthStore()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // A recovery/invite session must complete password setup before reaching
  // any other route — checked on every render (not just once, on the
  // initiating auth event) so navigating away from /reset-password doesn't
  // grant standing access. See needsPasswordSetup in src/lib/authUtils.js.
  if (passwordSetupPending) {
    return <Navigate to="/reset-password" replace />
  }

  if (requiredRole && currentRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
