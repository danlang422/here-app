import { useMemo } from 'react'
import AgendaGrid from './AgendaGrid'
import { timeToMinutes, floorToHour, ceilToHour, DEFAULT_GRID_START, DEFAULT_GRID_END } from './agendaUtils'

function AgendaView({ activities, enrollmentCountByActivity, blockCount, blockLabels }) {
  const gridBounds = useMemo(() => {
    if (activities.length === 0) {
      return { start: DEFAULT_GRID_START, end: DEFAULT_GRID_END }
    }
    const starts = activities.map((a) => a.default_start_time)
    const ends = activities.map((a) => a.default_end_time)
    const minStart = starts.reduce((a, b) => (a < b ? a : b))
    const maxEnd = ends.reduce((a, b) => (a > b ? a : b))
    return {
      start: minStart < DEFAULT_GRID_START ? floorToHour(minStart) : DEFAULT_GRID_START,
      end: maxEnd > DEFAULT_GRID_END ? ceilToHour(maxEnd) : DEFAULT_GRID_END,
    }
  }, [activities])

  const gridStartMinutes = timeToMinutes(gridBounds.start)
  const gridEndMinutes = timeToMinutes(gridBounds.end)

  if (activities.length === 0) {
    return (
      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body items-center text-center py-16">
          <p className="text-base-content/50">No scheduled activities to display.</p>
          <p className="text-sm text-base-content/40">
            Activities need start and end times to appear on the agenda.
          </p>
        </div>
      </div>
    )
  }

  return (
    <AgendaGrid
      activities={activities}
      enrollmentCountByActivity={enrollmentCountByActivity}
      gridStartMinutes={gridStartMinutes}
      gridEndMinutes={gridEndMinutes}
      blockCount={blockCount}
      blockLabels={blockLabels}
    />
  )
}

export default AgendaView
