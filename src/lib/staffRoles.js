/**
 * Staff role derivation utilities.
 *
 * Single source of truth for answering: "what is this viewer's role on
 * this activity?" and "who are all the staff on this activity?"
 *
 * Both functions read from `activity.activity_staff` (the junction table
 * introduced in #70). Callers must ensure the activity object carries an
 * `activity_staff` array — the query functions in api/activities.js and
 * api/agenda.js guarantee this.
 */

/**
 * Derive the viewer's role on a given activity.
 *
 * The `unique_activity_user` constraint on activity_staff guarantees at most
 * one row per (activity, viewer), so the return is always a single role or null.
 *
 * @param {object} activity - must include `activity_staff` array
 * @param {string} viewerId - the current user's profile id
 * @returns {'teacher' | 'monitor' | null}
 */
export function getViewerRole(activity, viewerId) {
  if (!activity || !viewerId) return null
  const staff = activity.activity_staff ?? []
  const row = staff.find((s) => s.user_id === viewerId)
  return row?.role ?? null
}

/**
 * Return all staff on an activity as a normalized, display-ready list.
 * Teachers first, then monitors; within a role, by the order returned.
 * Does NOT include external instructor_name / mentor_name (those are
 * free-text fields on the activity, not user rows). Callers that show
 * those render them separately from the activity object.
 *
 * @param {object} activity - must include `activity_staff` (each row may
 *   carry a joined `user` profile object for name display)
 * @returns {Array<{ userId, role, user }>}
 */
export function getActivityStaff(activity) {
  const staff = activity?.activity_staff ?? []
  const order = { teacher: 0, monitor: 1 }
  return [...staff]
    .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
    .map((s) => ({ userId: s.user_id, role: s.role, user: s.user ?? null }))
}
