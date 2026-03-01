import { Outlet, NavLink } from 'react-router-dom'
import { FaCalendarAlt, FaTasks, FaUsers, FaChartBar, FaTachometerAlt } from 'react-icons/fa'

const adminNav = [
  { to: '/admin', icon: FaTachometerAlt, label: 'Dashboard', end: true },
  { to: '/admin/calendar', icon: FaCalendarAlt, label: 'Calendar' },
  { to: '/admin/activities', icon: FaTasks, label: 'Activities' },
  { to: '/admin/users', icon: FaUsers, label: 'Users' },
  { to: '/admin/reports', icon: FaChartBar, label: 'Reports' },
]

function AdminLayout() {
  return (
    <div>
      {/* Admin sub-navigation */}
      <div className="tabs tabs-bordered mb-6">
        {adminNav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `tab gap-2 ${isActive ? 'tab-active' : ''}`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Child route content */}
      <Outlet />
    </div>
  )
}

export default AdminLayout
