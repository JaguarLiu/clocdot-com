import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './hooks/useAuth.js'
import AdminLayout from './components/AdminLayout.jsx'

const Login = lazy(() => import('./pages/Login.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const MonthlyReport = lazy(() => import('./pages/MonthlyReport.jsx'))
const Corrections = lazy(() => import('./pages/Corrections.jsx'))
const LeaveReviews = lazy(() => import('./pages/LeaveReviews.jsx'))
const OvertimeReviews = lazy(() => import('./pages/OvertimeReviews.jsx'))
const Employees = lazy(() => import('./pages/Employees.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Payroll = lazy(() => import('./pages/Payroll.jsx'))
const Schedule = lazy(() => import('./pages/Schedule.jsx'))

function Loading() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f0e6]">
      <div className="font-zh text-slate-400 text-sm">{t('common.loading')}</div>
    </div>
  )
}

function AdminRoute({ children }) {
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

function ModuleRoute({ module, children }) {
  const { user, can } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!can(module)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="monthly-report" element={<ModuleRoute module="monthly-report"><MonthlyReport /></ModuleRoute>} />
          {/* 舊路徑導向整合後的報表 */}
          <Route path="attendance" element={<Navigate to="/monthly-report" replace />} />
          <Route path="settlement" element={<Navigate to="/monthly-report" replace />} />
          <Route path="corrections" element={<ModuleRoute module="corrections"><Corrections /></ModuleRoute>} />
          <Route path="leaves" element={<ModuleRoute module="leaves"><LeaveReviews /></ModuleRoute>} />
          <Route path="overtime-reviews" element={<ModuleRoute module="overtime-reviews"><OvertimeReviews /></ModuleRoute>} />
          <Route path="employees" element={<ModuleRoute module="employees"><Employees /></ModuleRoute>} />
          <Route path="schedule" element={<ModuleRoute module="schedule"><Schedule /></ModuleRoute>} />
          {/* 班別管理已整合進排班頁（modal），舊路徑導向 */}
          <Route path="shifts" element={<Navigate to="/schedule" replace />} />
          <Route path="payroll" element={<ModuleRoute module="payroll"><Payroll /></ModuleRoute>} />
          <Route path="settings" element={<ModuleRoute module="settings"><Settings /></ModuleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
