import { Flame } from '@phosphor-icons/react'
import ActionButton from '@/components/student/ActionButton'
import {
  getCheckinButtonState,
  getWaveButtonState,
  getStatusButtonState,
} from '@/lib/actionAvailability'

function StudentActivityCard({
  activity,
  staffDisplayName,
  blockLabel,
  isToday,
  checkIn,
  wave,
  statusCount,
  hasInstance,
  streak,
  onWave,
  onStatusUpdate,
  onCheckIn,
  onCheckOut,
}) {
  // Build the block · location · staff line
  const metaParts = [blockLabel, activity.location, staffDisplayName].filter(Boolean)
  const metaLine = metaParts.join(' \u00b7 ')

  // Determine button states
  const now = new Date()
  const waveState = activity.allows_presence_wave
    ? getWaveButtonState(activity, wave, isToday, now)
    : null
  const checkinState = activity.requires_checkin
    ? getCheckinButtonState(activity, checkIn, isToday, now)
    : null
  const statusState = getStatusButtonState(hasInstance, statusCount > 0, isToday)

  // Primary button: check-in takes priority over wave
  const hasPrimary = checkinState || waveState
  const hasSecondary = statusState !== null

  // Handle check-in/check-out button click
  const handlePrimaryClick = () => {
    if (checkinState === 'available') onCheckIn?.(activity)
    else if (checkinState === 'checkout-available') onCheckOut?.(activity, checkIn)
    else if (waveState === 'available') onWave?.(activity)
  }

  const handleStatusClick = () => {
    if (statusState === 'available' || statusState === 'has-updates') {
      onStatusUpdate?.(activity)
    }
  }

  // Count action buttons to determine stacking
  const buttonCount = (hasPrimary ? 1 : 0) + (hasSecondary ? 1 : 0)

  return (
    <div className="bg-base-100 border border-base-300 rounded-lg shadow-sm overflow-visible h-full relative">
      {/* Content area */}
      <div className="p-3 pr-7 flex flex-col gap-0.5 h-full">
        {/* Row 1: title (left) + time (right) */}
        <div className="flex justify-between items-baseline gap-2">
          <span className="font-medium truncate">{activity.name}</span>
          <span className="text-sm text-base-content/60 shrink-0">
            {formatTimeRange(activity.default_start_time, activity.default_end_time)}
          </span>
        </div>

        {/* Row 2: block · location · staff */}
        {metaLine && (
          <div className="text-sm text-base-content/60 truncate">{metaLine}</div>
        )}

        {/* Streak indicator (bottom-right, conditional) */}
        {streak > 0 && (
          <div className="mt-auto flex justify-end pr-1">
            <span
              className={`inline-flex items-center gap-0.5 text-sm ${
                streak >= 5 ? 'text-base-content/70' : 'text-base-content/50'
              }`}
            >
              <Flame
                weight="fill"
                size={14}
                className={streak >= 5 ? 'text-amber-500' : ''}
              />
              {streak}
            </span>
          </div>
        )}
      </div>

      {/* Edge-overlapping action buttons */}
      {buttonCount > 0 && (
        <div
          className="absolute flex flex-col gap-1.5 items-center"
          style={{
            right: '-14px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          {hasPrimary && (
            <ActionButton
              type={checkinState ? 'checkin' : 'wave'}
              state={checkinState ?? waveState}
              onClick={handlePrimaryClick}
            />
          )}
          {hasSecondary && (
            <ActionButton
              type="status"
              state={statusState}
              onClick={handleStatusClick}
              hasUpdates={statusCount > 0}
            />
          )}
        </div>
      )}
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