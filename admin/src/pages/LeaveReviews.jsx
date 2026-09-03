import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CalendarCheck, Check, X, Inbox, User, AlertTriangle, FileX,
} from 'lucide-react'
import useSWR from 'swr'
import {
  fetcher,
  reviewLeaveRequest,
  decideLeaveCancellation,
} from '../services/api.js'
import PaperPiece from '../components/PaperPiece.jsx'
import PaperToast from '../components/PaperToast.jsx'
import StatusStamp from '../components/StatusStamp.jsx'
import MarkerButton from '../components/MarkerButton.jsx'
import { leaveTypeLabel, leaveTypeCode } from '../utils/leaveTypes.js'
import i18n from '../i18n/index.js'

// ─── constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'pending',  labelKey: 'status.pendingReview', accent: 'orange' },
  { key: 'approved', labelKey: 'status.approved',      accent: 'emerald' },
  { key: 'rejected', labelKey: 'status.rejected',      accent: 'red' },
]

const TAB_ACCENT = {
  orange:  'text-orange-600 bg-white shadow-md',
  emerald: 'text-emerald-600 bg-white shadow-md',
  red:     'text-red-600 bg-white shadow-md',
}

// ─── date helpers ──────────────────────────────────────────────────────────────

function toYMD(dateStr) {
  if (!dateStr) return ''
  return dateStr.slice(0, 10)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function formatDuration(startDate, startTime, endDate, endTime) {
  if (!startDate || !endDate) return ''
  const startKey = startDate.slice(0, 10)
  const endKey = endDate.slice(0, 10)
  if (startKey === endKey) {
    const [sh, sm] = (startTime || '00:00').split(':').map(Number)
    const [eh, em] = (endTime || '00:00').split(':').map(Number)
    const minutes = (eh * 60 + em) - (sh * 60 + sm)
    if (minutes <= 0) return '—'
    const hours = minutes / 60
    if (hours >= 8) return i18n.t('common.daysValue', { value: 1 })
    return i18n.t('common.hoursValue', { value: hours % 1 === 0 ? hours : hours.toFixed(1) })
  }
  const days = Math.round((new Date(endKey) - new Date(startKey)) / 86400000) + 1
  return i18n.t('common.daysValue', { value: days })
}

// Does [aStart,aEnd] intersect [bStart,bEnd]? (string YYYY-MM-DD comparison is fine)
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd
}

// ─── sub-components ────────────────────────────────────────────────────────────

// Review-note textarea — index-card style, matches §3.1 card variant
function NoteTextarea({ value, onChange, placeholder }) {
  const { t } = useTranslation()
  const ph = placeholder ?? t('review.notePlaceholder')
  return (
    <textarea
      rows={2}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={ph}
      className="w-full text-sm font-zh text-slate-700 bg-amber-50/60 border border-dashed border-amber-200
                 placeholder-slate-300 resize-none px-3 py-2 focus:outline-none focus:border-amber-400
                 transition-colors"
      style={{ borderRadius: '6px 2px 6px 2px' }}
    />
  )
}

// Overlap count badge fetched lazily for a single pending request
function OverlapCount({ req }) {
  const { t } = useTranslation()
  const start = toYMD(req.startDate)
  const end   = toYMD(req.endDate)
  const { data: events } = useSWR(
    start && end ? `/admin/leave-calendar?from=${start}&to=${end}` : null,
    fetcher,
  )

  if (!events) return null

  const count = (events || []).filter((ev) => {
    if (ev.userId === req.user?.id) return false
    const evStart = toYMD(ev.startDate)
    const evEnd   = toYMD(ev.endDate)
    return rangesOverlap(start, end, evStart, evEnd)
  }).length

  if (count === 0) return null

  return (
    <span
      className="inline-flex items-center gap-1 font-mono font-black text-[10px] tabular-nums
                 text-amber-700 bg-amber-50 border border-dashed border-amber-300 px-2 py-0.5"
      style={{ borderRadius: '4px 1px 4px 1px' }}
    >
      <AlertTriangle size={9} strokeWidth={3} className="text-amber-500" />
      {t('review.overlapCount', { count })}
    </span>
  )
}

// Single review row card (pending)
function PendingRow({ req, index, onDone }) {
  const { t } = useTranslation()
  const [processing, setProcessing]   = useState(false)
  const [note, setNote]               = useState('')
  const [noteOpen, setNoteOpen]       = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // 'approved' | 'rejected'
  const [toast, setToast]             = useState(null)

  const userName  = req.user?.name || req.user?.email || '--'
  const typeLabel = leaveTypeLabel(t, req.leaveType)
  const typeCode  = leaveTypeCode(t, req.leaveType)
  const dateRange = toYMD(req.startDate) === toYMD(req.endDate)
    ? formatDate(req.startDate)
    : `${formatShortDate(req.startDate)} → ${formatShortDate(req.endDate)}`
  const duration  = formatDuration(req.startDate, req.startTime, req.endDate, req.endTime)
  const rotate    = index % 2 === 0 ? '-0.3deg' : '0.25deg'

  async function confirm(status) {
    setProcessing(true)
    try {
      await reviewLeaveRequest(req.id, status, note.trim() || undefined)
      onDone(status === 'approved' ? t('review.okApproved') : t('review.okRejected'))
    } catch (err) {
      setToast({ variant: 'error', message: err?.message || t('common.errActionFailed') })
      setProcessing(false)
    }
  }

  function initAction(status) {
    setPendingAction(status)
    setNoteOpen(true)
  }

  return (
    <>
      {toast && <PaperToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}
      <PaperPiece key={req.id} color="white" rotate={rotate} variant="card" className="p-5">
        <div className="flex items-start gap-5 flex-wrap lg:flex-nowrap">
          {/* 員工 */}
          <div className="flex items-center gap-3 min-w-[180px]">
            <div className="w-10 h-10 rounded-full bg-sky-100 border-2 border-sky-50 flex items-center justify-center overflow-hidden shrink-0">
              {req.user?.avatar ? (
                <img src={req.user.avatar} alt={userName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <User size={16} className="text-sky-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-zh text-sm text-slate-700 truncate">{userName}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                {req.user?.email}
              </p>
            </div>
          </div>

          {/* 假別 */}
          <div className="pl-5 border-l border-dashed border-slate-200">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</p>
            <p className="font-zh text-sm text-slate-700">
              {typeLabel}
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {typeCode}
              </span>
            </p>
          </div>

          {/* 日期 / 時間 / 時長 */}
          <div className="pl-5 border-l border-dashed border-slate-200">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</p>
            <p className="font-mono font-black text-sm text-slate-700 tabular-nums">{dateRange}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                {req.startTime} – {req.endTime}
              </span>
              <span className="inline-flex items-center font-mono font-black text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded tabular-nums">
                {duration}
              </span>
              <OverlapCount req={req} />
            </div>
          </div>

          {/* 原因 */}
          <div className="flex-1 min-w-[160px] pl-5 border-l border-dashed border-slate-200">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p>
            <p className="font-zh text-sm text-slate-600 line-clamp-2">{req.reason || '—'}</p>
          </div>

          {/* 操作 */}
          <div className="flex items-center gap-3 shrink-0">
            <MarkerButton
              color="#10b981"
              rotate="-0.5deg"
              fontSize={13}
              onClick={() => initAction('approved')}
              disabled={processing}
            >
              <Check size={13} strokeWidth={3} />
              {t('review.approve')}
            </MarkerButton>
            <MarkerButton
              color="#ef4444"
              rotate="0.5deg"
              fontSize={13}
              onClick={() => initAction('rejected')}
              disabled={processing}
            >
              <X size={13} strokeWidth={3} />
              {t('review.reject')}
            </MarkerButton>
          </div>
        </div>

        {/* 備註展開面板 */}
        {noteOpen && (
          <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Review Note</p>
            <NoteTextarea value={note} onChange={setNote} />
            <div className="flex items-center gap-3 mt-3">
              {/* Confirm action button */}
              <button
                type="button"
                disabled={processing}
                onClick={() => confirm(pendingAction)}
                className={`relative group active:scale-[0.98] disabled:opacity-50`}
              >
                <div className={`absolute inset-0 ${pendingAction === 'approved' ? 'bg-emerald-700' : 'bg-red-700'} translate-y-[3px]`} />
                <div className={`relative ${pendingAction === 'approved' ? 'bg-emerald-500' : 'bg-red-500'} text-white px-5 py-2
                                flex items-center gap-2 font-zh text-sm
                                group-hover:-translate-y-[1px] transition-transform`}>
                  {pendingAction === 'approved'
                    ? <><Check size={13} strokeWidth={3} />{t('review.confirmApprove')}</>
                    : <><X size={13} strokeWidth={3} />{t('review.confirmReject')}</>}
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setNoteOpen(false); setPendingAction(null); setNote('') }}
                className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] hover:text-slate-600 transition-colors px-2"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </PaperPiece>
    </>
  )
}

// Non-pending row (approved / rejected — read-only)
function ReviewedRow({ req, index }) {
  const { t } = useTranslation()
  const userName  = req.user?.name || req.user?.email || '--'
  const typeLabel = leaveTypeLabel(t, req.leaveType)
  const typeCode  = leaveTypeCode(t, req.leaveType)
  const dateRange = toYMD(req.startDate) === toYMD(req.endDate)
    ? formatDate(req.startDate)
    : `${formatShortDate(req.startDate)} → ${formatShortDate(req.endDate)}`
  const duration  = formatDuration(req.startDate, req.startTime, req.endDate, req.endTime)
  const rotate    = index % 2 === 0 ? '-0.3deg' : '0.25deg'

  return (
    <PaperPiece color="white" rotate={rotate} variant="card" className="p-5">
      <div className="flex items-center gap-5 flex-wrap lg:flex-nowrap">
        {/* 員工 */}
        <div className="flex items-center gap-3 min-w-[180px]">
          <div className="w-10 h-10 rounded-full bg-sky-100 border-2 border-sky-50 flex items-center justify-center overflow-hidden shrink-0">
            {req.user?.avatar ? (
              <img src={req.user.avatar} alt={userName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <User size={16} className="text-sky-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-zh text-sm text-slate-700 truncate">{userName}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
              {req.user?.email}
            </p>
          </div>
        </div>

        {/* 假別 */}
        <div className="pl-5 border-l border-dashed border-slate-200">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</p>
          <p className="font-zh text-sm text-slate-700">
            {typeLabel}
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {typeCode}
            </span>
          </p>
        </div>

        {/* 日期 */}
        <div className="pl-5 border-l border-dashed border-slate-200">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</p>
          <p className="font-mono font-black text-sm text-slate-700 tabular-nums">{dateRange}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {req.startTime} – {req.endTime}
            </span>
            <span className="inline-flex items-center font-mono font-black text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded tabular-nums">
              {duration}
            </span>
          </div>
        </div>

        {/* 原因 */}
        <div className="flex-1 min-w-[160px] pl-5 border-l border-dashed border-slate-200">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p>
          <p className="font-zh text-sm text-slate-600 line-clamp-2">{req.reason || '—'}</p>
        </div>

        {/* 審核備註 */}
        {req.reviewNote && (
          <div className="min-w-[140px] pl-5 border-l border-dashed border-slate-200">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Note</p>
            <p className="font-zh text-[11px] text-slate-500 line-clamp-2">{req.reviewNote}</p>
          </div>
        )}

        {/* 狀態印章 */}
        <div className="shrink-0 pl-2">
          <StatusStamp status={req.status} />
        </div>
      </div>
    </PaperPiece>
  )
}

// ─── Cancellation section ──────────────────────────────────────────────────────

function CancellationRow({ req, index, onDone }) {
  const { t } = useTranslation()
  const [processing, setProcessing] = useState(false)
  const [note, setNote]             = useState('')
  const [actionOpen, setActionOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // 'confirm-cancel' | 'reject-cancel'
  const [toast, setToast]           = useState(null)

  const userName = req.user?.name || req.user?.email || '--'
  const typeLabel = leaveTypeLabel(t, req.leaveType)
  const typeCode  = leaveTypeCode(t, req.leaveType)
  const dateRange = toYMD(req.startDate) === toYMD(req.endDate)
    ? formatDate(req.startDate)
    : `${formatShortDate(req.startDate)} → ${formatShortDate(req.endDate)}`
  const rotate = index % 2 === 0 ? '-0.3deg' : '0.25deg'

  async function confirm(action) {
    setProcessing(true)
    try {
      await decideLeaveCancellation(req.id, action, note.trim() || undefined)
      onDone(action === 'confirm-cancel' ? t('review.okCancelApproved') : t('review.okCancelRejected'))
    } catch (err) {
      setToast({ variant: 'error', message: err?.message || t('common.errActionFailed') })
      setProcessing(false)
    }
  }

  function initAction(action) {
    setPendingAction(action)
    setActionOpen(true)
  }

  return (
    <>
      {toast && <PaperToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}
      <PaperPiece color="white" rotate={rotate} variant="card" className="p-5">
        <div className="flex items-start gap-5 flex-wrap lg:flex-nowrap">
          {/* 員工 */}
          <div className="flex items-center gap-3 min-w-[180px]">
            <div className="w-10 h-10 rounded-full bg-amber-100 border-2 border-amber-50 flex items-center justify-center overflow-hidden shrink-0">
              {req.user?.avatar ? (
                <img src={req.user.avatar} alt={userName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <User size={16} className="text-amber-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-zh text-sm text-slate-700 truncate">{userName}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                {req.user?.email}
              </p>
            </div>
          </div>

          {/* 假別 */}
          <div className="pl-5 border-l border-dashed border-amber-200">
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Type</p>
            <p className="font-zh text-sm text-slate-700">
              {typeLabel}
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {typeCode}
              </span>
            </p>
          </div>

          {/* 日期 */}
          <div className="pl-5 border-l border-dashed border-amber-200">
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Period</p>
            <p className="font-mono font-black text-sm text-slate-700 tabular-nums">{dateRange}</p>
          </div>

          {/* 取消原因 */}
          <div className="flex-1 min-w-[160px] pl-5 border-l border-dashed border-amber-200">
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">{t('review.cancelReasonLabel')}</p>
            <p className="font-zh text-sm text-slate-600 line-clamp-2">{req.cancelReason || '—'}</p>
          </div>

          {/* 操作 */}
          <div className="flex items-center gap-3 shrink-0">
            <MarkerButton
              color="#f59e0b"
              rotate="-0.5deg"
              fontSize={12}
              onClick={() => initAction('confirm-cancel')}
              disabled={processing}
            >
              <Check size={12} strokeWidth={3} />
              {t('review.approveCancel')}
            </MarkerButton>
            <MarkerButton
              color="#64748b"
              rotate="0.5deg"
              fontSize={12}
              onClick={() => initAction('reject-cancel')}
              disabled={processing}
            >
              <X size={12} strokeWidth={3} />
              {t('review.rejectCancel')}
            </MarkerButton>
          </div>
        </div>

        {/* 備註面板 */}
        {actionOpen && (
          <div className="mt-4 pt-4 border-t border-dashed border-amber-200">
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] mb-2">Review Note</p>
            <NoteTextarea
              value={note}
              onChange={setNote}
              placeholder={t('review.notePlaceholder')}
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                disabled={processing}
                onClick={() => confirm(pendingAction)}
                className="relative group active:scale-[0.98] disabled:opacity-50"
              >
                <div className={`absolute inset-0 ${pendingAction === 'confirm-cancel' ? 'bg-amber-700' : 'bg-slate-600'} translate-y-[3px]`} />
                <div className={`relative ${pendingAction === 'confirm-cancel' ? 'bg-amber-500' : 'bg-slate-400'} text-white px-5 py-2
                                flex items-center gap-2 font-zh text-sm
                                group-hover:-translate-y-[1px] transition-transform`}>
                  {pendingAction === 'confirm-cancel'
                    ? <><Check size={13} strokeWidth={3} />{t('review.confirmApproveCancel')}</>
                    : <><X size={13} strokeWidth={3} />{t('review.confirmRejectCancel')}</>}
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setActionOpen(false); setPendingAction(null); setNote('') }}
                className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] hover:text-slate-600 transition-colors px-2"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </PaperPiece>
    </>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LeaveReviews() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('pending')
  const { data: requests, mutate } = useSWR(`/admin/leave-requests?status=${tab}`, fetcher)
  // For cancellation section: fetch approved list separately (always needed when tab=approved)
  const { data: approvedRequests, mutate: mutateApproved } = useSWR(
    '/admin/leave-requests?status=approved',
    fetcher,
  )
  const [toast, setToast] = useState(null)

  const list = requests ?? []

  // Cancellation requests: approved records where cancelRequested === true
  const cancellationList = useMemo(
    () => (approvedRequests ?? []).filter((r) => r.cancelRequested === true),
    [approvedRequests],
  )

  function handleDone(message) {
    mutate()
    mutateApproved()
    setToast({ variant: 'success', message })
  }

  return (
    <div className="animate-in fade-in duration-300">
      {toast && <PaperToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}

      {/* 頁面標題 */}
      <div className="flex items-center gap-3 mb-10">
        <div className="p-2.5 rounded-lg bg-amber-500 shadow-sm" style={{ transform: 'rotate(-3deg)' }}>
          <CalendarCheck size={22} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-3xl font-zh text-slate-800">{t('nav.leaves')}</h2>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
            Leave Requests Review
          </p>
        </div>
      </div>

      {/* 待取消申請 — amber accent section (always visible when there are any) */}
      {cancellationList.length > 0 && (
        <div className="mb-8">
          {/* Section title strip */}
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded bg-amber-500 shadow-sm" style={{ transform: 'rotate(1deg)' }}>
              <FileX size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <h3 className="font-zh text-sm text-amber-700">
              {t('review.pendingCancels')}
            </h3>
            <span className="font-mono font-black text-[10px] tabular-nums text-amber-700 bg-amber-50 border border-dashed border-amber-300 px-2 py-0.5"
                  style={{ borderRadius: '3px 1px 3px 1px' }}>
              {cancellationList.length}
            </span>
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em]">
              Pending Cancellation
            </span>
          </div>
          <div className="space-y-3">
            {cancellationList.map((req, index) => (
              <CancellationRow
                key={req.id}
                req={req}
                index={index}
                onDone={handleDone}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab — 檔案夾風格 */}
      <div className="flex items-end gap-1 mb-6 border-b-2 border-slate-200/60">
        {TABS.map((item, idx) => {
          const isActive = tab === item.key
          const rotate = isActive ? '0deg' : `${idx % 2 === 0 ? '-0.5' : '0.5'}deg`
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`px-6 py-3 font-zh text-sm transition-all relative
                ${isActive ? TAB_ACCENT[item.accent] : 'text-slate-400 bg-white/40 hover:bg-white/70 hover:text-slate-600'}`}
              style={{
                transform: `rotate(${rotate})`,
                borderRadius: '10px 10px 0 0',
                border: '1px solid rgba(0,0,0,0.06)',
                borderBottom: isActive ? 'none' : '1px solid rgba(0,0,0,0.06)',
                marginBottom: isActive ? '-2px' : '0',
              }}
            >
              {t(item.labelKey)}
            </button>
          )
        })}
      </div>

      {/* 列表 */}
      {list.length === 0 ? (
        <div className="text-center py-24 opacity-40 flex flex-col items-center gap-3">
          <Inbox size={48} className="text-slate-300" />
          <p className="font-zh text-sm text-slate-400">
            {tab === 'pending' ? t('review.emptyPendingLeave') : t('review.emptyOther')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((req, index) =>
            tab === 'pending' ? (
              <PendingRow key={req.id} req={req} index={index} onDone={handleDone} />
            ) : (
              <ReviewedRow key={req.id} req={req} index={index} />
            ),
          )}
        </div>
      )}
    </div>
  )
}
