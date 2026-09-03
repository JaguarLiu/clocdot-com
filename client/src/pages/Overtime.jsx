import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Timer, Send, Inbox, AlertCircle, CheckCircle2 } from 'lucide-react'
import useSWR from 'swr'
import PaperPiece from '../components/PaperPiece.jsx'
import PaperToast from '../components/PaperToast.jsx'
import MarkerButton from '../components/MarkerButton.jsx'
import StatusStamp from '../components/StatusStamp.jsx'
import { getOvertimePending, submitOvertimeRequest, getMyOvertimeCompliance, fetcher } from '../services/api.js'

const LIST_ROTATIONS = ['-0.6deg', '0.5deg', '-0.4deg', '0.7deg', '-0.3deg']

// dayType / rate 的顯示名稱走 i18n；倍率本身（×1.34…）不隨語系變動
const DAY_TYPE_KEYS = ['workday', 'restday', 'national_holiday', 'regular_leave']

function dayTypeLabel(t, dayType) {
  return DAY_TYPE_KEYS.includes(dayType) ? t(`overtime.dayType.${dayType}`) : dayType
}

const NUMERIC_RATES = { '1.34': '×1.34', '1.67': '×1.67', '2.67': '×2.67' }

function rateLabel(t, rate) {
  if (NUMERIC_RATES[rate]) return NUMERIC_RATES[rate]
  if (rate === 'holiday') return t('overtime.rateHoliday')
  if (rate === 'regular_leave') return t('overtime.dayType.regular_leave')
  return rate
}

function formatDateFull(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function toHours(minutes) {
  return (minutes / 60).toFixed(1)
}

export default function Overtime() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'list' ? 'list' : 'apply'

  function switchTab(tab) {
    setSearchParams(tab === 'apply' ? {} : { tab })
  }

  return (
    <main className="w-full relative z-10 px-4 mt-4 animate-in slide-in-from-bottom-4 duration-300 pb-20">
      <div className="flex items-center gap-2 mb-6 px-2">
        <Timer size={24} className="text-amber-500" aria-hidden="true" />
        <h3 className="font-zh text-2xl text-slate-700">{t('overtime.title')}</h3>
      </div>

      <ComplianceSummary />

      <div
        className="flex mb-8 bg-slate-200/40 p-1 border border-slate-200"
        role="tablist"
        aria-label={t('overtime.tabsAria')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'apply'}
          onClick={() => switchTab('apply')}
          className={`flex-1 py-2.5 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'apply' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-500'
          }`}
        >
          {t('overtime.tabApply')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'list'}
          onClick={() => switchTab('list')}
          className={`flex-1 py-2.5 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'list' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-500'
          }`}
        >
          {t('overtime.tabList')}
        </button>
      </div>

      {activeTab === 'apply' ? <PendingList /> : <OvertimeHistory />}
    </main>
  )
}

// ------- 可申請（虛擬草稿）-------

function PendingList() {
  const { t } = useTranslation()
  const { data, isLoading, mutate } = useSWR('/overtime/pending', () => getOvertimePending())
  const [toast, setToast] = useState(null)

  const pending = data ?? []

  function handleSubmitted(workDate) {
    // 送出成功後本地移除該日，並重新拉取
    mutate((prev) => (prev ?? []).filter((p) => p.workDate !== workDate), { revalidate: true })
    setToast({ variant: 'success', message: t('overtime.okSubmitted') })
  }

  return (
    <div className="animate-in fade-in duration-300">
      {toast && <PaperToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}

      <div className="bg-amber-50 p-4 border-l-4 border-amber-400 flex gap-3 mb-6">
        <AlertCircle size={18} className="text-amber-400 shrink-0" aria-hidden="true" />
        <p className="text-[11px] font-bold text-amber-600 leading-relaxed">
          {t('overtime.hint')}
        </p>
      </div>

      {isLoading ? (
        <p className="text-center text-slate-500 text-xs py-20 font-zh">{t('common.loading')}</p>
      ) : pending.length === 0 ? (
        <div className="text-center py-20 opacity-40 flex flex-col items-center gap-2">
          <Inbox size={40} className="text-slate-400" aria-hidden="true" />
          <p className="font-zh text-xs text-slate-500">{t('overtime.emptyPending')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((item, index) => (
            <PendingCard
              key={item.workDate}
              item={item}
              rotate={LIST_ROTATIONS[index % LIST_ROTATIONS.length]}
              onSubmitted={handleSubmitted}
              onError={(m) => setToast({ variant: 'error', message: m })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PendingCard({ item, rotate, onSubmitted, onError }) {
  const { t } = useTranslation()
  const maxHours = item.derivedMinutes / 60
  const [hours, setHours] = useState(maxHours.toFixed(1))
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const requestedMinutes = Math.round(Number(hours) * 60)
    if (!Number.isFinite(requestedMinutes) || requestedMinutes <= 0) {
      onError(t('overtime.errInvalidHours'))
      return
    }
    if (requestedMinutes > item.derivedMinutes) {
      onError(t('overtime.errExceedsDerived', { max: toHours(item.derivedMinutes) }))
      return
    }
    setSubmitting(true)
    try {
      await submitOvertimeRequest({ workDate: item.workDate, requestedMinutes, reason })
      onSubmitted(item.workDate)
    } catch (err) {
      onError(err?.message || t('common.errSubmitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PaperPiece color="white" rotate={rotate} className="p-4">
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 flex flex-col items-center justify-center w-14 py-2 bg-amber-50 border border-amber-100"
          style={{ borderRadius: '10px 3px 12px 4px/4px 12px 3px 10px' }}
        >
          <span className="font-zh text-[13px] text-amber-600 leading-tight break-words">
            {dayTypeLabel(t, item.dayType)}
          </span>
          <span className="font-black text-[8px] text-amber-400 uppercase tracking-widest mt-0.5">OT</span>
        </div>

        <div className="flex-1 min-w-0 border-l border-dashed border-slate-200 pl-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono font-black text-sm text-slate-700 tabular-nums">
              {formatDateFull(item.workDate)}
            </span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {t('overtime.derived', { hours: toHours(item.derivedMinutes) })}
            </span>
          </div>

          {/* 分級預覽 */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {item.tiers.map((tier, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 font-mono font-black text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded tabular-nums"
              >
                {rateLabel(t, tier.rate)} · {toHours(tier.minutes)}h
              </span>
            ))}
          </div>

          {/* 申請時數 + 事由 */}
          <div className="mt-3 space-y-2">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {t('overtime.fieldHours')}
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max={maxHours}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full bg-slate-50 border-b-2 border-slate-200 px-1.5 py-2 font-mono font-black text-sm text-slate-700 rounded-none focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
            <input
              type="text"
              placeholder={t('overtime.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border-b-2 border-slate-200 px-1.5 py-2 font-zh text-sm text-slate-600 rounded-none focus:outline-none focus:border-amber-400 transition-colors"
            />
            <MarkerButton
              color="#f59e0b"
              rotate="0.5deg"
              fontSize={14}
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
              style={{ width: '100%' }}
            >
              <Send size={16} aria-hidden="true" />
              <span>{submitting ? t('common.submitting') : t('common.submit')}</span>
            </MarkerButton>
          </div>
        </div>
      </div>
    </PaperPiece>
  )
}

// ------- 申請紀錄 -------

function OvertimeHistory() {
  const { t } = useTranslation()
  const { data, isLoading } = useSWR('/overtime-requests', fetcher)
  const list = useMemo(() => data ?? [], [data])

  return (
    <div className="animate-in fade-in duration-300 pb-10">
      {isLoading ? (
        <p className="text-center text-slate-500 text-xs py-20 font-zh">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <div className="text-center py-20 opacity-40 flex flex-col items-center gap-2">
          <Inbox size={40} className="text-slate-400" aria-hidden="true" />
          <p className="font-zh text-xs text-slate-500">{t('overtime.emptyHistory')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((req, index) => (
            <PaperPiece
              key={req.id}
              color="white"
              rotate={LIST_ROTATIONS[index % LIST_ROTATIONS.length]}
              className="relative p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className="shrink-0 flex flex-col items-center justify-center w-14 py-2 bg-amber-50 border border-amber-100"
                  style={{ borderRadius: '10px 3px 12px 4px/4px 12px 3px 10px' }}
                >
                  <span className="font-zh text-[13px] text-amber-600 leading-tight break-words">
                    {dayTypeLabel(t, req.dayType)}
                  </span>
                  <span className="font-black text-[8px] text-amber-400 uppercase tracking-widest mt-0.5">OT</span>
                </div>

                <div className="flex-1 min-w-0 border-l border-dashed border-slate-200 pl-3">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono font-black text-sm text-slate-700 tabular-nums">
                      {formatDateFull(req.workDate)}
                    </span>
                    <span className="inline-flex items-center font-mono font-black text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded tabular-nums">
                      {t('common.hoursValue', { value: toHours(req.requestedMinutes) })}
                    </span>
                  </div>
                  {req.reason && (
                    <p className="font-zh text-[12px] text-slate-500 line-clamp-1 mt-1">{req.reason}</p>
                  )}
                </div>

                <div className="shrink-0">
                  <StatusStamp status={req.status} />
                </div>
              </div>
            </PaperPiece>
          ))}
        </div>
      )}
    </div>
  )
}

// ------- 本月加班合規摘要條（純資訊；僅計已核准）-------

const COMPLIANCE_TONE = {
  ok:     { wrap: 'bg-emerald-50 border-emerald-400', text: 'text-emerald-600', num: 'text-emerald-700', Icon: CheckCircle2 },
  warn:   { wrap: 'bg-amber-50 border-amber-400',     text: 'text-amber-600',   num: 'text-amber-700',   Icon: AlertCircle },
  exceed: { wrap: 'bg-red-50 border-red-400',         text: 'text-red-600',     num: 'text-red-700',     Icon: AlertCircle },
}

function ComplianceSummary() {
  const { t } = useTranslation()
  const { data, error } = useSWR('/overtime/compliance', getMyOvertimeCompliance)

  // 降級：載入中或失敗 → 不顯示，不阻斷主流程
  if (error || !data) return null

  const tone = COMPLIANCE_TONE[data.status] || COMPLIANCE_TONE.ok
  return (
    <div className={`mb-6 p-4 border-l-4 ${tone.wrap}`}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 font-zh text-sm text-slate-600">
          <tone.Icon size={15} className={tone.text} aria-hidden="true" />
          {t('overtime.monthlyUsed')}
        </span>
        <span className={`font-mono font-black text-sm tabular-nums ${tone.num}`}>
          {t('common.hoursValue', { value: `${toHours(data.monthlyMinutes)} / ${toHours(data.monthlyCap)}` })}
        </span>
      </div>
      {data.status !== 'ok' && (data.reasons?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {data.reasons.map((r, i) => (
            <p key={i} className={`text-[11px] font-bold leading-relaxed ${tone.text}`}>
              {r.detail}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
