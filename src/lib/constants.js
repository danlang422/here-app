// Activity types — matches the CHECK constraint on activities.type
export const ACTIVITY_TYPES = [
  'regular_class',
  'college_course',
  'external_hs_course',
  'online_course',
  'freeform',
  'internship',
]

// Human-readable labels for activity types
export const ACTIVITY_TYPE_LABELS = {
  regular_class: 'Regular Class',
  college_course: 'College Course',
  external_hs_course: 'External HS Course',
  online_course: 'Online Course',
  freeform: 'Freeform Block',
  internship: 'Internship',
}

// Default behavior flags by activity type (set at creation, all overridable)
export const ACTIVITY_TYPE_DEFAULTS = {
  regular_class:     { requires_attendance: true,  requires_checkin: false, allows_presence_wave: true,  allows_freeform: false, requires_geofence: false },
  college_course:    { requires_attendance: true,  requires_checkin: false, allows_presence_wave: false, allows_freeform: false, requires_geofence: false },
  external_hs_course:{ requires_attendance: false, requires_checkin: false, allows_presence_wave: false, allows_freeform: false, requires_geofence: false },
  online_course:     { requires_attendance: true,  requires_checkin: true,  allows_presence_wave: false, allows_freeform: false, requires_geofence: false },
  freeform:          { requires_attendance: true,  requires_checkin: true,  allows_presence_wave: false, allows_freeform: true,  requires_geofence: false },
  internship:        { requires_attendance: true,  requires_checkin: true,  allows_presence_wave: false, allows_freeform: false, requires_geofence: false },
}

// Block numbers used at City View (0-5)
export const BLOCKS = [0, 1, 2, 3, 4, 5]

// Block labels for display
export const BLOCK_LABELS = {
  0: 'Block 0',
  1: 'Block 1',
  2: 'Block 2',
  3: 'Block 3',
  4: 'Block 4',
  5: 'Block 5',
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
