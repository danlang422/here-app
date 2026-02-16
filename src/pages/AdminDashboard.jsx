import AppLayout from '../components/layout/AppLayout'

function AdminDashboard() {
  return (
    <AppLayout currentRole="admin">
      <div>
        <h1 className="text-3xl font-bold mb-2">Administration</h1>
        <p className="text-gray-600 mb-6">Management tools coming soon</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Calendar Management</h2>
              <p className="text-gray-600">Manage school days and rotation schedules</p>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Session Management</h2>
              <p className="text-gray-600">Create and edit sessions</p>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">User Management</h2>
              <p className="text-gray-600">Add and manage students and staff</p>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Reports</h2>
              <p className="text-gray-600">Attendance reports and analytics</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default AdminDashboard
