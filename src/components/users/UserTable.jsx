import { formatUserName } from '@/api/users'

const ROLE_BADGE_COLORS = {
  admin: 'badge-primary',
  teacher: 'badge-secondary',
  student: 'badge-accent',
}

/**
 * UserTable — displays a list of users.
 *
 * Props:
 *   users   - array of user_profiles objects
 *   loading - boolean, show loading state
 *   onEdit  - called with user object when edit is clicked
 */
export default function UserTable({ users = [], loading = false, onEdit }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/50">
        <p className="text-lg mb-1">No users yet</p>
        <p className="text-sm">Create your first user to get started.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Roles</th>
            <th>Grade</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="hover">
              <td className="font-medium">{formatUserName(user)}</td>
              <td className="text-base-content/70">{user.email}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {(user.roles || []).map((role) => (
                    <span
                      key={role}
                      className={`badge badge-sm ${ROLE_BADGE_COLORS[role] || 'badge-ghost'}`}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </td>
              <td>
                {user.grade_level
                  ? user.grade_level
                  : <span className="text-base-content/40">—</span>
                }
              </td>
              <td>
                {onEdit && (
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => onEdit(user)}
                  >
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
