import { X } from '@phosphor-icons/react'
import { formatUserName } from '@/api/users'
import { getActivityStaff } from '@/lib/staffRoles'

const ROLES = ['Teacher', 'Monitor', 'Instructor', 'Mentor']
const LOOKUP_ROLES = new Set(['Teacher', 'Monitor'])
const SINGLE_ROLES = new Set(['Instructor', 'Mentor'])

/**
 * StaffRows — view/edit staff assignment rows.
 *
 * View mode: renders formatted staff names from the activity object.
 * Edit mode: renders role dropdown + value field per row, with "+ Staff" to add.
 *
 * Props:
 *   mode       - 'view' | 'edit'
 *   activity   - activity object (used in view mode for joined teacher/monitor names)
 *   staffUsers - array of staff user objects (for Teacher/Monitor lookup in edit mode)
 *   rows       - [{ role, value }] (edit mode only)
 *   onChange   - called with updated rows array (edit mode only)
 */
export default function StaffRows({ mode, activity, staffUsers = [], rows = [], onChange }) {
  if (mode === 'view') {
    return <StaffViewRows activity={activity} />
  }

  return <StaffEditRows rows={rows} staffUsers={staffUsers} onChange={onChange} />
}

const ROLE_LABELS = { teacher: 'Teacher', monitor: 'Monitor' }

function StaffViewRows({ activity }) {
  const staff = getActivityStaff(activity)
  const entries = []

  for (const s of staff) {
    if (s.user) {
      entries.push({ label: ROLE_LABELS[s.role] ?? s.role, name: formatUserName(s.user) })
    }
  }
  if (activity?.instructor_name) {
    entries.push({ label: 'Instructor', name: activity.instructor_name })
  }
  if (activity?.mentor_name) {
    entries.push({ label: 'Mentor', name: activity.mentor_name })
  }

  if (entries.length === 0) {
    return <span className="text-base-content/40 text-sm italic">No staff assigned</span>
  }

  return (
    <div className="space-y-0.5">
      {entries.map((e, i) => (
        <div key={i} className="text-sm">
          <span className="text-base-content/50">{e.label}:</span> {e.name}
        </div>
      ))}
    </div>
  )
}

function StaffEditRows({ rows, staffUsers, onChange }) {
  // Teacher and Monitor can appear multiple times; Instructor and Mentor are single-use.
  const usedSingleRoles = new Set(rows.filter((r) => SINGLE_ROLES.has(r.role)).map((r) => r.role))
  const availableToAdd = ROLES.filter((r) => (SINGLE_ROLES.has(r) ? !usedSingleRoles.has(r) : true))

  function updateRow(index, patch) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange(next)
  }

  function removeRow(index) {
    onChange(rows.filter((_, i) => i !== index))
  }

  function addRow() {
    const nextRole = availableToAdd[0]
    if (!nextRole) return
    onChange([...rows, { role: nextRole, value: '' }])
  }

  function handleRoleChange(index, newRole) {
    // Switching role clears the current value (prevents stale data crossing input types)
    updateRow(index, { role: newRole, value: '' })
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const isLookup = LOOKUP_ROLES.has(row.role)
        return (
          <div key={i} className="flex gap-2 items-center">
            <select
              className="select select-bordered select-sm w-32 shrink-0"
              value={row.role}
              onChange={(e) => handleRoleChange(i, e.target.value)}
            >
              {ROLES.map((r) => (
                <option
                  key={r}
                  value={r}
                  disabled={SINGLE_ROLES.has(r) && usedSingleRoles.has(r) && r !== row.role}
                >
                  {r}
                </option>
              ))}
            </select>

            {isLookup ? (
              <select
                className="select select-bordered select-sm flex-1"
                value={row.value}
                onChange={(e) => updateRow(i, { value: e.target.value })}
              >
                <option value="">Select {row.role.toLowerCase()}</option>
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {formatUserName(u)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="input input-bordered input-sm flex-1"
                value={row.value}
                onChange={(e) => updateRow(i, { value: e.target.value })}
                placeholder={`${row.role} name`}
              />
            )}

            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle text-base-content/40 hover:text-error"
              onClick={() => removeRow(i)}
              title="Remove"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}

      {availableToAdd.length > 0 && (
        <button
          type="button"
          className="btn btn-ghost btn-xs gap-1 text-base-content/60"
          onClick={addRow}
        >
          <span className="text-base leading-none">+</span> Staff
        </button>
      )}
    </div>
  )
}
