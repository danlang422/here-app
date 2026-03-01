import { Link } from 'react-router-dom'
import { FaCalendarAlt, FaTasks, FaUsers, FaChartBar } from 'react-icons/fa'

const sections = [
  {
    to: '/admin/calendar',
    icon: FaCalendarAlt,
    title: 'Calendar Management',
    description: 'Manage terms, school days, and schedule templates',
  },
  {
    to: '/admin/activities',
    icon: FaTasks,
    title: 'Activity Management',
    description: 'Create and edit activities, manage enrollments',
  },
  {
    to: '/admin/users',
    icon: FaUsers,
    title: 'User Management',
    description: 'Add and manage students and staff',
  },
  {
    to: '/admin/reports',
    icon: FaChartBar,
    title: 'Reports',
    description: 'Attendance reports and analytics',
  },
]

function Dashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Administration</h2>
      <p className="text-base-content/60 mb-6">Manage your school's schedule, activities, and users.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(({ to, icon: Icon, title, description }) => (
          <Link key={to} to={to} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
            <div className="card-body">
              <h3 className="card-title gap-2">
                <Icon className="w-5 h-5 text-primary" />
                {title}
              </h3>
              <p className="text-base-content/60">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
