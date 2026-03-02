import { useState } from 'react'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
]

const GRADE_OPTIONS = ['9', '10', '11', '12']

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  preferred_name: '',
  email: '',
  password: '',
  roles: [],
  grade_level: '',
}

function buildInitialForm(user) {
  if (user) {
    return {
      ...EMPTY_FORM,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      preferred_name: user.preferred_name || '',
      roles: user.roles || [],
      grade_level: user.grade_level || '',
    }
  }
  return { ...EMPTY_FORM }
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  )
}

/**
 * UserForm — reusable form for creating/editing users.
 *
 * Props:
 *   user     - existing user object for edit mode (null for create)
 *   onSave   - called with form data on submit
 *   onCancel - called when user cancels
 *   saving   - boolean, disables submit button while saving
 */
export default function UserForm({ user = null, onSave, onCancel, saving = false }) {
  const [form, setForm] = useState(() => buildInitialForm(user))
  const isEdit = !!user

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleRoleToggle(role) {
    setForm((prev) => {
      const current = prev.roles
      const next = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role]
      return { ...prev, roles: next }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) return
    if (form.roles.length === 0) return
    if (!isEdit && (!form.email.trim() || !form.password)) return

    const data = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      preferred_name: form.preferred_name.trim() || null,
      roles: form.roles,
      grade_level: form.grade_level || null,
    }

    if (!isEdit) {
      data.email = form.email.trim()
      data.password = form.password
    }

    onSave(data)
  }

  const canSubmit =
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.roles.length > 0 &&
    (isEdit || (form.email.trim() && form.password))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First Name *">
          <input
            type="text"
            className="input input-bordered w-full"
            value={form.first_name}
            onChange={(e) => handleChange('first_name', e.target.value)}
            required
          />
        </Field>

        <Field label="Last Name *">
          <input
            type="text"
            className="input input-bordered w-full"
            value={form.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Preferred Name">
        <input
          type="text"
          className="input input-bordered w-full"
          value={form.preferred_name}
          onChange={(e) => handleChange('preferred_name', e.target.value)}
          placeholder="Display name (optional)"
        />
      </Field>

      {!isEdit && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Email *">
            <input
              type="email"
              className="input input-bordered w-full"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              required
            />
          </Field>

          <Field label="Password *">
            <input
              type="text"
              className="input input-bordered w-full"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="Initial password"
              required
            />
          </Field>
        </div>
      )}

      <Field label="Roles *">
        <div className="flex flex-wrap gap-3">
          {ROLE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={form.roles.includes(opt.value)}
                onChange={() => handleRoleToggle(opt.value)}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
        {form.roles.length === 0 && (
          <p className="text-xs text-error mt-1">At least one role is required</p>
        )}
      </Field>

      <Field label="Grade Level">
        <select
          className="select select-bordered w-full max-w-xs"
          value={form.grade_level}
          onChange={(e) => handleChange('grade_level', e.target.value)}
        >
          <option value="">No grade level</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}>
          {saving ? <span className="loading loading-spinner loading-sm" /> : null}
          {isEdit ? 'Save Changes' : 'Create User'}
        </button>
      </div>
    </form>
  )
}
