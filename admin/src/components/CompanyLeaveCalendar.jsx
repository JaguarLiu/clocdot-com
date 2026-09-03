import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import useSWR from 'swr'
import { fetcher, getHolidays } from '../services/api.js'
import PaperPiece from './PaperPiece.jsx'
import { LEAVE_TYPES, leaveTypeLabel } from '../utils/leaveTypes.js'
import { weekdayNarrowNames, formatYearMonth } from '../lib/datetime.js'

// 5-colour semantic system for calendar leave types
// 藍請假 as the general colour; specific types mapped to palette
const LEAVE_TYPE_COLOR = {
  annual:       'bg-sky-100 text-sky-700 border-sky-200',
  personal:     'bg-orange-100 text-orange-700 border-orange-200',
  sick:         'bg-red-100 text-red-700 border-red-200',
  menstrual:    'bg-red-50 text-red-600 border-red-100',
  marriage:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  bereavement:  'bg-slate-100 text-slate-600 border-slate-200',
  maternity:    'bg-sky-200 text-sky-800 border-sky-300',
  paternity:    'bg-sky-100 text-sky-700 border-sky-200',
  official:     'bg-amber-100 text-amber-700 border-amber-200',
  compensatory: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  _default:     'bg-sky-100 text-sky-700 border-sky-200',
}

function toYMD(dateStr) {
  if (!dateStr) return ''
  return dateStr.slice(0, 10)
}

// first/last day of a month: returns 'YYYY-MM-DD' strings
function monthBounds(year, month) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    from: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`,
    to:   `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
  }
}

// 全公司請假行事曆（含假別）。獨立元件，供 Dashboard / 審核頁共用。
export default function CompanyLeaveCalendar() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const WEEK_DAYS = weekdayNarrowNames(lang)
  const today = new Date()
  const [calYear,  setCalYear]  = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth()) // 0-indexed

  const { from, to } = monthBounds(calYear, calMonth)
  const { data: events } = useSWR(`/admin/leave-calendar?from=${from}&to=${to}`, fetcher)
  const { data: holidays } = useSWR(`/holidays?from=${from}&to=${to}`, () => getHolidays(from, to))

  // 國定假日：day(數字) -> 假日名稱
  const holidayByDay = useMemo(() => {
    const m = {}
    for (const h of holidays ?? []) m[Number(h.date.slice(8, 10))] = h.name
    return m
  }, [holidays])

  const firstOfMonth = new Date(calYear, calMonth, 1)
  const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate()
  const startWeekday = firstOfMonth.getDay() // 0=Sun

  // For each calendar day, collect events whose range includes it
  const dayEvents = useMemo(() => {
    const map = {}
    if (!events) return map
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      map[d] = (events || []).filter((ev) => {
        const evStart = toYMD(ev.startDate)
        const evEnd   = toYMD(ev.endDate)
        return dateStr >= evStart && dateStr <= evEnd
      })
    }
    return map
  }, [events, calYear, calMonth, daysInMonth])

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  // Build grid cells (leading blanks + days)
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isToday = (d) =>
    d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-sky-500 shadow-sm" style={{ transform: 'rotate(-2deg)' }}>
          <CalendarCheck size={18} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-xl font-zh text-slate-800">{t('calendar.title')}</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-0.5">
            {t('calendar.titleEn')}
          </p>
        </div>
      </div>

      <PaperPiece color="white" rotate="-0.2deg" variant="card" className="p-6">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 text-slate-400 hover:text-slate-600 active:scale-95 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-zh font-black text-slate-700 text-base">
            {formatYearMonth(new Date(calYear, calMonth, 1), lang)}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 text-slate-400 hover:text-slate-600 active:scale-95 transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-1">
          {WEEK_DAYS.map((wd) => (
            <div key={wd} className="text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] py-1">
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`blank-${i}`} />
            const evs = dayEvents[day] || []
            const todayMark = isToday(day)
            const holidayName = holidayByDay[day]
            const isHol = !!holidayName
            return (
              <div
                key={day}
                className={`min-h-[72px] px-1.5 py-1.5 border-b border-dashed border-slate-100
                            ${todayMark ? 'bg-amber-50/60' : isHol ? 'bg-red-50/40' : ''}`}
              >
                <span className={`text-[11px] font-mono font-black tabular-nums
                                  ${todayMark
                                    ? 'inline-flex w-5 h-5 items-center justify-center rounded-full bg-amber-400 text-white text-[10px]'
                                    : isHol ? 'text-red-500' : 'text-slate-400'}`}>
                  {day}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {isHol && (
                    <div
                      className="text-[9px] font-zh px-1 py-0.5 truncate border bg-red-100 text-red-600 border-red-200"
                      style={{ borderRadius: '2px' }}
                      title={holidayName}
                    >
                      {holidayName}
                    </div>
                  )}
                  {evs.slice(0, 3).map((ev, ei) => {
                    const colorClass = LEAVE_TYPE_COLOR[ev.leaveType] || LEAVE_TYPE_COLOR._default
                    const typeLabel = leaveTypeLabel(t, ev.leaveType)
                    return (
                      <div
                        key={`${ev.userId}-${ei}`}
                        className={`text-[9px] font-zh px-1 py-0.5 truncate border ${colorClass}`}
                        style={{ borderRadius: '2px' }}
                        title={`${ev.name} — ${typeLabel}`}
                      >
                        {ev.name}
                      </div>
                    )
                  })}
                  {evs.length > 3 && (
                    <div className="text-[9px] font-mono text-slate-400 pl-1">+{evs.length - 3}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 text-[9px] font-zh px-2 py-0.5 border bg-red-100 text-red-600 border-red-200"
                style={{ borderRadius: '2px' }}>
            {t('calendar.publicHoliday')}
          </span>
          {LEAVE_TYPES.slice(0, 6).map(({ value }) => {
            const colorClass = LEAVE_TYPE_COLOR[value] || LEAVE_TYPE_COLOR._default
            return (
              <span key={value} className={`inline-flex items-center gap-1 text-[9px] font-zh px-2 py-0.5 border ${colorClass}`}
                    style={{ borderRadius: '2px' }}>
                {leaveTypeLabel(t, value)}
              </span>
            )
          })}
        </div>
      </PaperPiece>
    </div>
  )
}
