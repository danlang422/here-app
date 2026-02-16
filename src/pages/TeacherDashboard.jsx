import AppLayout from '../components/layout/AppLayout'

function TeacherDashboard() {
  return (
    <AppLayout currentRole="teacher">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Sessions</h1>
        <p className="text-gray-600 mb-6">Session rosters coming soon</p>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Current Session</h2>
              <p className="text-gray-600">Active session roster will appear here</p>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Today's Sessions</h2>
              <p className="text-gray-600">Your full daily schedule will appear here</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default TeacherDashboard
