import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Check, X, Inbox, User } from 'lucide-react'
import useSWR from 'swr'
import { fetcher, reviewCorrectionRequest } from '../services/api.js'
import PaperPiece from '../components/PaperPiece.jsx'
import PaperToast from '../components/PaperToast.jsx'
import StatusStamp from '../components/StatusStamp.jsx'
import MarkerButton from '../components/MarkerButton.jsx'
import { parseCorrectionReason, punchTypeLabel } from '../lib/correctionReason.js'

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const tabs = [
  { key: 'pending',  labelKey: 'status.pendingReview', accent: 'orange' },
  { key: 'approved', labelKey: 'status.approved',      accent: 'emerald' },
  { key: 'rejected', labelKey: 'status.rejected',      accent: 'red' },
]

const tabAccent = {
  orange:  'text-orange-600 bg-white shadow-md',
  emerald: 'text-emerald-600 bg-white shadow-md',
  red:     'text-red-600 bg-white shadow-md',
}

export default function Corrections() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('pending')
  const { data: requests, mutate } = useSWR(`/admin/correction-requests?status=${tab}`, fetcher)
  const [processing, setProcessing] = useState(null)
  const [toast, setToast] = useState(null)

  async function handleReview(id, status) {
    setProcessing(id)
    try {
      await reviewCorrectionRequest(id, status)
      mutate()
      setToast({ variant: 'success', message: status === 'approved' ? t('review.okApproved') : t('review.okRejected') })
    } catch (err) {
      setToast({ variant: 'error', message: err?.message || t('common.errActionFailed') })
    } finally {
      setProcessing(null)
    }
  }

  const list = requests ?? []

  return (
    <div className="animate-in fade-in duration-300">
      {toast && <PaperToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}

      {/* 頁面標題 */}
      <div className="flex items-center gap-3 mb-10">
        <div className="p-2.5 rounded-lg bg-orange-500 shadow-sm" style={{ transform: 'rotate(3deg)' }}>
          <CheckCircle2 size={22} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-3xl font-zh text-slate-800">{t('nav.corrections')}</h2>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
            Correction Requests Review
          </p>
        </div>
      </div>

      {/* Tab — 檔案夾風格 */}
      <div className="flex items-end gap-1 mb-6 border-b-2 border-slate-200/60">
        {tabs.map((item, idx) => {
          const isActive = tab === item.key
          const rotate = isActive ? '0deg' : `${idx % 2 === 0 ? '-0.5' : '0.5'}deg`
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`px-6 py-3 font-zh text-sm transition-all relative
                ${isActive ? tabAccent[item.accent] : 'text-slate-400 bg-white/40 hover:bg-white/70 hover:text-slate-600'}`}
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
            {tab === 'pending' ? t('review.emptyPending') : t('review.emptyOther')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((req, index) => {
            const parsed = parseCorrectionReason(req.reason)
            const userName = req.attendance?.user?.name || req.attendance?.user?.email || '--'
            const workDate = req.attendance?.workDate ? formatDate(req.attendance.workDate) : '--'
            const isProcessing = processing === req.id
            const rotate = index % 2 === 0 ? '-0.3deg' : '0.25deg'

            return (
              <PaperPiece key={req.id} color="white" rotate={rotate} variant="card" className="p-5">
                <div className="flex items-center gap-5 flex-wrap lg:flex-nowrap">
                  {/* 員工 */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="w-10 h-10 rounded-full bg-sky-100 border-2 border-sky-50 flex items-center justify-center overflow-hidden shrink-0">
                      {req.attendance?.user?.avatar ? (
                        <img src={req.attendance.user.avatar} alt={userName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <User size={16} className="text-sky-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-zh text-sm text-slate-700 truncate">{userName}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                        {req.attendance?.user?.email}
                      </p>
                    </div>
                  </div>

                  {/* 日期 / 類型 / 時間 */}
                  <div className="flex items-center gap-4 pl-5 border-l border-dashed border-slate-200">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('common.date')}</p>
                      <p className="font-mono font-black text-sm text-slate-700 tabular-nums">{workDate}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('common.type')}</p>
                      <p className="font-zh text-sm text-slate-700">{punchTypeLabel(t, parsed.type)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('common.time')}</p>
                      <p className="font-mono font-black text-sm text-slate-700 tabular-nums">{parsed.time}</p>
                    </div>
                  </div>

                  {/* 原因 */}
                  <div className="flex-1 min-w-[200px] pl-5 border-l border-dashed border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('common.reason')}</p>
                    <p className="font-zh text-sm text-slate-600 line-clamp-2">{parsed.detail || '—'}</p>
                  </div>

                  {/* 操作 */}
                  {tab === 'pending' ? (
                    <div className="flex items-center gap-3 shrink-0">
                      <MarkerButton
                        color="#10b981"
                        rotate="-0.5deg"
                        fontSize={13}
                        onClick={() => handleReview(req.id, 'approved')}
                        disabled={isProcessing}
                      >
                        <Check size={13} strokeWidth={3} />
                        {t('review.approve')}
                      </MarkerButton>
                      <MarkerButton
                        color="#ef4444"
                        rotate="0.5deg"
                        fontSize={13}
                        onClick={() => handleReview(req.id, 'rejected')}
                        disabled={isProcessing}
                      >
                        <X size={13} strokeWidth={3} />
                        {t('review.reject')}
                      </MarkerButton>
                    </div>
                  ) : (
                    <div className="shrink-0 pl-2">
                      <StatusStamp status={tab} />
                    </div>
                  )}
                </div>
              </PaperPiece>
            )
          })}
        </div>
      )}
    </div>
  )
}
