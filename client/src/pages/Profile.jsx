import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, MapPin, Calendar, Settings, ChevronRight, History, KeyRound, Timer, Wallet, ClipboardCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useSWR from 'swr'
import { useAuth } from '../hooks/useAuth.js'
import { useAttendanceHistory } from '../hooks/useAttendance.js'
import PaperPiece from '../components/PaperPiece.jsx'
import ChangePasswordModal from '../components/ChangePasswordModal.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import { fetcher } from '../services/api.js'

function formatYMD(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function dayBefore(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString()
}

const menuItems = [
  { icon: Settings, textKey: 'profile.notificationSettings', color: 'text-slate-400', rotate: '0.8deg' },
]

export default function Profile() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showChangePassword, setShowChangePassword] = useState(false)

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const { records } = useAttendanceHistory({ month: currentMonth })

  const attendanceDays = records.filter(r => r.punchIn).length
  const lateOrEarlyCount = records.filter(r => r.isLate || r.isEarlyLeave).length

  const { data: balanceData } = useSWR('/leave-balances', fetcher)
  const annualEffective = balanceData?.yearStart
  const annualExpiry = dayBefore(balanceData?.yearEnd)

  return (
    <main className="w-full relative z-10 px-4 mt-4 animate-in slide-in-from-right-4 duration-300">
      <PaperPiece color="white" rotate="-1deg" className="p-6 mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-sky-100 border-4 border-sky-50 flex items-center justify-center shadow-inner overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <User size={40} className="text-sky-500" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-700">{user?.name || t('common.user')}</h2>
            {user?.empNo && <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('profile.empNo')}: {user.empNo}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-dashed border-slate-100 pt-4">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">{t('profile.monthlyAttendance')}</p>
            <p className="text-xl font-black text-slate-700">{t('common.daysValue', { value: attendanceDays })}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">{t('profile.lateEarly')}</p>
            <p className="text-xl font-black text-orange-500">{t('common.timesValue', { value: lateOrEarlyCount })}</p>
          </div>
        </div>

        {balanceData && user?.employmentType !== 'parttime' && (
          <div className="grid grid-cols-2 gap-4 border-t border-dashed border-slate-100 pt-4 mt-4">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">{t('profile.annualStart')}</p>
              <p className="text-sm font-black font-mono tabular-nums text-emerald-600">
                {formatYMD(annualEffective)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wider">{t('profile.annualEnd')}</p>
              <p className="text-sm font-black font-mono tabular-nums text-red-500">
                {formatYMD(annualExpiry)}
              </p>
            </div>
          </div>
        )}
      </PaperPiece>

      <div className="space-y-4 px-1 pb-10" style={{ marginTop: '30px' }}>
        <button type="button" onClick={() => navigate('/history')} className="w-full text-left active:scale-95 transition-transform">
          <PaperPiece color="white" rotate="-0.6deg" className="p-4 flex items-center justify-between ">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-sky-50 border border-sky-100">
                <History size={20} className="text-sky-500" />
              </div>
              <span className="font-black text-slate-600 tracking-wide">{t('history.title')}</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" aria-hidden="true" />
          </PaperPiece>
        </button>

        <button type="button" onClick={() => navigate('/leave?tab=list')} className="w-full text-left active:scale-95 transition-transform">
          <PaperPiece color="white" rotate="0.8deg" className="p-4 flex items-center justify-between ">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                <Calendar size={20} className="text-amber-500" />
              </div>
              <span className="font-black text-slate-600 tracking-wide">{t('profile.leaveList')}</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" aria-hidden="true" />
          </PaperPiece>
        </button>

        <button type="button" onClick={() => navigate('/overtime')} className="w-full text-left active:scale-95 transition-transform">
          <PaperPiece color="white" rotate="-0.5deg" className="p-4 flex items-center justify-between ">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                <Timer size={20} className="text-amber-500" />
              </div>
              <span className="font-black text-slate-600 tracking-wide">{t('overtime.title')}</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" aria-hidden="true" />
          </PaperPiece>
        </button>

        <button type="button" onClick={() => navigate('/payslip')} className="w-full text-left active:scale-95 transition-transform">
          <PaperPiece color="white" rotate="0.6deg" className="p-4 flex items-center justify-between ">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <Wallet size={20} className="text-emerald-500" />
              </div>
              <span className="font-black text-slate-600 tracking-wide">{t('nav.payslipTitle')}</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" aria-hidden="true" />
          </PaperPiece>
        </button>

        <button type="button" onClick={() => navigate('/approvals')} className="w-full text-left active:scale-95 transition-transform">
          <PaperPiece color="white" rotate="-0.4deg" className="p-4 flex items-center justify-between ">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-sky-50 border border-sky-100">
                <ClipboardCheck size={20} className="text-sky-500" />
              </div>
              <span className="font-black text-slate-600 tracking-wide">{t('approvals.title')}</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" aria-hidden="true" />
          </PaperPiece>
        </button>

        <button type="button" onClick={() => setShowChangePassword(true)} className="w-full text-left active:scale-95 transition-transform">
          <PaperPiece color="white" rotate="-0.8deg" className="p-4 flex items-center justify-between ">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-orange-50 border border-orange-100">
                <KeyRound size={20} className="text-orange-500" />
              </div>
              <span className="font-black text-slate-600 tracking-wide">{t('password.title')}</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" aria-hidden="true" />
          </PaperPiece>
        </button>

        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button type="button" key={item.textKey} aria-disabled="true" className="w-full text-left active:scale-95 transition-transform opacity-70">
              <PaperPiece
                color="white"
                rotate={item.rotate}
                className="p-4 flex items-center justify-between "
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <Icon size={20} className={item.color} />
                  </div>
                  <span className="font-black text-slate-600 tracking-wide">{t(item.textKey)}</span>
                </div>
                <ChevronRight size={18} className="text-slate-300" />
              </PaperPiece>
            </button>
          )
        })}

        <div className="flex items-center justify-between px-1 pt-2">
          <span className="font-black text-slate-500 text-[11px] uppercase tracking-widest">{t('common.language')}</span>
          <LanguageSwitcher />
        </div>

        <button
          type="button"
          onClick={() => { logout(); navigate('/login') }}
          className="w-full text-center mt-6 text-slate-500 font-black text-xs uppercase tracking-widest hover:text-red-500 transition-colors"
        >
          {t('profile.logout')}
        </button>
      </div>

      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </main>
  )
}
