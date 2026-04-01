import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { signIn } from '@/api/auth'
import useAuthStore from '@/store/authStore'

function Login() {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const [error, setError] = useState(null)

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { email: '', password: '' },
  })

  // Where to send the user after login
  const from = location.state?.from?.pathname ?? '/dashboard'

  // If the user is already authenticated (or just became authenticated
  // via the auth listener), redirect them out of the login page
  if (user) {
    return <Navigate to={from} replace />
  }

  async function onFormSubmit({ email, password }) {
    setError(null)
    try {
      await signIn(email, password)
      // No navigate here — the auth listener updates the store,
      // which triggers a re-render, and the redirect above fires
    } catch (err) {
      setError(err.message ?? 'Sign in failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold mb-4">Here</h2>

          {error && (
            <div className="alert alert-error mb-4">
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                placeholder="email@example.com"
                className="input input-bordered"
                {...register('email', { required: true })}
                autoComplete="email"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="input input-bordered"
                {...register('password', { required: true })}
                autoComplete="current-password"
              />
            </div>

            <div className="form-control mt-6">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <span className="loading loading-spinner loading-sm"></span>
                  : 'Sign In'
                }
              </button>
            </div>

            <div className="text-center mt-2">
              <Link to="/forgot-password" className="link link-primary text-sm">
                Forgot password?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
