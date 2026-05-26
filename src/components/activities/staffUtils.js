import { getActivityStaff } from '@/lib/staffRoles'

/**
 * Build the initial staff rows array from an activity object.
 * Reads from activity.activity_staff (junction table, post-#70).
 * Returns at least one empty Teacher row for new activities.
 */
export function buildStaffRows(activity) {
  if (!activity) return [{ role: 'Teacher', value: '' }]

  const allStaff = getActivityStaff(activity)
  const rows = allStaff.map((s) => ({
    role: s.role === 'teacher' ? 'Teacher' : 'Monitor',
    value: s.userId,
  }))
  if (activity.instructor_name) rows.push({ role: 'Instructor', value: activity.instructor_name })
  if (activity.mentor_name) rows.push({ role: 'Mentor', value: activity.mentor_name })
  if (rows.length === 0) rows.push({ role: 'Teacher', value: '' })
  return rows
}

/**
 * Convert staff rows array to a payload for setActivityStaff + activity update.
 * Returns { staff: [{ user_id, role }], instructor_name, mentor_name }
 */
export function staffRowsToPayload(rows) {
  const staff = []
  let instructor_name = null
  let mentor_name = null

  for (const row of rows) {
    if (row.role === 'Teacher' && row.value) staff.push({ user_id: row.value, role: 'teacher' })
    if (row.role === 'Monitor' && row.value) staff.push({ user_id: row.value, role: 'monitor' })
    if (row.role === 'Instructor') instructor_name = row.value?.trim() || null
    if (row.role === 'Mentor') mentor_name = row.value?.trim() || null
  }

  return { staff, instructor_name, mentor_name }
}
