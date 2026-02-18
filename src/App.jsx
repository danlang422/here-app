import { Routes, Route, Navigate } from 'react-router-dom'

// Auth
import ProtectedRoute from './components/layout/ProtectedRoute'

// Pages
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import AdminDashboard from './pages/AdminDashboard'

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      <Route path="/student" element={
        <ProtectedRoute><StudentDashboard /></ProtectedRoute>
      } />
      <Route path="/teacher" element={
        <ProtectedRoute><TeacherDashboard /></ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute><AdminDashboard /></ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
