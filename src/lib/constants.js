// Block utilities — block count is org-defined, not hardcoded.
// Use getBlocks(blockCount) to generate the array for a given org.
// blockCount comes from organization.settings.block_count (nullable = not yet decided).

export function getBlocks(blockCount) {
  if (!blockCount || blockCount < 1) return []
  return Array.from({ length: blockCount }, (_, i) => i)
}

export function getBlockLabel(blockNum, blockLabels) {
  if (blockLabels && blockLabels[blockNum]) {
    return blockLabels[blockNum]
  }
  return `Block ${blockNum}`
}

export function getBlockLabels(blockCount, blockLabels) {
  const blocks = getBlocks(blockCount)
  return Object.fromEntries(blocks.map(b => [b, getBlockLabel(b, blockLabels)]))
}

// Format a block array (INTEGER[]) to a readable string, e.g. "Block 2, Block 3".
// Accepts null (returns null) or a single number for backwards compatibility.
export function formatBlockArray(block, blockLabels) {
  if (block == null) return null
  const arr = Array.isArray(block) ? block : [block]
  if (arr.length === 0) return null
  return arr.map(b => getBlockLabel(b, blockLabels)).join(', ')
}

// Days of week per EXTRACT(DOW): 0=Sun, 1=Mon, ..., 6=Sat
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', short: 'Su' },
  { value: 1, label: 'Mon', short: 'M' },
  { value: 2, label: 'Tue', short: 'Tu' },
  { value: 3, label: 'Wed', short: 'W' },
  { value: 4, label: 'Thu', short: 'Th' },
  { value: 5, label: 'Fri', short: 'F' },
  { value: 6, label: 'Sat', short: 'Sa' },
]

// Weekdays only (the typical school week)
export const WEEKDAYS = DAYS_OF_WEEK.filter(d => d.value >= 1 && d.value <= 5)

// Attendance statuses
export const ATTENDANCE_STATUSES = ['present', 'absent', 'tardy', 'excused']

export const ATTENDANCE_STATUS_LABELS = {
  present: 'Present',
  absent: 'Absent',
  tardy: 'Tardy',
  excused: 'Excused',
}

// Roles
export const ROLES = ['student', 'teacher', 'admin']

// School day override reasons — matches CHECK constraint
export const OVERRIDE_REASONS = ['weather', 'planned_holiday', 'emergency']

export const OVERRIDE_REASON_LABELS = {
  weather: 'Weather',
  planned_holiday: 'Planned Holiday',
  emergency: 'Emergency',
}
