import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

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
  const isEdit = !!user

  const { register, handleSubmit, watch, setValue, getValues, reset, formState: { isValid } } = useForm({
    defaultValues: buildInitialForm(user),
    mode: 'onChange',
  })

  // Reset form when user prop changes (switching between edit targets or create mode)
  useEffect(() => {
    reset(buildInitialForm(user))
  }, [user, reset])

  const watchedRoles = watch('roles')

  function handleRoleToggle(role) {
    const current = getValues('roles')
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role]
    setValue('roles', next, { shouldValidate: true })
  }

  function onFormSubmit(formValues) {
    const data = {
      first_name: formValues.first_name.trim(),
      last_name: formValues.last_name.trim(),
      preferred_name: formValues.preferred_name.trim() || null,
      roles: formValues.roles,
      grade_level: formValues.grade_level || null,
    }

    if (!isEdit) {
      data.email = formValues.email.trim()
      data.password = formValues.password
    }

    onSave(data)
  }

  const canSubmit = isValid && watchedRoles.length > 0

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First Name *">
          <input
            type="text"
            className="input input-bordered w-full"
            {...register('first_name', { required: true })}
          />
        </Field>

        <Field label="Last Name *">
          <input
            type="text"
            className="input input-bordered w-full"
            {...register('last_name', { required: true })}
          />
        </Field>
      </div>

      <Field label="Preferred Name">
        <input
          type="text"
          className="input input-bordered w-full"
          {...register('preferred_name')}
          placeholder="Display name (optional)"
        />
      </Field>

      {!isEdit && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Email *">
            <input
              type="email"
              className="input input-bordered w-full"
              {...register('email', { required: !isEdit })}
            />
          </Field>

          <Field label="Password *">
            <input
              type="text"
              className="input input-bordered w-full"
              {...register('password', { required: !isEdit })}
              placeholder="Initial password"
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
                checked={watchedRoles.includes(opt.value)}
                onChange={() => handleRoleToggle(opt.value)}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
        {watchedRoles.length === 0 && (
          <p className="text-xs text-error mt-1">At least one role is required</p>
        )}
      </Field>

      <Field label="Grade Level">
        <select
          className="select select-bordered w-full max-w-xs"
          {...register('grade_level')}
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
