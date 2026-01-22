'use client'

import { useState } from 'react'
import UserFormModal from '@/components/admin/UserFormModal'
import { getUsers, resetUserPassword, deleteUser, type UserWithRoles } from '@/app/admin/users/actions'

type UsersPageClientProps = {
  initialUsers: UserWithRoles[]
}

export default function UsersPageClient({ initialUsers }: UsersPageClientProps) {
  const [users, setUsers] = useState<UserWithRoles[]>(initialUsers)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithRoles | undefined>(undefined)
  const [createdThisSession, setCreatedThisSession] = useState<UserWithRoles[]>([])
  const [filterRole, setFilterRole] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  async function loadUsers() {
    const result = await getUsers()
    if (result.success && result.data) {
      setUsers(result.data)
    }
  }

  const handleUserCreated = async (userId: string) => {
    // Reload users to get the newly created one
    await loadUsers()

    // Find the newly created user and add it to "created this session" list
    const result = await getUsers()
    if (result.success && result.data) {
      const newUser = result.data.find(u => u.id === userId)
      if (newUser) {
        setCreatedThisSession(prev => [newUser, ...prev])
      }
    }
  }

  const handleUserUpdated = async () => {
    await loadUsers()
    setIsModalOpen(false)
    setEditingUser(undefined)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingUser(undefined)
  }

  const handleEditUser = (user: UserWithRoles) => {
    setEditingUser(user)
    setIsModalOpen(true)
  }

  const handleResetPassword = async (email: string, userName: string) => {
    if (!confirm(`Send password reset email to ${userName} (${email})?`)) {
      return
    }

    const result = await resetUserPassword(email)
    if (result.success) {
      alert('Password reset email sent successfully')
    } else {
      alert(`Error: ${result.error}`)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return
    }

    const result = await deleteUser(userId)
    if (result.success) {
      await loadUsers()
      alert('User deleted successfully')
    } else {
      alert(`Error: ${result.error}`)
    }
  }

  // Filter users
  const filteredUsers = users.filter(user => {
    // Filter by role
    if (filterRole !== 'all') {
      const hasRole = user.user_roles.some(ur => ur.roles.name === filterRole)
      if (!hasRole) return false
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase()
      const email = user.email.toLowerCase()

      if (!fullName.includes(query) && !email.includes(query)) {
        return false
      }
    }

    return true
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Users</h1>
        <button
          onClick={() => {
            setEditingUser(undefined)
            setIsModalOpen(true)
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create User
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Role Filter */}
        <div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="admin">Admins</option>
            <option value="mentor">Mentors</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchQuery || filterRole !== 'all'
            ? 'No users found matching your filters'
            : 'No users yet. Create your first user to get started.'
          }
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Primary Role</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                    {user.primary_role}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleResetPassword(user.email, `${user.first_name} ${user.last_name}`)}
                      className="text-amber-600 hover:text-amber-800 mr-3"
                    >
                      Reset Password
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id, `${user.first_name} ${user.last_name}`)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredUsers.length} of {users.length} users
      </div>

      {/* User Form Modal */}
      <UserFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUserCreated={handleUserCreated}
        onUserUpdated={handleUserUpdated}
        editingUser={editingUser}
        createdThisSession={createdThisSession}
      />
    </div>
  )
}
