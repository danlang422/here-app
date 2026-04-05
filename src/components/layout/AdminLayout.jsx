import { Outlet, NavLink } from 'react-router-dom'
import { SquaresFour, CalendarBlank, CardsThree, Users, ChartBar, Gear } from '@phosphor-icons/react'

const adminNav = [
  { to: '/admin', icon: SquaresFour, label: 'Dashboard', end: true },
  { to: '/admin/calendar', icon: CalendarBlank, label: 'Calendar' },
  { to: '/admin/activities', icon: CardsThree, label: 'Activities' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/reports', icon: ChartBar, label: 'Reports' },
  { to: '/admin/settings', icon: Gear, label: 'Settings' },
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
              `tab gap-1.5 text-[13px] font-medium ${isActive ? 'tab-active' : 'text-base-content/60 hover:text-base-content'}`
            }
          >
            <Icon size={15} />
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
