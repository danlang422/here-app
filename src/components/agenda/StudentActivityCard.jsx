import { Flame } from '@phosphor-icons/react'
import { getDevNow } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production
import ActionButton from '@/components/student/ActionButton'
import {
  getCheckinButtonState,
  getWaveButtonState,
  getStatusButtonState,
} from '@/lib/actionAvailability'
import { formatTimeRange } from './agendaUtils'

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
  calendarColor,
}) {
  // Build the block · location · staff line
  const metaParts = [blockLabel, activity.location, staffDisplayName].filter(Boolean)
  const metaLine = metaParts.join(' \u00b7 ')

  // Determine button states
  const now = getDevNow() // DEV OVERRIDE
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
    <div
      className="bg-base-100 border border-base-300 border-l-4 rounded-2xl shadow-sm overflow-visible h-full relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      style={calendarColor ? { borderLeftColor: calendarColor } : undefined}
    >
      {/* Content area */}
      <div className="p-3 pr-7 flex flex-col gap-0.5 h-full">
        {/* Row 1: title (left) + time (right) */}
        <div className="flex justify-between items-baseline gap-2">
          <span className="font-medium truncate">{activity.name}</span>
          <span className="text-sm text-base-content/60 shrink-0">
            {formatTimeRange(activity.default_start_time, activity.default_end_time)}
          </span>
        </div>

        {/* Row 2: block · location · staff [· 🔥 streak] */}
        {(metaLine || streak > 0) && (
          <div className="flex items-center gap-1 text-sm text-base-content/60">
            {metaLine && <span className="truncate">{metaLine}</span>}
            {streak > 0 && (
              <span className={`inline-flex items-center gap-0.5 shrink-0 ${streak >= 5 ? 'text-amber-500' : 'text-base-content/40'}`}>
                <Flame weight="fill" size={13} />
                <span className="text-xs">{streak}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Edge-overlapping action buttons */}
      {buttonCount > 0 && (
        <div
          className="absolute flex flex-col gap-1.5 items-center"
          style={{
            right: '-18px',
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

export default StudentActivityCard
