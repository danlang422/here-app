import { useState, useRef } from 'react'
import UserForm from '@/components/users/UserForm'
import UserTable from '@/components/users/UserTable'
import BulkUserEntry from '@/components/users/BulkUserEntry'
import { useUsers, useCreateUser, useUpdateUser } from '@/hooks/useUsers'
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

  // Server state
  const { data: users = [], isLoading, error: loadError } = useUsers(orgId)
  const createMutation = useCreateUser(orgId)
  const updateMutation = useUpdateUser(orgId)

  // UI state
  const [editingUser, setEditingUser] = useState(null)
  const [roleFilter, setRoleFilter] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const modalRef = useRef(null)

  const saving = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error || updateMutation.error

  function openModal(user = null) {
    setEditingUser(user)
    modalRef.current?.showModal()
  }

  function closeModal() {
    modalRef.current?.close()
    setEditingUser(null)
    createMutation.reset()
    updateMutation.reset()
  }

  function handleSave(formData) {
    const onSuccess = () => {
      closeModal()
    }

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, updates: formData }, { onSuccess })
    } else {
      createMutation.mutate(formData, { onSuccess })
    }
  }

  // Apply filters
  const filteredUsers = users.filter((u) => {
    if (roleFilter && !(u.roles || []).includes(roleFilter)) return false
    return true
  })

  const error = loadError?.message || mutationError?.message

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Users</h2>
          <p className="text-base-content/60 text-sm mt-1">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn btn-outline btn-sm ${showBulk ? 'btn-active' : ''}`}
            onClick={() => setShowBulk(!showBulk)}
          >
            Bulk Add
          </button>
          <button className="btn btn-primary" onClick={() => openModal()}>
            + New User
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { createMutation.reset(); updateMutation.reset() }}>✕</button>
        </div>
      )}

      {showBulk && (
        <div className="mb-4">
          <BulkUserEntry
            orgId={orgId}
            existingUsers={users}
            onDone={() => setShowBulk(false)}
          />
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
        loading={isLoading}
        onEdit={openModal}
      />

      {/* Modal */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box w-11/12 max-w-2xl">
          <h3 className="font-bold text-lg mb-4">
            {editingUser ? 'Edit User' : 'New User'}
          </h3>
          <UserForm
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
