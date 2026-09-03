import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './hooks/useAuth.js'
import AppLayout from './components/AppLayout.jsx'
import InstallPromptDialog from './components/InstallPromptDialog.jsx'

const Login = lazy(() => import('./pages/Login.jsx'))
const Attendance = lazy(() => import('./pages/Attendance.jsx'))
const History = lazy(() => import('./pages/History.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const Correction = lazy(() => import('./pages/Correction.jsx'))
const LeaveRequest = lazy(() => import('./pages/LeaveRequest.jsx'))
const Overtime = lazy(() => import('./pages/Overtime.jsx'))
const Payslip = lazy(() => import('./pages/Payslip.jsx'))
const Approvals = lazy(() => import('./pages/Approvals.jsx'))

function Loading() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f0e6]">
      <div className="text-slate-400 text-sm font-medium">{t('common.loading')}</div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <InstallPromptDialog />
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Attendance />} />
          <Route path="history" element={<History />} />
          <Route path="correction" element={<Correction />} />
          <Route path="leave" element={<LeaveRequest />} />
          <Route path="overtime" element={<Overtime />} />
          <Route path="payslip" element={<Payslip />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
