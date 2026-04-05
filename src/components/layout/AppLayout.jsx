import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Backpack, ChalkboardTeacher, UserGear, SignOut, Question } from '@phosphor-icons/react'
import { signOut } from '@/api/auth'
import useAuthStore from '@/store/authStore'
import { getDisplayName, getInitials } from '@/lib/utils'

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
  const CurrentRoleIcon = roleIcons[currentRole] || Backpack

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
          {/* Help link */}
          <Link to="/help" className="btn btn-ghost btn-circle" aria-label="Help">
            <Question size={20} />
          </Link>

          {/* Role switcher — only show if user has multiple roles */}
          {availableRoles.length > 1 && (
            <div className="dropdown dropdown-end">
              <label tabIndex={0} className="btn btn-ghost gap-2">
                <CurrentRoleIcon size={16} />
                <span>{roleLabels[currentRole] || 'Menu'}</span>
              </label>
              <ul tabIndex={0} className="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52 z-50">
                {availableRoles.map(role => {
                  const Icon = roleIcons[role]
                  return (
                    <li key={role}>
                      <button
                        onClick={() => handleRoleSwitch(role)}
                        className={role === currentRole ? 'active' : ''}
                      >
                        <Icon size={16} /> {roleLabels[role]} View
                      </button>
                    </li>
                  )
                })}
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
    </div>
  )
}

export default AppLayout
