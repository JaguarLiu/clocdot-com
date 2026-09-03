import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ClipboardPen, Send, AlertCircle, Inbox, ChevronDown, LogIn, LogOut } from 'lucide-react'
import useSWR from 'swr'
import PaperPiece from '../components/PaperPiece.jsx'
import PaperToast from '../components/PaperToast.jsx'
import MarkerButton from '../components/MarkerButton.jsx'
import StatusStamp from '../components/StatusStamp.jsx'
import { submitCorrectionRequest, fetcher } from '../services/api.js'
import { formatYearMonth } from '../utils/time.js'
import { parseCorrectionReason, STORED_TYPE_OUT } from '../utils/correctionReason.js'

const LIST_ROTATIONS = ['-0.6deg', '0.5deg', '-0.4deg', '0.7deg', '-0.3deg']

function buildMonthOptions(lang) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { value, label: formatYearMonth(d, lang) }
  })
}

function formatDateFull(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function Correction() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'list' ? 'list' : 'apply'

  function switchTab(tab) {
    setSearchParams(tab === 'apply' ? {} : { tab })
  }

  return (
    <main className="w-full relative z-10 px-4 mt-4 animate-in slide-in-from-bottom-4 duration-300 pb-20">
      <div className="flex items-center gap-2 mb-6 px-2">
        <ClipboardPen size={24} className="text-orange-500" aria-hidden="true" />
        <h3 className="font-zh text-2xl text-slate-700">{t('correction.title')}</h3>
      </div>

      {/* 子頁籤 */}
      <div
        className="flex mb-8 bg-slate-200/40 p-1 border border-slate-200"
        role="tablist"
        aria-label={t('correction.tabsAria')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'apply'}
          onClick={() => switchTab('apply')}
          className={`flex-1 py-2.5 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'apply' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-500'
          }`}
        >
          {t('correction.tabApply')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'list'}
          onClick={() => switchTab('list')}
          className={`flex-1 py-2.5 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'list' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-500'
          }`}
        >
          {t('correction.tabList')}
        </button>
      </div>

      {activeTab === 'apply' ? <CorrectionApplyForm /> : <CorrectionList />}
    </main>
  )
}

// ------- 提交申請 -------

function CorrectionApplyForm() {
  const { t } = useTranslation()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState('in')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  async function handleSubmit() {
    if (!date || !time || !reason.trim()) {
      setToast({ variant: 'error', message: t('common.errFillAll') })
      return
    }
    setIsSubmitting(true)
    try {
      await submitCorrectionRequest({ workDate: date, time, type, reason: reason.trim() })
      setToast({ variant: 'success', message: t('correction.okSubmitted') })
      setDate('')
      setTime('')
      setReason('')
    } catch (err) {
      const msg = err?.info?.error || err?.message || t('common.errSubmitFailed')
      setToast({ variant: 'error', message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="animate-in fade-in duration-300">
      {toast && (
        <PaperToast
          variant={toast.variant}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}

      <PaperPiece color="white" rotate="-0.5deg" className="p-8 mb-8">
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('common.date')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 border-b-2 border-slate-200 p-2 font-mono font-black text-slate-700 rounded-none focus:outline-none focus:border-orange-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('common.time')}</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="09:00"
                maxLength={5}
                value={time}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d:]/g, '')
                  if (v.length === 2 && !v.includes(':') && time.length < v.length) v += ':'
                  setTime(v)
                }}
                className="w-full bg-slate-50 border-b-2 border-slate-200 p-2 font-mono font-black text-slate-700 rounded-none focus:outline-none focus:border-orange-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('common.type')}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-slate-50 border-b-2 border-slate-200 p-2 font-zh text-slate-700 rounded-none focus:outline-none focus:border-orange-400 transition-colors appearance-none"
              >
                <option value="in">{t('attendance.punchIn')}</option>
                <option value="out">{t('attendance.punchOut')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('correction.fieldReason')}</label>
            <textarea
              rows="3"
              placeholder={t('correction.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border-b-2 border-slate-200 p-3 font-zh text-slate-600 rounded-none focus:outline-none focus:border-orange-400 transition-colors resize-none"
            />
          </div>

          <MarkerButton
            color="#f97316"
            rotate="-1.2deg"
            fontSize={18}
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full"
            style={{ width: '100%' }}
          >
            <Send size={20} aria-hidden="true" />
            <span>{isSubmitting ? t('common.submitting') : t('correction.tabApply')}</span>
          </MarkerButton>
        </div>
      </PaperPiece>
    </div>
  )
}

// ------- 申請紀錄 -------

function CorrectionList() {
  const { t, i18n } = useTranslation()
  const monthOptions = useMemo(() => buildMonthOptions(i18n.resolvedLanguage), [i18n.resolvedLanguage])
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value)
  const [statusFilter, setStatusFilter] = useState('all')

  const { data, isLoading } = useSWR('/correction-requests', fetcher)

  const filtered = useMemo(() => {
    if (!data) return []
    return data.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      const workDate = r.attendance?.workDate
      if (typeof workDate !== 'string') return false
      return workDate.slice(0, 7) === selectedMonth
    })
  }, [data, selectedMonth, statusFilter])

  return (
    <div className="animate-in fade-in duration-300 pb-10">
      {/* Toolbar：狀態篩選 + 月份 */}
      <div className="flex items-center justify-between gap-2 mb-5 px-1">
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
        <MonthSelect value={selectedMonth} options={monthOptions} onChange={setSelectedMonth} />
      </div>

      {isLoading ? (
        <p className="text-center text-slate-500 text-xs py-20 font-zh">{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 opacity-40 flex flex-col items-center gap-2">
          <Inbox size={40} className="text-slate-400" aria-hidden="true" />
          <p className="font-zh text-xs text-slate-500">{t('leave.emptyMonth')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req, index) => (
            <CorrectionCard
              key={req.id}
              req={req}
              rotate={LIST_ROTATIONS[index % LIST_ROTATIONS.length]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatusFilter({ value, onChange }) {
  const { t } = useTranslation()
  const options = [
    { key: 'all',      label: t('status.all') },
    { key: 'pending',  label: t('status.pending') },
    { key: 'approved', label: t('status.approved') },
    { key: 'rejected', label: t('status.rejected') },
  ]
  return (
    <div className="flex items-center gap-1" role="tablist" aria-label={t('common.statusFilter')}>
      {options.map((opt) => {
        const active = value === opt.key
        return (
          <button
            type="button"
            key={opt.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={`font-zh text-[11px] px-2.5 py-1 border transition-colors
              ${active
                ? 'bg-white text-orange-600 border-orange-200 shadow-sm'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-700'}`}
            style={{ borderRadius: '8px 2px 10px 3px/3px 10px 2px 8px' }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function MonthSelect({ value, options, onChange }) {
  const { t } = useTranslation()
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('common.selectMonth')}
        className="appearance-none bg-white px-3 py-1.5 pr-7 border border-slate-200 shadow-sm text-[11px] font-black text-slate-500 tracking-tight focus:outline-none rounded-full"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
    </div>
  )
}

const TYPE_BADGE = {
  in:  { labelKey: 'attendance.punchIn',  codeKey: 'attendance.punchInCode',  Icon: LogIn,  classes: 'bg-emerald-50 border-emerald-100 text-emerald-600 [&_.en]:text-emerald-400' },
  out: { labelKey: 'attendance.punchOut', codeKey: 'attendance.punchOutCode', Icon: LogOut, classes: 'bg-orange-50 border-orange-100 text-orange-600 [&_.en]:text-orange-400' },
}

function CorrectionCard({ req, rotate }) {
  const { t } = useTranslation()
  const parsed = parseCorrectionReason(req.reason)
  // parseReason 的 type 來自 DB reason 字串（固定為中文，見檔頭註解）；無法解析時退到 'in'
  const isOut = parsed.type === STORED_TYPE_OUT
  const badge = isOut ? TYPE_BADGE.out : TYPE_BADGE.in
  const BadgeIcon = badge.Icon
  const badgeLabel = t(badge.labelKey)
  const badgeCode = t(badge.codeKey)

  return (
    <PaperPiece color="white" rotate={rotate} className="relative p-4">
      <div className="flex items-start gap-3">
        {/* 類型 badge */}
        <div
          className={`shrink-0 flex flex-col items-center justify-center w-14 py-2 border ${badge.classes}`}
          style={{ borderRadius: '10px 3px 12px 4px/4px 12px 3px 10px' }}
        >
          <BadgeIcon size={14} strokeWidth={2.5} aria-hidden="true" />
          <span className="font-zh text-[12px] leading-tight mt-0.5 break-words">{badgeLabel}</span>
          {badgeCode && (
            <span className="en font-black text-[8px] uppercase tracking-widest mt-0.5">
              {badgeCode}
            </span>
          )}
        </div>

        {/* 主要資訊 */}
        <div className="flex-1 min-w-0 border-l border-dashed border-slate-200 pl-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono font-black text-sm text-slate-700 tabular-nums">
              {formatDateFull(req.attendance?.workDate)}
            </span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              → {parsed.time}
            </span>
          </div>
          <div className="mt-1">
            {parsed.detail ? (
              <p className="font-zh text-[12px] text-slate-500 line-clamp-2">
                {parsed.detail}
              </p>
            ) : (
              <p className="font-zh text-[11px] text-slate-400 italic">{t('correction.noReason')}</p>
            )}
          </div>
        </div>

        {/* 狀態蓋章 */}
        <div className="shrink-0">
          <StatusStamp status={req.status} />
        </div>
      </div>
    </PaperPiece>
  )
}
