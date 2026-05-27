import { Flame, ListChecks } from '@phosphor-icons/react'
import {
  NumberSquareZero, NumberSquareOne, NumberSquareTwo, NumberSquareThree,
  NumberSquareFour, NumberSquareFive, NumberSquareSix, NumberSquareSeven,
  NumberSquareEight, NumberSquareNine,
} from '@phosphor-icons/react'
import { getDevNow } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production
import ActionButton from '@/components/student/ActionButton'
import {
  getCheckinButtonState,
  getWaveButtonState,
  getStatusButtonState,
} from '@/lib/actionAvailability'
import { formatTimeRange } from './agendaUtils'

const BLOCK_SQUARE_ICONS = [
  NumberSquareZero, NumberSquareOne, NumberSquareTwo, NumberSquareThree,
  NumberSquareFour, NumberSquareFive, NumberSquareSix, NumberSquareSeven,
  NumberSquareEight, NumberSquareNine,
]

function StudentActivityCard({
  activity,
  staffDisplayName,
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
  onTap,
}) {
  // Line 3: prefer location, fall back to staffDisplayName
  const locationLine = activity.location || staffDisplayName || null

  // Determine button states
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
  const buttonCount = (hasPrimary ? 1 : 0) + (hasSecondary ? 1 : 0)

  const handlePrimaryClick = (e) => {
    e.stopPropagation()
    if (checkinState === 'available') onCheckIn?.(activity)
    else if (checkinState === 'checkout-available') onCheckOut?.(activity, checkIn)
    else if (waveState === 'available') onWave?.(activity)
  }

  const handleStatusClick = (e) => {
    e.stopPropagation()
    if (statusState === 'available' || statusState === 'has-updates') {
      onStatusUpdate?.(activity)
    }
  }

  const buttons = (
    <>
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
    </>
  )

  const hasFooter = (activity.block?.length > 0) || streak > 0 || activity.allows_freeform

  return (
    <div
      className="bg-base-100 border border-base-300 border-l-4 rounded-2xl shadow-sm overflow-visible h-full relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] cursor-pointer"
      style={calendarColor ? { borderLeftColor: calendarColor } : undefined}
      onClick={onTap}
    >
      {/* Content area */}
      <div className="p-3 pr-3 sm:pr-7 flex flex-col gap-0.5 h-full">
        {/* Line 1: Title — wraps, no truncation */}
        <span className="font-medium leading-snug">{activity.name}</span>

        {/* Line 2: Time range */}
        <span className="text-sm text-base-content/60">
          {formatTimeRange(activity.default_start_time, activity.default_end_time)}
        </span>

        {/* Line 3: Location or staff */}
        {locationLine && (
          <span className="text-sm text-base-content/60 truncate">{locationLine}</span>
        )}

        {/* Footer: block squares, streak, freeform */}
        {hasFooter && (
          <div className="flex flex-wrap gap-1 mt-1 items-center">
            {(activity.block ?? []).map((b) => {
              const Icon = BLOCK_SQUARE_ICONS[b] ?? NumberSquareZero
              return <Icon key={b} size={14} className="text-base-content/40" />
            })}
            {streak > 0 && (
              <span className={`inline-flex items-center gap-0.5 ${streak >= 5 ? 'text-amber-500' : 'text-base-content/40'}`}>
                <Flame weight="fill" size={13} />
                <span className="text-xs">{streak}</span>
              </span>
            )}
            {activity.allows_freeform && (
              <ListChecks size={13} className="text-base-content/40" />
            )}
          </div>
        )}
      </div>

      {/* Desktop buttons — absolute, overhanging */}
      {buttonCount > 0 && (
        <>
          <div
            className="hidden sm:flex absolute flex-col gap-1.5 items-center"
            style={{ right: '-18px', top: '50%', transform: 'translateY(-50%)' }}
          >
            {buttons}
          </div>

          {/* Mobile buttons — inline, inside card */}
          <div className="flex sm:hidden flex-col gap-1.5 items-end absolute bottom-3 right-3">
            {buttons}
          </div>
        </>
      )}
    </div>
  )
}

export default StudentActivityCard
