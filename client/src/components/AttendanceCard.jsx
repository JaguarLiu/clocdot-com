import { LogIn, LogOut, AlertCircle, Building2, MapPin, CircleHelp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import PaperPiece from './PaperPiece.jsx'

const locChip = {
  office:  { Icon: Building2, cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', labelKey: 'attendance.locOffice' },
  remote:  { Icon: MapPin,    cls: 'bg-sky-50 border-sky-200 text-sky-700',             labelKey: 'attendance.locRemote' },
  unknown: { Icon: CircleHelp, cls: 'bg-slate-50 border-slate-200 text-slate-500',       labelKey: 'attendance.locUnknown' },
}

export default function AttendanceCard({ type, time, note, borderColor, rotate = "0deg", isAlert = false, locationType }) {
  const { t } = useTranslation()
  const chip = locationType && locChip[locationType]
  const accent = isAlert ? '#ef4444' : borderColor

  return (
    <div className="relative w-full px-4 mb-4">
      {/* 頂部模擬膠帶裝飾 */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-5 z-20 border bg-white/40 border-white/20 backdrop-blur-[1px]"
        style={{ transform: `rotate(${rotate}) rotate(-3deg)`, boxShadow: '1px 1px 2px rgba(0,0,0,0.02)' }}
      />
      <PaperPiece
        color="white"
        rotate={rotate}
        className="p-4 transition-transform active:scale-95"
      >
        <div className="flex items-center gap-4 pl-2" style={{ borderLeft: `8px solid ${accent}` }}>
          <div className="flex flex-col items-center justify-center min-w-[50px] pl-2">
            {type === 'in' ? (
              <LogIn size={22} className={isAlert ? 'text-red-500' : 'text-emerald-500'} />
            ) : (
              <LogOut size={22} className={isAlert ? 'text-red-500' : 'text-orange-500'} />
            )}
            <span className={`text-[9px] font-black uppercase tracking-tighter mt-1 ${isAlert ? 'text-red-400' : 'text-slate-500'}`}>
              {type === 'in'
                ? (isAlert ? t('attendance.stampLate') : t('attendance.stampStarted'))
                : (isAlert ? t('attendance.stampEarly') : t('attendance.stampFinished'))}
            </span>
          </div>

          <div className={`flex-1 border-l border-dashed pl-4 ${isAlert ? 'border-red-100' : 'border-slate-100'}`}>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl font-black font-mono tracking-tight ${isAlert ? 'text-red-600' : 'text-slate-700'}`}>{time}</span>
              <span className={`text-[11px] font-zh ${isAlert ? 'text-red-400' : 'text-slate-400'}`}>
                {type === 'in' ? t('attendance.punchIn') : t('attendance.punchOut')}
                {isAlert && (type === 'in' ? ` (${t('history.late')})` : ` (${t('history.earlyLeave')})`)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <p className={`text-[12px] font-zh line-clamp-1 ${isAlert ? 'text-red-400' : 'text-slate-400'}`}>
                {note}
              </p>
              {chip && (
                <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.15em] border px-1.5 py-0.5 rounded-full ${chip.cls}`}>
                  <chip.Icon size={9} strokeWidth={3} />
                  {t(chip.labelKey)}
                </span>
              )}
            </div>
          </div>

          {isAlert && <AlertCircle size={16} className="text-red-400 opacity-50" />}
        </div>
      </PaperPiece>
    </div>
  )
}
