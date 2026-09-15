import { useTranslation } from 'react-i18next'
import { CloudOff, X } from 'lucide-react'
import PaperPiece from './PaperPiece.jsx'
import { formatTime } from '../utils/time.js'

/**
 * 登出前的提醒 —— 只在離線打卡佇列還有未送出的紀錄時才由 Profile 叫出來。
 * 確認登出會連同佇列一起清掉（那些打卡屬於目前這位使用者，不能留給下一位）。
 */
export default function LogoutConfirmModal({ open, entries = [], onCancel, onConfirm }) {
  const { t, i18n } = useTranslation()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-slate-900/40 backdrop-blur-sm">
      <PaperPiece color="white" rotate="1.2deg" className="w-full max-w-md p-8 relative">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('common.close')}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div
            className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-3 shadow-sm"
            style={{ transform: 'rotate(5deg)' }}
          >
            <CloudOff size={22} className="text-amber-600" strokeWidth={2.5} />
          </div>
          <h2 className="font-zh text-xl font-black text-slate-700">{t('logoutConfirm.title')}</h2>
          {t('logoutConfirm.titleEn') && (
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
              {t('logoutConfirm.titleEn')}
            </p>
          )}
        </div>

        <div className="bg-amber-50 p-4 border-l-4 border-amber-400 flex gap-3 mb-5">
          <CloudOff size={18} className="text-amber-400 shrink-0" strokeWidth={2.5} />
          <p className="font-zh text-[11px] font-bold text-amber-700 leading-relaxed">
            {t('logoutConfirm.body', { count: entries.length })}
          </p>
        </div>

        <ul className="flex flex-col gap-2 mb-6">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b-2 border-slate-200"
            >
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                {entry.action === 'in' ? t('attendance.punchInCode') : t('attendance.punchOutCode')}
              </span>
              <span className="font-mono tabular-nums text-sm font-black text-slate-700">
                {formatTime(new Date(entry.clientTime), i18n.resolvedLanguage)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-full bg-emerald-500 border-b-4 border-emerald-700 p-4
                       active:border-b-0 active:translate-y-[2px] transition-transform"
          >
            <span className="font-zh text-sm font-black text-white tracking-wide">
              {t('logoutConfirm.stay')}
            </span>
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="w-full text-center text-slate-500 font-black text-xs uppercase tracking-widest
                       hover:text-red-500 active:scale-95 transition-all py-2"
          >
            {t('logoutConfirm.discard')}
          </button>
        </div>
      </PaperPiece>
    </div>
  )
}
