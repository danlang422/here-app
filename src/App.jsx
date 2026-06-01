import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import AdminLayout from '@/components/layout/AdminLayout'
import PublicLayout from '@/components/layout/PublicLayout'
import RootRedirect from '@/components/layout/RootRedirect'

// Auth pages
import Login from '@/pages/auth/Login'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'

// Public pages
import TrustPage from '@/pages/public/TrustPage'
import AboutPage from '@/pages/public/AboutPage'

// Account page
import Account from '@/pages/Account'

// Role-redirect hub
import DashboardRedirect from '@/pages/DashboardRedirect'

// Student pages
import StudentTodayView from '@/pages/student/TodayView'

// Teacher pages
import TeacherDashboard from '@/pages/teacher/Dashboard'

// History page (role-dispatched)
import HistoryView from '@/pages/HistoryView'

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
      {/* Root — auth-aware: landing page for visitors, role redirect for authenticated users */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public pages */}
      <Route path="/trust" element={<PublicLayout><TrustPage /></PublicLayout>} />
      <Route path="/about" element={<PublicLayout><AboutPage /></PublicLayout>} />

      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

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

      {/* Account route — accessible to all authenticated users */}
      <Route path="/account" element={
        <ProtectedRoute>
          <AppLayout>
            <Account />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Help route — accessible to all authenticated users */}
      <Route path="/help" element={
        <ProtectedRoute>
          <AppLayout>
            <HelpPage />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* History route — role-dispatched to student or teacher view */}
      <Route path="/history" element={
        <ProtectedRoute>
          <AppLayout>
            <HistoryView />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
