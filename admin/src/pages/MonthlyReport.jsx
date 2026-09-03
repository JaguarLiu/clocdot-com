import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatYearMonth, monthNames } from '../lib/datetime.js'
import { leaveTypeLabel } from '../utils/leaveTypes.js'
import { FileSpreadsheet, Download, Inbox, ChevronDown, ChevronRight, User } from 'lucide-react'
import useSWR from 'swr'
import { getSettlement, getAdminAttendanceList, getAdminYearlyAttendance, downloadSettlementCSV, downloadAttendanceCSV } from '../services/api.js'
import PaperPiece from '../components/PaperPiece.jsx'
import PaperToast from '../components/PaperToast.jsx'
import ComplianceBadge from '../components/ComplianceBadge.jsx'

const VIEWS = [
  { key: 'settlement', labelKey: 'report.tabSettlement', accent: 'emerald' },
  { key: 'attendance', labelKey: 'report.tabAttendance', accent: 'sky' },
  { key: 'yearly', labelKey: 'report.tabYearly', accent: 'amber' },
]

const VIEW_ACCENT = {
  emerald: 'text-emerald-600 bg-white shadow-md',
  sky: 'text-sky-600 bg-white shadow-md',
  amber: 'text-amber-600 bg-white shadow-md',
}

// 值為 i18n key；數值倍率本身不隨語系變動
const RATE_LABEL = {
  '1.34': 'report.rate134', '1.67': 'report.rate167', '2.67': 'report.rate267',
  holiday: 'overtime.rateHoliday', regular_leave: 'overtime.dayType.regular_leave',
}
const RATE_SHORT_FIXED = { '1.34': '×1.34', '1.67': '×1.67', '2.67': '×2.67' }
const RATE_SHORT_KEY = { holiday: 'overtime.rateHoliday', regular_leave: 'overtime.dayType.regular_leave' }

function rateShort(t, rate) {
  if (RATE_SHORT_FIXED[rate]) return RATE_SHORT_FIXED[rate]
  if (RATE_SHORT_KEY[rate]) return t(RATE_SHORT_KEY[rate])
  return rate
}

function buildMonthOptions(lang) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = formatYearMonth(d, lang)
    return { value, label }
  })
}

function buildYearOptions() {
  const thisYear = new Date().getFullYear()
  return Array.from({ length: 4 }, (_, i) => {
    const y = thisYear - i
    return { value: y, label: String(y) }
  })
}

function toHours(minutes) {
  return ((minutes ?? 0) / 60).toFixed(1)
}

function leaveByTypeText(t, byType) {
  const entries = Object.entries(byType || {})
  if (entries.length === 0) return '—'
  return entries.map(([type, n]) => `${leaveTypeLabel(t, type)} ${n}`).join(' / ')
}

export default function MonthlyReport() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const monthOptions = useMemo(() => buildMonthOptions(lang), [lang])
  const yearOptions = useMemo(() => buildYearOptions(), [])
  const [month, setMonth] = useState(monthOptions[0].value)
  const [year, setYear] = useState(yearOptions[0].value)
  const [view, setView] = useState('settlement')
  const [expanded, setExpanded] = useState(null)
  const [toast, setToast] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const isYearly = view === 'yearly'
  const { data: settleData, isLoading: settleLoading } = useSWR(`/admin/settlement?month=${month}`, () => getSettlement(month))
  const { data: attData, isLoading: attLoading } = useSWR(`/admin/attendance?month=${month}`, () => getAdminAttendanceList(month))
  const { data: yearlyData, isLoading: yearlyLoading } = useSWR(
    isYearly ? `/admin/attendance/yearly?year=${year}` : null,
    () => getAdminYearlyAttendance(year),
  )

  // settlement 為主清單（全體員工）；attendance 以 userId 建 map 供合併
  const rows = useMemo(() => settleData ?? [], [settleData])
  const attByUser = useMemo(() => {
    const m = {}
    for (const r of attData ?? []) if (r.user?.id) m[r.user.id] = r
    return m
  }, [attData])

  const rates = useMemo(() => {
    const set = new Set()
    for (const r of rows) for (const k of Object.keys(r.overtimeByRate || {})) set.add(k)
    return [...set].sort()
  }, [rows])

  const isLoading = isYearly ? yearlyLoading : (settleLoading || attLoading)

  async function handleDownload(kind) {
    setExportOpen(false)
    setDownloading(true)
    try {
      if (kind === 'settlement') await downloadSettlementCSV(month)
      else await downloadAttendanceCSV(month)
    } catch (err) {
      setToast({ variant: 'error', message: err?.message || t('common.errExportFailed') })
    } finally {
      setDownloading(false)
    }
  }

  function toggleRow(userId) {
    setExpanded((prev) => (prev === userId ? null : userId))
  }

  // 依視圖決定欄位標題（員工欄固定為第一欄）
  const headers = view === 'settlement'
    ? [t('schedule.employeeCol'), t('report.hExpectedDays'), t('report.hExpectedHours'), t('report.hActualDays'), t('report.hActualHours'), t('report.colLate'), t('report.colEarly'), t('report.hAbsent'), t('report.hLeaveHours'), ...rates.map((r) => (RATE_LABEL[r] ? t(RATE_LABEL[r]) : r))]
    : [t('schedule.employeeCol'), t('report.colDays'), t('report.colHours'), t('report.hLateDays'), t('report.hEarlyDays'), t('report.hAbsentDays'), t('report.hLeaveDays'), t('attendance.locOffice'), t('attendance.locRemote')]

  return (
    <div className="animate-in fade-in duration-300">
      {toast && <PaperToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}

      {/* 標題列 + 控制 */}
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500 shadow-sm" style={{ transform: 'rotate(-3deg)' }}>
            <FileSpreadsheet size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-3xl font-zh text-slate-800">{t('nav.monthlyReport')}</h2>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
              Reports
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            {isYearly ? (
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                aria-label={t('report.selectYear')}
                className="appearance-none bg-white px-4 py-2 pr-8 border border-slate-200 shadow-sm text-xs font-black text-slate-600 tracking-tight focus:outline-none"
              >
                {yearOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <select
                value={month}
                onChange={(e) => { setMonth(e.target.value); setExpanded(null) }}
                aria-label={t('common.selectMonth')}
                className="appearance-none bg-white px-4 py-2 pr-8 border border-slate-200 shadow-sm text-xs font-black text-slate-600 tracking-tight focus:outline-none"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          </div>

          {/* 匯出 ▾ — 直角 neobrutalism + 下拉兩選項（僅月度視圖） */}
          {!isYearly && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              disabled={downloading}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              className="relative group active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="absolute inset-0 bg-emerald-700 translate-y-[3px]" />
              <div className="relative bg-emerald-500 text-white px-5 py-2.5 flex items-center gap-2 font-zh text-sm group-hover:-translate-y-[1px] transition-transform">
                <Download size={16} strokeWidth={2.5} />
                {downloading ? t('report.exporting') : t('report.export')}
                <ChevronDown size={14} strokeWidth={2.5} />
              </div>
            </button>
            {exportOpen && (
              <>
                <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setExportOpen(false)} />
                <div role="menu" className="absolute right-0 mt-2 z-20 bg-white border border-slate-200 shadow-lg min-w-[160px]">
                  <button type="button" role="menuitem" onClick={() => handleDownload('attendance')} className="w-full text-left px-4 py-2.5 font-zh text-sm text-slate-600 hover:bg-sky-50 hover:text-sky-600 transition-colors active:scale-[0.98]">
                    {t('report.exportDaily')}
                  </button>
                  <div className="border-t border-dashed border-slate-200" />
                  <button type="button" role="menuitem" onClick={() => handleDownload('settlement')} className="w-full text-left px-4 py-2.5 font-zh text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors active:scale-[0.98]">
                    {t('report.exportSettlement')}
                  </button>
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>

      {/* 視圖切換 — 檔案夾 tab (§3.3) */}
      <div className="flex items-end gap-1 mb-6 border-b-2 border-slate-200/60">
        {VIEWS.map((v, idx) => {
          const isActive = view === v.key
          const rotate = isActive ? '0deg' : `${idx % 2 === 0 ? '-0.5' : '0.5'}deg`
          return (
            <button
              type="button"
              key={v.key}
              onClick={() => { setView(v.key); setExpanded(null) }}
              aria-pressed={isActive}
              className={`px-6 py-3 font-zh text-sm transition-all relative
                ${isActive ? VIEW_ACCENT[v.accent] : 'text-slate-400 bg-white/40 hover:bg-white/70 hover:text-slate-600'}`}
              style={{
                transform: `rotate(${rotate})`,
                borderRadius: '10px 10px 0 0',
                border: '1px solid rgba(0,0,0,0.06)',
                borderBottom: isActive ? 'none' : '1px solid rgba(0,0,0,0.06)',
                marginBottom: isActive ? '-2px' : '0',
              }}
            >
              {t(v.labelKey)}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <p className="text-center text-slate-400 text-sm py-24 font-zh">{t('common.loading')}</p>
      ) : isYearly ? (
        (yearlyData ?? []).length === 0 ? (
          <div className="text-center py-24 opacity-40 flex flex-col items-center gap-3">
            <Inbox size={48} className="text-slate-300" />
            <p className="font-zh text-sm text-slate-400">{t('report.emptyYear')}</p>
          </div>
        ) : (
          <YearlyTable rows={yearlyData} />
        )
      ) : rows.length === 0 ? (
        <div className="text-center py-24 opacity-40 flex flex-col items-center gap-3">
          <Inbox size={48} className="text-slate-300" />
          <p className="font-zh text-sm text-slate-400">{t('report.emptyMonth')}</p>
        </div>
      ) : (
        <PaperPiece variant="card" rotate="-0.2deg" className="shadow-md overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-dashed border-slate-200">
                {headers.map((h, i) => (
                  <th key={h} className={`px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] whitespace-nowrap ${i === 0 ? 'text-left' : 'text-center'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const att = attByUser[r.userId]
                const isOpen = expanded === r.userId
                return (
                  <RowGroup
                    key={r.userId}
                    r={r}
                    att={att}
                    view={view}
                    rates={rates}
                    isOpen={isOpen}
                    colSpan={headers.length}
                    onToggle={() => toggleRow(r.userId)}
                  />
                )
              })}
            </tbody>
          </table>
        </PaperPiece>
      )}
    </div>
  )
}

// 年度出勤統計 — 12 個月出勤天數矩陣 + 年度合計
function YearlyTable({ rows }) {
  const { t, i18n } = useTranslation()
  const monthHeaders = monthNames(i18n.resolvedLanguage)
  return (
    <div>
      <p className="font-zh text-[11px] text-slate-400 mb-2">{t('report.yearlyHint')}</p>
      <PaperPiece variant="card" rotate="-0.2deg" className="shadow-md overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-dashed border-slate-200">
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] whitespace-nowrap text-left">
                {t('schedule.employeeCol')}
              </th>
              {monthHeaders.map((h) => (
                <th key={h} className="px-2.5 py-4 text-[10px] font-black text-slate-400 tracking-[0.1em] whitespace-nowrap text-center">
                  {h}
                </th>
              ))}
              {[t('report.colDays'), t('report.colHours'), t('report.colLate'), t('report.colEarly'), t('report.colLeave')].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] whitespace-nowrap text-center ${i === 0 ? 'border-l border-dashed border-slate-200' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rowIdx) => (
              <tr
                key={r.user?.id ?? rowIdx}
                className={`hover:bg-slate-50/60 transition-colors ${rowIdx === rows.length - 1 ? '' : 'border-b border-dashed border-slate-100'}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-amber-50 flex items-center justify-center shrink-0">
                      <User size={13} className="text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-zh text-sm text-slate-700 truncate">{r.user?.name || '--'}</p>
                      <p className="text-[10px] font-black text-slate-400 tabular-nums">#{r.user?.empNo ?? '—'}</p>
                    </div>
                  </div>
                </td>
                {r.months.map((m, i) => (
                  <td key={i} className="px-2.5 py-3 text-center">
                    <span className={`font-mono font-black text-sm tabular-nums ${m.attendanceDays ? 'text-slate-700' : 'text-slate-300'}`}>
                      {m.attendanceDays}
                    </span>
                  </td>
                ))}
                <td className="px-4 py-3 text-center border-l border-dashed border-slate-200">
                  <span className="font-mono font-black text-sm tabular-nums text-emerald-600">{r.totals.attendanceDays}</span>
                </td>
                <Num value={toHours(r.totals.totalWorkDuration)} />
                <Num value={r.totals.lateDays} tone={r.totals.lateDays ? 'red' : 'mute'} />
                <Num value={r.totals.earlyLeaveDays} tone={r.totals.earlyLeaveDays ? 'red' : 'mute'} />
                <Num value={r.totals.leaveDays} tone={r.totals.leaveDays ? 'sky' : 'mute'} />
              </tr>
            ))}
          </tbody>
        </table>
      </PaperPiece>
    </div>
  )
}

function RowGroup({ r, att, view, rates, isOpen, colSpan, onToggle }) {
  const { t } = useTranslation()
  return (
    <>
      <tr
        className={`border-b border-dashed border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer ${isOpen ? 'bg-slate-50/60' : ''}`}
        onClick={onToggle}
      >
        {/* 員工（含展開 chevron） */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ChevronRight size={15} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
            <div className="w-8 h-8 rounded-full bg-sky-100 border-2 border-sky-50 flex items-center justify-center shrink-0 overflow-hidden">
              {r.avatar ? (
                <img src={r.avatar} alt={r.name || ''} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <User size={13} className="text-sky-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-zh text-sm text-slate-700 truncate">{r.name || '--'}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-black text-slate-400 tabular-nums">#{r.empNo ?? '—'}</p>
                {view === 'settlement' && <ComplianceBadge status={r.compliance?.status} />}
              </div>
            </div>
          </div>
        </td>

        {view === 'settlement' ? (
          <>
            <Num value={r.expectedWorkdays} />
            <Num value={toHours(r.expectedMinutes)} />
            <Num value={r.actualWorkdays} tone="emerald" />
            <Num value={toHours(r.actualMinutes)} />
            <Num value={r.lateCount} tone={r.lateCount ? 'red' : 'mute'} />
            <Num value={r.earlyLeaveCount} tone={r.earlyLeaveCount ? 'red' : 'mute'} />
            <Num value={r.absenceDays ?? 0} tone={r.absenceDays ? 'red' : 'mute'} />
            <Num value={toHours(r.leaveMinutes)} tone="sky" />
            {rates.map((rate) => {
              const mins = r.overtimeByRate?.[rate] ?? 0
              return <Num key={rate} value={mins ? toHours(mins) : '0'} tone={mins ? 'amber' : 'mute'} />
            })}
          </>
        ) : (
          <>
            <Num value={att?.attendanceDays ?? 0} />
            <Num value={toHours(att?.totalWorkDuration)} tone="emerald" />
            <Num value={att?.lateDays ?? 0} tone={att?.lateDays ? 'red' : 'mute'} />
            <Num value={att?.earlyLeaveDays ?? 0} tone={att?.earlyLeaveDays ? 'red' : 'mute'} />
            <Num value={r.absenceDays ?? 0} tone={r.absenceDays ? 'red' : 'mute'} />
            <td className="px-4 py-3 text-center">
              {att?.leaveDays ? (
                <span title={leaveByTypeText(t, att?.leaveByType)} className="inline-block font-mono font-black text-sm text-sky-600 bg-sky-50 px-2 py-0.5 rounded tabular-nums cursor-help">
                  {att.leaveDays}
                </span>
              ) : (
                <span className="font-mono font-black text-sm text-slate-300 tabular-nums">0</span>
              )}
            </td>
            <Num value={att?.officeDays ?? 0} tone={att?.officeDays ? 'emerald' : 'mute'} />
            <Num value={att?.remoteDays ?? 0} tone={att?.remoteDays ? 'sky' : 'mute'} />
          </>
        )}
      </tr>

      {isOpen && (
        <tr className="bg-slate-50/40">
          <td colSpan={colSpan} className="px-5 py-4">
            <PersonDetail r={r} att={att} rates={rates} />
          </td>
        </tr>
      )}
    </>
  )
}

function Num({ value, tone = 'slate' }) {
  const cls = {
    slate: 'text-slate-700',
    emerald: 'text-emerald-600',
    sky: 'text-sky-600',
    amber: 'text-amber-600',
    red: 'text-red-500',
    mute: 'text-slate-300',
  }[tone]
  return (
    <td className="px-4 py-3 text-center">
      <span className={`font-mono font-black text-sm tabular-nums ${cls}`}>{value}</span>
    </td>
  )
}

// 單人本月全貌 — 出勤 + 結算 + 分級加班一次攤開
function PersonDetail({ r, att, rates }) {
  const { t } = useTranslation()
  const otTiers = rates.map((rate) => ({ rate, mins: r.overtimeByRate?.[rate] ?? 0 })).filter((x) => x.mins > 0)
  const reasons = r.compliance?.reasons ?? []
  return (
    <div className="space-y-px">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200/50 border border-slate-200/50">
        <DetailCell title={t('report.expectedVsActual')}>
          <p className="font-mono font-black text-sm text-slate-700 tabular-nums">
            {t('report.daysHours', { days: r.expectedWorkdays, hours: toHours(r.expectedMinutes) })}
          </p>
          <p className="font-mono font-black text-sm text-emerald-600 tabular-nums">
            {t('report.actualDaysHours', { days: r.actualWorkdays, hours: toHours(r.actualMinutes) })}
          </p>
        </DetailCell>

        <DetailCell title={t('report.leaveAndLateEarly')}>
          <p className="font-mono font-black text-sm text-sky-600 tabular-nums">{toHours(r.leaveMinutes)}h</p>
          <p className="font-zh text-[11px] text-slate-500">{leaveByTypeText(t, att?.leaveByType)}</p>
          <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
            {t('report.lateEarlyCounts', { late: r.lateCount, early: r.earlyLeaveCount })}
          </p>
        </DetailCell>

        <DetailCell title={t('report.tieredOvertime')}>
          {otTiers.length === 0 ? (
            <p className="font-zh text-[12px] text-slate-400">{t('common.none')}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {otTiers.map((tier) => (
                <span key={tier.rate} className="inline-flex font-mono font-black text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded tabular-nums">
                  {rateShort(t, tier.rate)} · {toHours(tier.mins)}h
                </span>
              ))}
            </div>
          )}
        </DetailCell>

        <DetailCell title={t('report.officeRemote')}>
          <p className="font-mono font-black text-sm text-slate-700 tabular-nums">
            <span className="text-emerald-600">{att?.officeDays ?? 0}</span>
            <span className="text-slate-300"> / </span>
            <span className="text-sky-600">{att?.remoteDays ?? 0}</span>
            <span className="font-zh text-[11px] text-slate-400"> {t('report.daysUnit')}</span>
          </p>
          <p className="font-mono text-[11px] text-slate-500 tabular-nums">{t('report.totalHours', { hours: toHours(att?.totalWorkDuration) })}</p>
        </DetailCell>
      </div>
      {reasons.length > 0 && (
        <div className="bg-white border border-slate-200/50 p-3">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">{t('report.complianceStatus')}</p>
          <div className="flex flex-col gap-1">
            {reasons.map((reason, i) => (
              <p
                key={i}
                className={`font-zh text-[12px] flex items-center gap-1.5 ${reason.severity === 'exceed' ? 'text-red-500' : 'text-amber-600'}`}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
                {reason.detail}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailCell({ title, children }) {
  return (
    <div className="bg-white p-3">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">{title}</p>
      {children}
    </div>
  )
}
