import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { requestPasswordReset } from '@/api/auth'

function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { email: '' },
  })

  async function onFormSubmit({ email }) {
    setError(null)
    try {
      await requestPasswordReset(email)
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.')
      return
    }
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold mb-4">Reset password</h2>

          {error && (
            <div className="alert alert-error mb-4">
              <span className="text-sm">{error}</span>
            </div>
          )}

          {submitted ? (
            <div className="space-y-4">
              <p className="text-sm text-base-content/80">
                If an account exists for that email, a reset link is on its way. Check your inbox.
              </p>
              <div className="text-center mt-2">
                <Link to="/login" className="link link-primary text-sm">
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
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

              <div className="form-control mt-6">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? <span className="loading loading-spinner loading-sm"></span>
                    : 'Send reset link'
                  }
                </button>
              </div>

              <div className="text-center mt-2">
                <Link to="/login" className="link link-primary text-sm">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
