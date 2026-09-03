import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History as HistoryIcon, ChevronDown, ArrowLeft, AlertCircle, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAttendanceHistory } from '../hooks/useAttendance.js'
import PaperPiece from '../components/PaperPiece.jsx'
import { weekdayNarrowNames } from '../utils/time.js'

/** 月份選單標籤：交給 Intl，避免硬編碼「N 月」 */
function monthNames(lang) {
  const fmt = new Intl.DateTimeFormat(lang, { month: 'long' })
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)))
}

// 同一頁多張紙片用不同方向旋轉，營造剪貼感（±1deg 內）
const rotations = ['-0.6deg', '0.5deg', '-0.4deg', '0.7deg', '-0.3deg', '0.8deg']

function formatTime(dateStr) {
  if (!dateStr) return '--:--'
  const d = new Date(dateStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDuration(minutes) {
  if (minutes == null) return '--'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function statusLabel(t, record) {
  if (record.isLate && record.isEarlyLeave) return t('history.lateAndEarly')
  if (record.isLate) return t('history.late')
  if (record.isEarlyLeave) return t('history.earlyLeave')
  return null
}

export default function History() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const months = monthNames(lang)
  const weekDays = weekdayNarrowNames(lang)
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear] = useState(now.getFullYear())
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const month = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
  const { records, isLoading } = useAttendanceHistory({ month })

  const navigate = useNavigate()

  return (
    <main className="w-full relative z-10 px-4 animate-in slide-in-from-bottom-4 duration-300 py-4">
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="flex items-center gap-2 mb-6 text-slate-400 hover:text-slate-600 transition-colors font-black text-xs uppercase tracking-widest"
      >
        <ArrowLeft size={16} /> {t('history.backToProfile')}
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <HistoryIcon size={24} className="text-sky-500" />
          <h3 className="font-zh text-2xl text-slate-700">{t('history.title')}</h3>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm text-[11px] font-black text-slate-500 tracking-tight flex items-center gap-1.5 hover:shadow-md transition-shadow"
          >
            {months[selectedMonth]}
            <ChevronDown size={12} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-xl border border-slate-100 shadow-lg py-2 z-30 w-28 max-h-52 overflow-y-auto">
              {months.map((label, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => { setSelectedMonth(index); setIsDropdownOpen(false) }}
                  className={`w-full text-left px-4 py-2 text-xs font-zh transition-colors
                    ${index === selectedMonth ? 'text-sky-500 bg-sky-50' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 每日紙片列表 */}
      <div className="pb-10 space-y-3">
        {isLoading ? (
          <p className="text-center text-slate-400 text-xs py-20 font-zh">{t('common.loading')}</p>
        ) : records.length === 0 ? (
          <div className="text-center py-20 opacity-40 flex flex-col items-center gap-2">
            <HistoryIcon size={40} className="text-slate-300" />
            <p className="font-zh text-xs text-slate-400">{t('history.emptyMonth')}</p>
          </div>
        ) : (
          records.map((record, index) => {
            const d = new Date(record.workDate)
            const mm = String(d.getMonth() + 1).padStart(2, '0')
            const dd = String(d.getDate()).padStart(2, '0')
            const day = weekDays[d.getDay()]

            const alertLabel = statusLabel(t, record)
            const isAlert = Boolean(alertLabel)
            const rotate = rotations[index % rotations.length]

            return (
              <PaperPiece
                key={record.id}
                color="white"
                rotate={rotate}
                className="p-4"
              >
                <div
                  className="flex items-center gap-4"
                  style={{
                    borderLeft: `4px solid ${isAlert ? '#ef4444' : '#e2e8f0'}`,
                    paddingLeft: '12px',
                    marginLeft: '-4px',
                  }}
                >
                  {/* 日期 */}
                  <div className="flex flex-col items-center min-w-[44px]">
                    <span className={`font-mono font-black text-lg leading-none tabular-nums ${isAlert ? 'text-red-500' : 'text-slate-700'}`}>
                      {dd}
                    </span>
                    <span className="font-mono text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                      {t('history.monthDay', { month: mm, day })}
                    </span>
                  </div>

                  {/* 時間 */}
                  <div className="flex-1 flex items-center gap-2 border-l border-dashed border-slate-100 pl-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono font-black text-sm tabular-nums ${isAlert ? 'text-red-600' : 'text-slate-700'}`}>
                        {formatTime(record.punchIn)}
                      </span>
                      <ArrowRight size={12} className="text-slate-300" strokeWidth={2.5} />
                      <span className={`font-mono font-black text-sm tabular-nums ${isAlert ? 'text-red-600' : 'text-slate-700'}`}>
                        {formatTime(record.punchOut)}
                      </span>
                    </div>
                  </div>

                  {/* 工時 / 異常標記 */}
                  <div className="flex flex-col items-end gap-1">
                    {isAlert ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-zh text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5">
                        <AlertCircle size={10} strokeWidth={2.5} />
                        {alertLabel}
                      </span>
                    ) : null}
                    <span className={`font-mono text-xs font-black tabular-nums px-1.5 py-0.5 rounded ${isAlert ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
                      {formatDuration(record.workDuration)}
                    </span>
                  </div>
                </div>
              </PaperPiece>
            )
          })
        )}
      </div>
    </main>
  )
}
