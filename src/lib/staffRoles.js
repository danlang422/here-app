/**
 * Staff role derivation utilities.
 *
 * Single source of truth for answering: "what is this viewer's role on
 * this activity?" Consumers should never compare viewer ids against
 * `teacher_id` / `monitor_id` directly — always go through these helpers.
 *
 * Pre-#70 (current): role is derived from `activities.teacher_id` and
 * `activities.monitor_id` columns.
 *
 * Post-#70: role is derived from the `activity_staff` junction table.
 * When that migration lands, update this file's internals only. The
 * exported function signatures stay the same.
 *
 * See: docs/user-flows/role-derivation-helper-build-spec.md
 * See: GitHub #70 (activity_staff junction table)
 */

/**
 * Derive the viewer's role on a given activity.
 *
 * Today, role is determined by comparing the viewer's id against
 * `activities.teacher_id` and `activities.monitor_id`. When #70 lands
 * and replaces those columns with the `activity_staff` junction table,
 * the body of this function changes to look up the viewer's row in
 * `activity.activity_staff` and return its `role` field. The function
 * signature and return type stay the same.
 *
 * @param {object} activity - An activity record. Must include `teacher_id`
 *   and `monitor_id` fields (pre-#70). Post-#70, must include
 *   `activity_staff` array.
 * @param {string} viewerId - The current user's profile id.
 * @returns {'teacher' | 'monitor' | null}
 *   - `'teacher'` if the viewer is listed as the activity's teacher
 *   - `'monitor'` if the viewer is listed as the activity's monitor
 *   - `null` if the viewer has no staff role on this activity
 *     (e.g. viewing a visible-to-all activity they're not assigned to)
 *
 * @example
 *   const role = getViewerRole(activity, profile.id)
 *   if (role === 'teacher') { ... }
 */
export function getViewerRole(activity, viewerId) {
  if (!activity || !viewerId) return null
  if (activity.teacher_id === viewerId) return 'teacher'
  if (activity.monitor_id === viewerId) return 'monitor'
  return null
}
