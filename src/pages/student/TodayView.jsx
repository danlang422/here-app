function TodayView() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">My Schedule</h1>
      <p className="text-base-content/60 mb-6">Schedule view coming soon</p>

      <div className="grid grid-cols-1 gap-4">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Today's Activities</h2>
            <p className="text-base-content/60">Your daily schedule will appear here</p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Recent Activity</h2>
            <p className="text-base-content/60">Your check-ins and presence waves will appear here</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TodayView
