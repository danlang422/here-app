import UsersPageClient from '@/components/admin/UsersPageClient'
import { getUsers } from './actions'

export default async function UsersPage() {
  // Fetch users data on the server
  const result = await getUsers()

  // Handle error or no data
  const initialUsers = result.success && result.data ? result.data : []

  // Pass the data to the client component
  return <UsersPageClient initialUsers={initialUsers} />
}
