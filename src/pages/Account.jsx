import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { updatePassword } from '@/api/auth'
import useAuthStore from '@/store/authStore'
import { getDisplayName } from '@/lib/utils'

function Account() {
  const { profile, user } = useAuthStore()
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState(null)

  const displayName = getDisplayName(profile)

  const { register, handleSubmit, control, reset, formState: { isSubmitting, errors } } = useForm({
    defaultValues: { password: '', confirmPassword: '' },
  })

  const password = useWatch({ name: 'password', control })

  async function onPasswordSubmit({ password: newPassword }) {
    setPasswordError(null)
    setPasswordSuccess(false)
    try {
      await updatePassword(newPassword)
      setPasswordSuccess(true)
      reset()
    } catch (err) {
      setPasswordError(err.message ?? 'Failed to update password. Please try again.')
    }
  }

  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-2xl font-bold">Account</h1>

      {/* Account info */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-lg">Account info</h2>
          <div className="space-y-3 mt-2">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Name</span>
              </label>
              <input
                type="text"
                value={displayName}
                className="input input-bordered"
                readOnly
                disabled
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                value={user?.email ?? ''}
                className="input input-bordered"
                readOnly
                disabled
              />
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-lg">Change password</h2>

          {passwordError && (
            <div className="alert alert-error mt-2">
              <span className="text-sm">{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="alert alert-success mt-2">
              <span className="text-sm">Password updated successfully.</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4 mt-2">
            <div className="form-control">
              <label className="label">
                <span className="label-text">New password</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className={`input input-bordered ${errors.password ? 'input-error' : ''}`}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Password must be at least 6 characters' },
                })}
                autoComplete="new-password"
              />
              {errors.password && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.password.message}</span>
                </label>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Confirm new password</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className={`input input-bordered ${errors.confirmPassword ? 'input-error' : ''}`}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (val) => val === password || 'Passwords do not match',
                })}
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.confirmPassword.message}</span>
                </label>
              )}
            </div>

            <div className="form-control mt-4">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <span className="loading loading-spinner loading-sm"></span>
                  : 'Update password'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Account
