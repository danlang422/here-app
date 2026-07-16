import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { supabase } from '@/api/supabase'
import { updatePassword, signOut } from '@/api/auth'

function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, control, formState: { isSubmitting, errors } } = useForm({
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    // Listen for the auth event Supabase fires when the user lands with a
    // valid token in the URL hash. Password recovery links fire
    // PASSWORD_RECOVERY; invite links (used for initial account setup, see
    // create-user edge function) land the user in an authenticated session
    // via SIGNED_IN instead — this page serves both flows.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })

    // Also handle the case where the session was already set
    // (e.g. the user refreshed the page after the token was processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      } else {
        // Give the auth state change listener a moment to fire before
        // showing the expired state — Supabase processes the hash async
        const timer = setTimeout(() => {
          setExpired(true)
        }, 2000)
        return () => clearTimeout(timer)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function onFormSubmit({ password }) {
    try {
      await updatePassword(password)
      // End the recovery/invite session now that a real password is set.
      // The amr claim only accumulates auth *events* — changing a password
      // isn't itself one — so without signing out, this session would keep
      // reading as recovery/invite and ProtectedRoute would loop it back
      // here forever. Signing out and requiring a fresh signInWithPassword()
      // establishes a clean session with amr: ['password'].
      await signOut()
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      // Surface the error via react-hook-form's setError isn't ideal here,
      // so we use a state variable
      setFormError(err.message ?? 'Failed to update password. Please try again.')
    }
  }

  const [formError, setFormError] = useState(null)
  const password = useWatch({ name: 'password', control })

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="card w-96 bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl font-bold mb-4">Password updated</h2>
            <p className="text-sm text-base-content/80">
              Your password has been updated. Redirecting you to sign in...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (expired && !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="card w-96 bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl font-bold mb-4">Link expired</h2>
            <p className="text-sm text-base-content/80 mb-4">
              This reset link has expired or has already been used.
            </p>
            <Link to="/forgot-password" className="link link-primary text-sm">
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold mb-4">Set new password</h2>

          {formError && (
            <div className="alert alert-error mb-4">
              <span className="text-sm">{formError}</span>
            </div>
          )}

          {!ready ? (
            <div className="flex justify-center py-4">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
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
                    minLength: { value: 15, message: 'Password must be at least 15 characters' },
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

              <div className="form-control mt-6">
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
          )}
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
