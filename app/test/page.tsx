import { createClient } from '@/lib/supabase/server'

export default async function TestPage() {
  const supabase = await createClient()
  
  // Simple query to fetch all users
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
  
  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Database Test</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error:</p>
          <p>{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Database Test</h1>
      <p className="mb-4">Successfully connected to Supabase! ✅</p>
      
      <h2 className="text-xl font-semibold mb-2">Users in database:</h2>
      {users && users.length > 0 ? (
        <ul className="list-disc pl-6">
          {users.map((user) => (
            <li key={user.id}>
              {user.email} - {user.role} ({user.first_name} {user.last_name})
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-600">No users found in database.</p>
      )}
    </div>
  )
}
