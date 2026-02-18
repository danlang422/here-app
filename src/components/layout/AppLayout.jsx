import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FaUser, FaChalkboardTeacher, FaCog, FaSignOutAlt } from 'react-icons/fa'
import { signOut } from '../../hooks/useAuth'
import useAuthStore from '../../store/authStore'

function AppLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const roleRoutes = {
    student: '/student',
    teacher: '/teacher',
    admin: '/admin',
  }

  const isActive = (path) => location.pathname.startsWith(path)

  // Determine which role views to show based on the user's roles
  const roles = profile?.roles ?? []
  const isTeacher = roles.includes('teacher')
  const isAdmin = roles.includes('admin')
  const isStudent = roles.includes('student')

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Display name: preferred_name or first name
  const displayName = profile?.preferred_name ?? profile?.first_name ?? 'User'
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || 'U'

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <Link to="/dashboard" className="btn btn-ghost text-xl">
            Here
          </Link>
        </div>

        <div className="flex-none gap-2">
          {/* Role switcher — only show roles the user actually has */}
          {(isTeacher || isAdmin || isStudent) && (
            <div className="dropdown dropdown-end">
              <label tabIndex={0} className="btn btn-ghost gap-2">
                {isActive('/teacher') && <FaChalkboardTeacher className="w-4 h-4" />}
                {isActive('/admin') && <FaCog className="w-4 h-4" />}
                {isActive('/student') && <FaUser className="w-4 h-4" />}
                {isActive('/dashboard') && <FaUser className="w-4 h-4" />}
                <span>
                  {isActive('/teacher') ? 'Teacher'
                    : isActive('/admin') ? 'Admin'
                    : isActive('/student') ? 'Student'
                    : 'Menu'}
                </span>
              </label>
              <ul tabIndex={0} className="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52 z-50">
                {isStudent && (
                  <li>
                    <Link to={roleRoutes.student}>
                      <FaUser className="w-4 h-4" /> Student View
                    </Link>
                  </li>
                )}
                {isTeacher && (
                  <li>
                    <Link to={roleRoutes.teacher}>
                      <FaChalkboardTeacher className="w-4 h-4" /> Teacher View
                    </Link>
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <Link to={roleRoutes.admin}>
                      <FaCog className="w-4 h-4" /> Admin View
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* User menu */}
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-circle avatar placeholder">
              <div className="w-10 rounded-full bg-neutral text-neutral-content flex items-center justify-center">
                <span className="text-sm font-medium">{initials}</span>
              </div>
            </label>
            <ul tabIndex={0} className="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52 z-50">
              <li className="menu-title px-2 py-1">
                <span className="text-xs font-normal text-base-content/60">{displayName}</span>
              </li>
              <li><a>Profile</a></li>
              <li>
                <button onClick={handleLogout}>
                  <FaSignOutAlt className="w-4 h-4" /> Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="container mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  )
}

export default AppLayout
