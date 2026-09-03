import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileSpreadsheet, CheckCircle2, CalendarCheck, Building2, Users, LogOut, User, KeyRound, MessageSquareWarning, Timer, Wallet, CalendarDays, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import ChangePasswordModal from './ChangePasswordModal.jsx'
import IssueReportModal from './IssueReportModal.jsx'
import PaperPiece from './PaperPiece.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'

const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', accent: 'emerald', module: 'dashboard' },
  { path: '/monthly-report', icon: FileSpreadsheet, labelKey: 'nav.monthlyReport', accent: 'emerald', module: 'monthly-report' },
  { path: '/corrections', icon: CheckCircle2, labelKey: 'nav.corrections', accent: 'orange', module: 'corrections' },
  { path: '/leaves', icon: CalendarCheck, labelKey: 'nav.leaves', accent: 'amber', module: 'leaves' },
  { path: '/overtime-reviews', icon: Timer, labelKey: 'nav.overtimeReviews', accent: 'amber', module: 'overtime-reviews' },
  { path: '/employees', icon: Users, labelKey: 'nav.employees', accent: 'emerald', module: 'employees' },
  { path: '/schedule', icon: CalendarDays, labelKey: 'nav.schedule', accent: 'emerald', module: 'schedule' },
  { path: '/payroll', icon: Wallet, labelKey: 'nav.payroll', accent: 'emerald', module: 'payroll' },
  { path: '/settings', icon: Building2, labelKey: 'nav.settings', accent: 'sky', module: 'settings' },
]

const accentMap = {
  emerald: { bar: 'bg-emerald-500', text: 'text-emerald-600', hover: 'group-hover:text-emerald-600', soft: 'bg-emerald-50' },
  sky:     { bar: 'bg-sky-500',     text: 'text-sky-600',     hover: 'group-hover:text-sky-600',     soft: 'bg-sky-50' },
  orange:  { bar: 'bg-orange-500',  text: 'text-orange-600',  hover: 'group-hover:text-orange-600',  soft: 'bg-orange-50' },
  amber:   { bar: 'bg-amber-500',   text: 'text-amber-600',   hover: 'group-hover:text-amber-600',   soft: 'bg-amber-50' },
}

export default function Sidebar({ mobile = false, onNavigate }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, can } = useAuth()
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showIssueReport, setShowIssueReport] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`${mobile ? 'fixed inset-y-0 left-0 z-10 shadow-2xl' : 'relative z-20'} w-72 h-dvh max-w-[85vw] shrink-0 flex flex-col`}>
      {/* 紙張質感底色 — 比主內容區略深一點 */}
      <div className="absolute inset-0 bg-[#ece7d5] border-r border-slate-300/40" />

      <div className="relative flex flex-col h-full">
        {mobile && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onNavigate}
            className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X size={22} aria-hidden="true" />
          </button>
        )}

        {/* Logo 紙片 — 撕邊 */}
        <div className="px-6 pt-8 pb-6">
          <PaperPiece color="#ffffff" rotate="-1.5deg" variant="scrap" className="inline-block px-5 py-3">
            <div className="flex items-center gap-3">
              <img
                src="/admin.png"
                alt="ClocDot Admin"
                width="36"
                height="36"
                className="w-9 h-9 object-contain shrink-0"
                style={{ transform: 'rotate(2deg)' }}
              />
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-800 leading-none">ClocDot</h1>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
                  {t('nav.adminConsole')}
                </p>
              </div>
            </div>
          </PaperPiece>
        </div>

        {/* 導覽 — 每個 item 是一張獨立撕邊紙片 */}
        <nav aria-label="Admin navigation" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-2 space-y-2.5">
          {navItems.filter((item) => can(item.module)).map((item, idx) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            const accent = accentMap[item.accent]
            // 每張紙片極細微的不同旋轉，active 歸正
            const rotate = isActive ? '0deg' : `${idx % 2 === 0 ? '-0.5' : '0.4'}deg`
            const paperColor = isActive ? '#ffffff' : '#f6f1e1'

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full block text-left group active:scale-[0.98] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  isActive ? '' : 'hover:-translate-y-[1px]'
                }`}
              >
                <PaperPiece
                  color={paperColor}
                  rotate={rotate}
                  variant="card"
                  className={`flex items-center gap-3 pl-4 pr-4 py-3 transition-colors ${
                    isActive ? accent.text : `text-slate-500 ${accent.hover}`
                  }`}
                >
                  <div className={`w-1 h-6 rounded-full transition-colors ${isActive ? accent.bar : 'bg-transparent'}`} />
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                  <span className="font-zh text-sm">{t(item.labelKey)}</span>
                </PaperPiece>
              </Link>
            )
          })}
        </nav>

        {/* 問題回報 — 使用者卡片上方的低調連結 */}
        <div className="px-6 pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setShowIssueReport(true)}
            className="inline-flex items-center gap-1.5 text-[10px] font-zh text-slate-400 hover:text-slate-600 underline decoration-dashed decoration-slate-300 underline-offset-4 active:scale-[0.97] transition-colors"
          >
            <MessageSquareWarning size={12} strokeWidth={2.5} />
            {t('issue.reportLink')}
          </button>
        </div>

        {/* 使用者卡片 — 撕邊紙片 */}
        <div className="px-4 pb-6 pt-4">
          <div style={{ maxWidth: '260px' }}>
          <PaperPiece color="#ffffff" rotate="0.6deg" variant="scrap" className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-sky-100 border-2 border-sky-50 flex items-center justify-center overflow-hidden shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <User size={16} className="text-sky-500" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-zh text-sm text-slate-700 truncate">{user?.name || t('common.admin')}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate overflow-hidden">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">{t('common.language')}</span>
              <LanguageSwitcher />
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className="w-full block text-left active:scale-[0.97] transition-transform group"
              >
                <PaperPiece
                  color="#fffbeb"
                  rotate="-0.4deg"
                  variant="card"
                  className="flex items-center justify-center gap-2 px-3 py-2 text-slate-500 group-hover:text-amber-600 font-black text-[10px] uppercase tracking-[0.2em]"
                >
                  <KeyRound size={12} strokeWidth={2.5} />
                  {t('password.title')}
                </PaperPiece>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full block text-left active:scale-[0.97] transition-transform group"
              >
                <PaperPiece
                  color="#fef2f2"
                  rotate="0.4deg"
                  variant="card"
                  className="flex items-center justify-center gap-2 px-3 py-2 text-slate-500 group-hover:text-red-500 font-black text-[10px] uppercase tracking-[0.2em]"
                >
                  <LogOut size={12} strokeWidth={2.5} />
                  {t('common.logout')}
                </PaperPiece>
              </button>
            </div>
          </PaperPiece>
          </div>
        </div>
      </div>

      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
      <IssueReportModal key={showIssueReport ? 'open' : 'closed'} open={showIssueReport} onClose={() => setShowIssueReport(false)} />
    </aside>
  )
}
