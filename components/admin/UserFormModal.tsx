'use client'

import { useState, useEffect } from 'react'
import { createUser, updateUser, getRoles, type UserWithRoles, type Role } from '@/app/admin/users/actions'

type UserFormModalProps = {
  isOpen: boolean
  onClose: () => void
  onUserCreated?: (userId: string) => void
  onUserUpdated?: () => void
  editingUser?: UserWithRoles
  createdThisSession?: UserWithRoles[]
}

export default function UserFormModal({
  isOpen,
  onClose,
  onUserCreated,
  onUserUpdated,
  editingUser,
  createdThisSession = []
}: UserFormModalProps) {
  const [roles, setRoles] = useState<Role[]>([])
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    primary_role: 'student' as 'student' | 'teacher' | 'admin' | 'mentor',
    role_ids: [] as string[],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load roles on mount
  useEffect(() => {
    async function loadRoles() {
      const result = await getRoles()
      if (result.success && result.data) {
        setRoles(result.data)
        
        // Set default role_ids to match primary_role
        if (!editingUser) {
          const studentRole = result.data.find(r => r.name === 'student')
          if (studentRole) {
            setFormData(prev => ({ ...prev, role_ids: [studentRole.id] }))
          }
        }
      }
    }
    loadRoles()
  }, [editingUser])

  // Populate form when editing
  useEffect(() => {
    if (editingUser) {
      setFormData({
        email: editingUser.email,
        password: '', // Never populate password
        first_name: editingUser.first_name || '',
        last_name: editingUser.last_name || '',
        phone: editingUser.phone || '',
        primary_role: editingUser.primary_role,
        role_ids: editingUser.user_roles.map(ur => ur.role_id),
      })
    }
  }, [editingUser])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phone: '',
        primary_role: 'student',
        role_ids: roles.find(r => r.name === 'student')?.id ? [roles.find(r => r.name === 'student')!.id] : [],
      })
      setError(null)
    }
  }, [isOpen, roles])

  const handleSubmit = async (saveAndAddAnother: boolean = false) => {
    setError(null)
    setLoading(true)

    try {
      if (editingUser) {
        // Update existing user
        const result = await updateUser(editingUser.id, {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          primary_role: formData.primary_role,
          role_ids: formData.role_ids,
        })

        if (!result.success) {
          setError(result.error)
          setLoading(false)
          return
        }

        onUserUpdated?.()
        onClose()
      } else {
        // Create new user
        if (!formData.password) {
          setError('Password is required for new users')
          setLoading(false)
          return
        }

        const result = await createUser(formData)

        if (!result.success) {
          setError(result.error)
          setLoading(false)
          return
        }

        if (result.data) {
          onUserCreated?.(result.data)
        }

        if (saveAndAddAnother) {
          // Reset form but keep modal open
          setFormData({
            email: '',
            password: '',
            first_name: '',
            last_name: '',
            phone: '',
            primary_role: 'student',
            role_ids: roles.find(r => r.name === 'student')?.id ? [roles.find(r => r.name === 'student')!.id] : [],
          })
          setError(null)
        } else {
          // Close modal
          onClose()
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleToggle = (roleId: string) => {
    setFormData(prev => {
      const isSelected = prev.role_ids.includes(roleId)
      if (isSelected) {
        // Don't allow unchecking if it's the only role
        if (prev.role_ids.length === 1) {
          return prev
        }
        return { ...prev, role_ids: prev.role_ids.filter(id => id !== roleId) }
      } else {
        return { ...prev, role_ids: [...prev.role_ids, roleId] }
      }
    })
  }

  // Auto-check primary role when it changes
  useEffect(() => {
    const primaryRoleObj = roles.find(r => r.name === formData.primary_role)
    if (primaryRoleObj && !formData.role_ids.includes(primaryRoleObj.id)) {
      setFormData(prev => ({ ...prev, role_ids: [...prev.role_ids, primaryRoleObj.id] }))
    }
  }, [formData.primary_role, roles, formData.role_ids])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex">
        {/* Main Form Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {editingUser ? 'Edit User' : 'Create New User'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <form className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={!!editingUser} // Can't change email when editing
                className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              />
            </div>

            {/* Password (only for new users) */}
            {!editingUser && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Temporary Password *
                </label>
                <input
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  User can change this after first login
                </p>
              </div>
            )}

            {/* First Name */}
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Primary Role */}
            <div>
              <label htmlFor="primary_role" className="block text-sm font-medium text-gray-700 mb-1">
                Primary Role *
              </label>
              <select
                id="primary_role"
                value={formData.primary_role}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  primary_role: e.target.value as 'student' | 'teacher' | 'admin' | 'mentor' 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
                <option value="mentor">Mentor</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Primary role determines default dashboard view
              </p>
            </div>

            {/* Additional Roles */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned Roles *
              </label>
              <div className="space-y-2">
                {roles.map(role => (
                  <label key={role.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.role_ids.includes(role.id)}
                      onChange={() => handleRoleToggle(role.id)}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span className="text-sm text-gray-700 capitalize">{role.name}</span>
                    {role.description && (
                      <span className="ml-2 text-xs text-gray-500">- {role.description}</span>
                    )}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Users can have multiple roles. At least one role is required.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              
              {editingUser ? (
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={loading}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save & Add Another'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save & Done'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        {/* Sidebar - Users Created This Session */}
        {!editingUser && createdThisSession.length > 0 && (
          <div className="w-80 bg-gray-50 border-l border-gray-200 p-6 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Users Created This Session
            </h3>
            <div className="space-y-3">
              {createdThisSession.map(user => (
                <div key={user.id} className="bg-white p-3 rounded-md border border-gray-200">
                  <div className="font-medium text-sm text-gray-900">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{user.email}</div>
                  <div className="text-xs text-gray-500 mt-1 capitalize">
                    {user.primary_role}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
