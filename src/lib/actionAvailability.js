import { timeToMinutes } from '@/components/agenda/agendaUtils'

/**
 * Check if the current time is within the action window for an activity.
 * Actions become available 10 minutes before start and remain until midnight.
 */
export function isWithinActionWindow(activity, now = new Date()) {
  if (!activity.default_start_time) return false

  const startMinutes = timeToMinutes(activity.default_start_time)
  const availableFromMinutes = startMinutes - 10
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return nowMinutes >= availableFromMinutes
}

/**
 * Check if the activity's end time has passed (for check-out availability).
 */
export function isPastEndTime(activity, now = new Date()) {
  if (!activity.default_end_time) return false

  const endMinutes = timeToMinutes(activity.default_end_time)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return nowMinutes >= endMinutes
}

/**
 * Determine the check-in button state for a given activity.
 */
export function getCheckinButtonState(activity, checkIn, isToday, now = new Date()) {
  if (!isToday) return 'inactive'
  if (!isWithinActionWindow(activity, now)) return 'inactive'

  if (!checkIn) return 'available'
  if (checkIn.checked_out_at) return 'checked-out'
  if (isPastEndTime(activity, now)) return 'checkout-available'
  return 'checked-in'
}

/**
 * Determine the wave button state for a given activity.
 */
export function getWaveButtonState(activity, existingWave, isToday, now = new Date()) {
  if (!isToday) return 'inactive'
  if (!isWithinActionWindow(activity, now)) return 'inactive'
  if (existingWave) return 'completed'
  return 'available'
}

/**
 * Determine the status update button state for a given activity.
 */
export function getStatusButtonState(hasInstance, hasUpdates, isToday) {
  if (!isToday || !hasInstance) return 'inactive'
  if (hasUpdates) return 'has-updates'
  return 'available'
}
