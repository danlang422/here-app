import { getBlockLabel } from '@/lib/constants'
import { FaChevronRight } from 'react-icons/fa'

/**
 * ActivityTable — displays a list of activities. Rows are clickable.
 *
 * Props:
 *   activities       - array of activity objects
 *   loading          - boolean, show loading state
 *   onSelect         - called with activity object when row is clicked
 *   enrollmentCounts - Map<activity_id, count> of active enrollment counts
 */
export default function ActivityTable({ activities = [], loading = false, onSelect, enrollmentCounts = new Map(), blockLabels }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/50">
        <p className="text-lg mb-1">No activities yet</p>
        <p className="text-sm">Create your first activity to get started.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Name</th>
            <th>Staff</th>
            <th>Block</th>
            <th>Days / Rotation</th>
            <th>Time</th>
            <th>Location</th>
            <th className="text-right">Enrolled</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => {
            const count = enrollmentCounts.get(activity.id)
            return (
              <tr
                key={activity.id}
                className="hover cursor-pointer"
                onClick={() => onSelect?.(activity)}
              >
                <td className="font-medium">{activity.name}</td>
                <td>
                  <StaffDisplay activity={activity} />
                </td>
                <td>
                  {activity.block != null
                    ? getBlockLabel(activity.block, blockLabels)
                    : <span className="text-base-content/40">—</span>
                  }
                </td>
                <td>
                  <DaysDisplay activity={activity} />
                </td>
                <td>
                  <TimeDisplay activity={activity} />
                </td>
                <td className="text-base-content/60">
                  {activity.location || <span className="text-base-content/30">—</span>}
                </td>
                <td className="text-right text-base-content/60 tabular-nums">
                  {count > 0 ? count : <span className="text-base-content/30">—</span>}
                </td>
                <td className="w-4 text-base-content/30">
                  <FaChevronRight size={10} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Compact display of days_of_week or rotation_day_type */
function DaysDisplay({ activity }) {
  if (activity.is_not_scheduled) {
    return <span className="text-base-content/40 italic text-xs">Not scheduled</span>
  }

  if (activity.rotation_day_type) {
    return <span className="badge badge-outline badge-xs">{activity.rotation_day_type} Day</span>
  }

  if (activity.days_of_week && activity.days_of_week.length > 0) {
    const dayLabels = { 1: 'M', 2: 'Tu', 3: 'W', 4: 'Th', 5: 'F', 0: 'Su', 6: 'Sa' }
    const display = activity.days_of_week.map((d) => dayLabels[d] || d).join(' ')
    return <span className="text-sm">{display}</span>
  }

  return <span className="text-base-content/40">—</span>
}

/** Compact staff display — shows primary staff member with +N for additional */
function StaffDisplay({ activity }) {
  const staffList = []

  if (activity.teacher) {
    staffList.push(`${activity.teacher.last_name}, ${activity.teacher.first_name?.charAt(0)}.`)
  }
  if (activity.monitor) {
    staffList.push(`${activity.monitor.last_name}, ${activity.monitor.first_name?.charAt(0)}.`)
  }
  if (activity.instructor_name) {
    staffList.push(activity.instructor_name)
  }
  if (activity.mentor_name) {
    staffList.push(activity.mentor_name)
  }

  if (staffList.length === 0) {
    return <span className="text-base-content/40">—</span>
  }

  const extra = staffList.length - 1

  return (
    <span className="text-sm">
      {staffList[0]}
      {extra > 0 && (
        <span className="text-base-content/50 ml-1">+{extra}</span>
      )}
    </span>
  )
}

/** Compact time range display */
function TimeDisplay({ activity }) {
  if (activity.is_not_scheduled || (!activity.default_start_time && !activity.default_end_time)) {
    return <span className="text-base-content/40">—</span>
  }

  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'p' : 'a'
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour12}:${String(m).padStart(2, '0')}${period}`
  }

  return (
    <span className="text-sm">
      {formatTime(activity.default_start_time)}–{formatTime(activity.default_end_time)}
    </span>
  )
}
