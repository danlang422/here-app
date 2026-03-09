/**
 * Build the initial staff rows array from a flat activity object.
 * Returns at least one row (empty Teacher) for new activities.
 */
export function buildStaffRows(activity) {
  if (!activity) return [{ role: 'Teacher', value: '' }]
  const rows = []
  if (activity.teacher_id) rows.push({ role: 'Teacher', value: activity.teacher_id })
  if (activity.monitor_id) rows.push({ role: 'Monitor', value: activity.monitor_id })
  if (activity.instructor_name) rows.push({ role: 'Instructor', value: activity.instructor_name })
  if (activity.mentor_name) rows.push({ role: 'Mentor', value: activity.mentor_name })
  if (rows.length === 0) rows.push({ role: 'Teacher', value: '' })
  return rows
}

/**
 * Convert staff rows array to the flat form fields expected by the API.
 */
export function staffRowsToFlat(rows) {
  const result = { teacher_id: null, monitor_id: null, instructor_name: null, mentor_name: null }
  for (const row of rows) {
    if (row.role === 'Teacher') result.teacher_id = row.value || null
    if (row.role === 'Monitor') result.monitor_id = row.value || null
    if (row.role === 'Instructor') result.instructor_name = row.value?.trim() || null
    if (row.role === 'Mentor') result.mentor_name = row.value?.trim() || null
  }
  return result
}
