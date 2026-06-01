import { Navigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import StudentHistoryView from './student/HistoryView'
import TeacherHistoryView from './teacher/HistoryView'

function HistoryView() {
  const currentRole = useAuthStore((s) => s.currentRole)

  if (currentRole === 'student') return <StudentHistoryView />
  if (currentRole === 'teacher') return <TeacherHistoryView />
  return <Navigate to="/dashboard" replace />
}

export default HistoryView
