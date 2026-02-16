import AppLayout from '../components/layout/AppLayout'

function DashboardPage() {
  return (
    <AppLayout>
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold mb-4">Welcome to Here App</h1>
        <p className="text-lg text-gray-600 mb-8">
          Select a role from the menu to get started
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Student View</h2>
              <p>View your schedule, check in to activities, and track attendance.</p>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Teacher View</h2>
              <p>Manage sessions, take attendance, and monitor student engagement.</p>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Admin View</h2>
              <p>Configure calendar, create sessions, and manage users.</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default DashboardPage
