import { useAuthListener } from '../../hooks/useAuth'
import useAuthStore from '../../store/authStore'

// Initializes the auth listener and shows a loading screen while the
// initial session check is in flight. This prevents a flash of the
// login page on refresh when the user is already authenticated.
function AuthProvider({ children }) {
  useAuthListener()

  const loading = useAuthStore((state) => state.loading)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    )
  }

  return children
}

export default AuthProvider
