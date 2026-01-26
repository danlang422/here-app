import { getTeacherAgenda } from '@/lib/teacher/actions'
import TeacherAgendaClient from '@/components/teacher/TeacherAgendaClient'

export default async function TeacherAgendaPage() {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]
  
  // Fetch sections for today
  const sections = await getTeacherAgenda(today)

  return <TeacherAgendaClient initialDate={today} initialSections={sections} />
}
