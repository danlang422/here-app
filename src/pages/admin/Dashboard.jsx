function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Administration</h1>
      <p className="text-base-content/60 mb-6">Management tools coming soon</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Calendar Management</h2>
            <p className="text-base-content/60">Manage terms, school days, and rotation schedules</p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Activity Management</h2>
            <p className="text-base-content/60">Create and edit activities, manage enrollments</p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">User Management</h2>
            <p className="text-base-content/60">Add and manage students and staff</p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Reports</h2>
            <p className="text-base-content/60">Attendance reports and analytics</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
