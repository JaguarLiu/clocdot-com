import { useLocation, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import PaperPiece from './PaperPiece.jsx'
import BottomNav from './BottomNav.jsx'

const HEADER_TITLE_KEYS = {
  '/history': 'nav.historyTitle',
  '/correction': 'nav.correctionTitle',
  '/leave': 'nav.leaveTitle',
  '/overtime': 'nav.overtimeTitle',
  '/payslip': 'nav.payslipTitle',
  '/profile': 'nav.profileTitle',
}

export default function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useAuth()

  const titleKey = HEADER_TITLE_KEYS[location.pathname]
  const title = location.pathname === '/'
    ? t('nav.greeting', { name: user?.name || t('common.user') })
    : (titleKey ? t(titleKey) : 'ClocDot')

  return (
    <div className="min-h-screen bg-[#f3f0e6] flex justify-center items-start font-sans overflow-hidden text-slate-900">
      <div className="w-full max-w-md h-screen relative flex flex-col">
        {/* 筆記本橫線背景 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(120,100,70,0.1) 31px, rgba(120,100,70,0.1) 32px)',
            backgroundPosition: '0 80px',
          }}
        />

        {/* 頂部標籤 */}
        <header className="absolute top-0 left-0 w-full py-6 flex justify-center z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <PaperPiece color="white" rotate="-1.5deg" className="px-6 py-2 inline-flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <User size={16} className="text-sky-500" />
                )}
              </div>
              <span className="font-zh text-slate-700">{title}</span>
            </PaperPiece>
          </div>
        </header>

        {/* 內容區 */}
        <div className="flex-1 overflow-y-auto pb-24 pt-20 custom-scrollbar relative z-10 px-2">
          <Outlet />
        </div>

        <BottomNav />
      </div>
    </div>
  )
}
