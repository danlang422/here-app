import { MdOutlineMyLocation } from 'react-icons/md'
import { LuListTodo } from 'react-icons/lu'
import CardActions from './CardActions'

function StudentActivityCard({ activity, staffDisplayName, blockLabel }) {
  // Build the time · block · location line
  const timeRange = formatTimeRange(activity.default_start_time, activity.default_end_time)
  const metaParts = [timeRange, blockLabel, activity.location].filter(Boolean)
  const metaLine = metaParts.join(' \u00b7 ')

  // Property icons (informational)
  const showGeofence = activity.requires_geofence
  const showFreeform = activity.allows_freeform
  const hasPropertyIcons = showGeofence || showFreeform

  return (
    <div className="bg-base-100 border border-base-300 rounded-lg shadow-sm overflow-hidden flex h-full">
      {/* Content area */}
      <div className="p-3 flex flex-col gap-0.5 flex-1 min-w-0">
        {/* Row 1: Activity name */}
        <div className="font-medium truncate">{activity.name}</div>

        {/* Row 2: Staff display name */}
        {staffDisplayName && (
          <div className="text-sm text-base-content/70 truncate">
            {staffDisplayName}
          </div>
        )}

        {/* Row 3: Time · Block · Location */}
        {metaLine && (
          <div className="text-sm text-base-content/60 truncate">{metaLine}</div>
        )}

        {/* Row 4: Property icons */}
        {hasPropertyIcons && (
          <div className="flex gap-1.5 mt-0.5">
            {showGeofence && (
              <MdOutlineMyLocation
                size={15}
                className="text-base-content/40"
                title="Geofence check-in"
              />
            )}
            {showFreeform && (
              <LuListTodo
                size={15}
                className="text-base-content/40"
                title="Freeform activity"
              />
            )}
          </div>
        )}
      </div>

      {/* Action strip */}
      <CardActions
        requiresCheckin={activity.requires_checkin}
        allowsPresenceWave={activity.allows_presence_wave}
        hasInstance={true}
      />
    </div>
  )
}

// Format "HH:MM" times into "7:30a – 9:00a" display format
function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return null
  return `${formatTime(startTime)} – ${formatTime(endTime)}`
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'p' : 'a'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

export default StudentActivityCard
