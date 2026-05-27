import { X, Flame } from '@phosphor-icons/react'
import { getDevNow } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production
import ActionButton from '@/components/student/ActionButton'
import {
  getCheckinButtonState,
  getWaveButtonState,
  getStatusButtonState,
} from '@/lib/actionAvailability'
import { formatTimeRange } from '@/components/agenda/agendaUtils'

function SheetContent({
  activity,
  blockLabel,
  staffDisplayName,
  checkIn,
  wave,
  statusCount,
  hasInstance,
  streak,
  isToday,
  onWave,
  onStatusUpdate,
  onCheckIn,
  onCheckOut,
  onClose,
}) {
  const now = getDevNow() // DEV OVERRIDE
  const waveState = activity.allows_presence_wave
    ? getWaveButtonState(activity, wave, isToday, now)
    : null
  const checkinState = activity.requires_checkin
    ? getCheckinButtonState(activity, checkIn, isToday, now)
    : null
  const statusState = getStatusButtonState(hasInstance, statusCount > 0, isToday)

  const hasPrimary = checkinState || waveState
  const hasSecondary = statusState !== null

  const primaryLabel =
    checkinState === 'checkout-available' ? 'Check Out'
    : checkinState === 'checked-in' ? 'Checked In'
    : checkinState === 'checked-out' ? 'Checked Out'
    : checkinState ? 'Check In'
    : waveState === 'completed' ? 'Waved'
    : 'Wave'

  const handlePrimaryClick = () => {
    onClose()
    if (checkinState === 'available') onCheckIn?.(activity)
    else if (checkinState === 'checkout-available') onCheckOut?.(activity, checkIn)
    else if (waveState === 'available') onWave?.(activity)
  }

  const handleStatusClick = () => {
    if (statusState === 'available' || statusState === 'has-updates') {
      onClose()
      onStatusUpdate?.(activity)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold leading-snug">{activity.name}</h2>
        <button className="btn btn-ghost btn-circle btn-sm shrink-0" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-1 text-sm text-base-content/70 mb-4">
        <span>{formatTimeRange(activity.default_start_time, activity.default_end_time)}</span>
        {blockLabel && <span>{blockLabel}</span>}
        {activity.location && <span>{activity.location}</span>}
        {staffDisplayName && <span>{staffDisplayName}</span>}
        {activity.calendar?.color && (
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: activity.calendar.color }}
            />
            {activity.calendar.name && <span>{activity.calendar.name}</span>}
          </span>
        )}
      </div>

      {/* Action buttons */}
      {(hasPrimary || hasSecondary) && (
        <div className="flex gap-3 mb-4">
          {hasPrimary && (
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <ActionButton
                type={checkinState ? 'checkin' : 'wave'}
                state={checkinState ?? waveState}
                onClick={handlePrimaryClick}
              />
              <span className="text-xs text-base-content/60">{primaryLabel}</span>
            </div>
          )}
          {hasSecondary && (
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <ActionButton
                type="status"
                state={statusState}
                onClick={handleStatusClick}
                hasUpdates={statusCount > 0}
              />
              <span className="text-xs text-base-content/60">Status Update</span>
            </div>
          )}
        </div>
      )}

      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-1 text-sm text-base-content/60">
          <Flame
            weight="fill"
            size={14}
            className={streak >= 5 ? 'text-amber-500' : 'text-base-content/40'}
          />
          <span>{streak}-day streak</span>
        </div>
      )}
    </div>
  )
}

function ActivityDetailSheet({ isOpen, onClose, ...props }) {
  if (!isOpen || !props.activity) return null

  return (
    <>
      {/* Mobile: bottom sheet — slides up from bottom */}
      <div className="sm:hidden fixed inset-0 z-50" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40" />
        <div
          className="absolute inset-x-0 bottom-0 bg-base-100 rounded-t-2xl max-h-[85vh] overflow-y-auto p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <SheetContent {...props} onClose={onClose} />
        </div>
      </div>

      {/* Desktop: centered modal */}
      <div
        className="hidden sm:flex fixed inset-0 z-50 items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div
          className="relative bg-base-100 rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <SheetContent {...props} onClose={onClose} />
        </div>
      </div>
    </>
  )
}

export default ActivityDetailSheet
