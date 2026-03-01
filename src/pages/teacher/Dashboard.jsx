function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">My Activities</h1>
      <p className="text-base-content/60 mb-6">Activity rosters coming soon</p>

      <div className="grid grid-cols-1 gap-4">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Current Block</h2>
            <p className="text-base-content/60">Active roster will appear here</p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Today's Activities</h2>
            <p className="text-base-content/60">Your full daily schedule will appear here</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
