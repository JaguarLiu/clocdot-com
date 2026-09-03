import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogIn, ClipboardPen, CalendarPlus, User } from 'lucide-react'

const tabs = [
  { path: '/',           icon: LogIn,         labelKey: 'nav.punch',      activeColor: 'text-emerald-500', barColor: 'bg-emerald-500' },
  { path: '/correction', icon: ClipboardPen,  labelKey: 'nav.correction', activeColor: 'text-orange-500',  barColor: 'bg-orange-500' },
  { path: '/leave',      icon: CalendarPlus,  labelKey: 'nav.leave',      activeColor: 'text-sky-500',     barColor: 'bg-sky-500' },
  { path: '/profile',    icon: User,          labelKey: 'nav.profile',    activeColor: 'text-slate-600',   barColor: 'bg-slate-500' },
]

export default function BottomNav() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      aria-label={t('nav.mainNavAria')}
      className="fixed bottom-0 left-0 w-full z-50 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-slate-100"
    >
      <div className="max-w-md mx-auto flex items-center justify-between px-2 h-20">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path
          const Icon = tab.icon
          const label = t(tab.labelKey)
          return (
            <button
              type="button"
              key={tab.path}
              onClick={() => navigate(tab.path)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center h-full transition-all duration-300 ${isActive ? tab.activeColor : 'text-slate-400'}`}
            >
              <Icon size={26} strokeWidth={isActive ? 3 : 2} aria-hidden="true" />
              <span className="font-zh text-[11px] mt-1">{label}</span>
              <div
                className={`w-6 h-[3px] rounded-full mt-1 transition-all ${isActive ? `${tab.barColor} opacity-100` : 'bg-transparent opacity-0'}`}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
