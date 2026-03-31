import { timeToMinutes } from '@/components/agenda/agendaUtils'

const ACTION_WINDOW_LEADTIME_MINUTES = 10
const CHECKOUT_LEADTIME_MINUTES = 8

/**
 * Check if the current time is within the action window for an activity.
 * Actions become available ACTION_WINDOW_LEADTIME_MINUTES before start and remain until midnight.
 */
export function isWithinActionWindow(activity, now = new Date()) {
  if (!activity.default_start_time) return false

  const startMinutes = timeToMinutes(activity.default_start_time)
  const availableFromMinutes = startMinutes - ACTION_WINDOW_LEADTIME_MINUTES
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return nowMinutes >= availableFromMinutes
}

/**
 * Check if the activity's end time is within the check-out window.
 * Check-out becomes available CHECKOUT_LEADTIME_MINUTES before end time.
 */
export function isPastEndTime(activity, now = new Date()) {
  if (!activity.default_end_time) return false

  const endMinutes = timeToMinutes(activity.default_end_time)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return nowMinutes >= endMinutes - CHECKOUT_LEADTIME_MINUTES
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
