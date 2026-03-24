import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import AdminLayout from '@/components/layout/AdminLayout'

// Auth pages
import Login from '@/pages/auth/Login'

// Role-redirect hub
import DashboardRedirect from '@/pages/DashboardRedirect'

// Student pages
import StudentTodayView from '@/pages/student/TodayView'

// Teacher pages
import TeacherDashboard from '@/pages/teacher/Dashboard'

// Help page
import HelpPage from '@/pages/HelpPage'

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard'
import CalendarManagement from '@/pages/admin/CalendarManagement'
import ActivityManagement from '@/pages/admin/ActivityManagement'
import UserManagement from '@/pages/admin/UserManagement'
import Reports from '@/pages/admin/Reports'
import OrgSettings from '@/pages/admin/OrgSettings'

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Dashboard redirect — sends to role-appropriate view */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardRedirect /></ProtectedRoute>
      } />

      {/* Student routes */}
      <Route path="/student" element={
        <ProtectedRoute requiredRole="student">
          <AppLayout>
            <StudentTodayView />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Teacher routes */}
      <Route path="/teacher" element={
        <ProtectedRoute requiredRole="teacher">
          <AppLayout>
            <TeacherDashboard />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Admin routes — nested under AdminLayout */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AppLayout>
            <AdminLayout />
          </AppLayout>
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="calendar" element={<CalendarManagement />} />
        <Route path="activities" element={<ActivityManagement />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<OrgSettings />} />
      </Route>

      {/* Help route — accessible to all authenticated users */}
      <Route path="/help" element={
        <ProtectedRoute>
          <AppLayout>
            <HelpPage />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
