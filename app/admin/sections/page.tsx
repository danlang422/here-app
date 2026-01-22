import SectionsPageClient from '@/components/admin/SectionsPageClient'
import { getSections } from './actions'

export default async function SectionsPage() {
  // Fetch sections data on the server
  const result = await getSections()

  // Handle error or no data
  const initialSections = result.success && result.data ? result.data : []

  // Pass the data to the client component
  return <SectionsPageClient initialSections={initialSections} />
}
