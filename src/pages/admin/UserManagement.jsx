import { useState, useEffect, useCallback, useRef } from 'react'
import UserForm from '@/components/users/UserForm'
import UserTable from '@/components/users/UserTable'
import { getUsers, createUser, updateUser } from '@/api/users'
import useAuthStore from '@/store/authStore'

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
]

function UserManagement() {
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id

  // Data state
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [editingUser, setEditingUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const modalRef = useRef(null)

  // Filters
  const [roleFilter, setRoleFilter] = useState('')

  const loadData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getUsers(orgId)
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users:', err)
      setError('Failed to load users. Please try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { loadData() }, [loadData])

  function openModal(user = null) {
    setEditingUser(user)
    modalRef.current?.showModal()
  }

  function closeModal() {
    modalRef.current?.close()
    setEditingUser(null)
  }

  async function handleSave(formData) {
    setSaving(true)
    setError(null)
    try {
      if (editingUser) {
        await updateUser(editingUser.id, formData)
      } else {
        await createUser({ ...formData, organization_id: orgId })
      }
      closeModal()
      await loadData()
    } catch (err) {
      console.error('Failed to save user:', err)
      setError(err.message || 'Failed to save user.')
    } finally {
      setSaving(false)
    }
  }

  // Apply filters
  const filteredUsers = users.filter((u) => {
    if (roleFilter && !(u.roles || []).includes(roleFilter)) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Users</h2>
          <p className="text-base-content/60 text-sm mt-1">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + New User
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Filters */}
      {users.length > 0 && (
        <div className="flex gap-2 mb-4">
          <select
            className="select select-bordered select-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            {ROLE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      <UserTable
        users={filteredUsers}
        loading={loading}
        onEdit={openModal}
      />

      {/* Modal */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box w-11/12 max-w-2xl">
          <h3 className="font-bold text-lg mb-4">
            {editingUser ? 'Edit User' : 'New User'}
          </h3>
          <UserForm
            key={editingUser?.id || 'new'}
            user={editingUser}
            onSave={handleSave}
            onCancel={closeModal}
            saving={saving}
          />
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setEditingUser(null)}>close</button>
        </form>
      </dialog>
    </div>
  )
}

export default UserManagement
