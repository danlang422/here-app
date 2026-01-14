import { createClient } from '@/lib/supabase/server'
import { logout } from '@/lib/auth/actions'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  
  // Get the user on the server side
  const { data: { user } } = await supabase.auth.getUser()

  // This shouldn't happen due to middleware, but just in case
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Here!</h1>
        <p className="text-gray-600 mb-6">
          You're logged in as <span className="font-medium">{user.email}</span>
        </p>
        
        <form action={logout}>
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Quick links:</p>
          <ul className="space-y-1 text-sm">
            <li>
              <a href="/student/agenda" className="text-blue-600 hover:text-blue-700">
                Student Agenda (demo)
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
