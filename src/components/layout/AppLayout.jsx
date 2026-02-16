import { Link, useLocation } from 'react-router-dom'
import { FaUser, FaChalkboardTeacher, FaCog, FaSignOutAlt } from 'react-icons/fa'

function AppLayout({ children, currentRole = 'student' }) {
  const location = useLocation()
  
  const roleRoutes = {
    student: '/student',
    teacher: '/teacher',
    admin: '/admin'
  }
  
  const isActive = (path) => location.pathname.startsWith(path)
  
  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <Link to="/dashboard" className="btn btn-ghost text-xl">
            Here App
          </Link>
        </div>
        
        <div className="flex-none gap-2">
          {/* Role switcher */}
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost gap-2">
              {currentRole === 'student' && <FaUser className="w-4 h-4" />}
              {currentRole === 'teacher' && <FaChalkboardTeacher className="w-4 h-4" />}
              {currentRole === 'admin' && <FaCog className="w-4 h-4" />}
              <span className="capitalize">{currentRole}</span>
            </label>
            <ul tabIndex={0} className="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
              <li>
                <Link to={roleRoutes.student}>
                  <FaUser className="w-4 h-4" /> Student View
                </Link>
              </li>
              <li>
                <Link to={roleRoutes.teacher}>
                  <FaChalkboardTeacher className="w-4 h-4" /> Teacher View
                </Link>
              </li>
              <li>
                <Link to={roleRoutes.admin}>
                  <FaCog className="w-4 h-4" /> Admin View
                </Link>
              </li>
            </ul>
          </div>
          
          {/* User menu */}
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full bg-neutral text-neutral-content flex items-center justify-center">
                <span className="text-lg">U</span>
              </div>
            </label>
            <ul tabIndex={0} className="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
              <li><a>Profile</a></li>
              <li><a>Settings</a></li>
              <li>
                <a>
                  <FaSignOutAlt className="w-4 h-4" /> Logout
                </a>
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
