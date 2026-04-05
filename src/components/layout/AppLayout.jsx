import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Backpack, ChalkboardTeacher, UserGear, SignOut, Question } from '@phosphor-icons/react'
import { signOut } from '@/api/auth'
import useAuthStore from '@/store/authStore'
import { getDisplayName, getInitials } from '@/lib/utils'
import { Toast } from '@/components/ui/Toast'

function AppLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, currentRole, availableRoles, setCurrentRole } = useAuthStore()

  const roleRoutes = {
    student: '/student',
    teacher: '/teacher',
    admin: '/admin',
  }

  const roleIcons = {
    student: Backpack,
    teacher: ChalkboardTeacher,
    admin: UserGear,
  }

  const roleLabels = {
    student: 'Student',
    teacher: 'Teacher',
    admin: 'Admin',
  }

  function handleRoleSwitch(role) {
    setCurrentRole(role)
    navigate(roleRoutes[role], { replace: true })
  }

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const displayName = getDisplayName(profile)
  const initials = getInitials(profile)

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <Link to="/dashboard" className="here-wordmark">Here</Link>
        </div>

        <div className="flex-none gap-2">
          {/* Help link */}
          <Link to="/help" className="btn btn-ghost btn-circle" aria-label="Help">
            <Question size={20} />
          </Link>

          {/* Role switcher — inline pills when multiple roles */}
          {availableRoles.length > 1 && (
            <div className="flex items-center gap-1 bg-base-200 rounded-xl p-1">
              {availableRoles.map(role => {
                const Icon = roleIcons[role]
                const isActive = role === currentRole
                return (
                  <button
                    key={role}
                    onClick={() => handleRoleSwitch(role)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-base-100 text-base-content shadow-sm'
                        : 'text-base-content/50 hover:text-base-content/80'
                    }`}
                  >
                    <Icon size={14} />
                    {roleLabels[role]}
                  </button>
                )
              })}
            </div>
          )}

          {/* User menu */}
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-square avatar placeholder">
              <div
                className="w-10 rounded-xl flex items-center justify-center text-white"
                style={{
                  background: 'linear-gradient(135deg, oklch(62.31% 0.1881 259.82), oklch(60.56% 0.219 292.72))',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {initials}
              </div>
            </label>
            <ul tabIndex={0} className="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52 z-50">
              <li className="menu-title px-2 py-1">
                <span className="text-xs font-normal text-base-content/60">{displayName}</span>
              </li>
              <li>
                <Link to="/account">Account</Link>
              </li>
              <li>
                <button onClick={handleLogout}>
                  <SignOut size={16} /> Logout
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

      <Toast />
    </div>
  )
}

export default AppLayout
