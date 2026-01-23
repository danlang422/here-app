import InternshipsPageClient from '@/components/admin/InternshipsPageClient'
import { getInternships } from './actions'

export default async function InternshipsPage() {
  // Fetch internships data on the server
  const result = await getInternships()

  // Handle error or no data
  const initialInternships = result.success && result.data ? result.data : []

  // Pass the data to the client component
  return <InternshipsPageClient initialInternships={initialInternships} />
}
