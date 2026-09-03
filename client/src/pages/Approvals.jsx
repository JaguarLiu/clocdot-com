import useSWR from 'swr'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetcher, decideApproval } from '../services/api.js'
import { leaveTypeLabel } from '../utils/leaveTypes.js'
import { parseCorrectionReason, punchTypeLabel } from '../utils/correctionReason.js'

const TYPE_LABEL_KEY = {
  leave: 'nav.leave',
  correction: 'nav.correction',
  overtime: 'approvals.typeOvertime',
}

function formatDate(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : ''
}

export default function Approvals() {
  const { t } = useTranslation()
  const { data, mutate, isLoading } = useSWR('/approvals/pending', fetcher)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  const list = data ?? []

  async function decide(item, decision) {
    setBusyId(item.stepId)
    setError(null)
    try {
      await decideApproval(item.stepId, { decision })
      await mutate()
    } catch (err) {
      if (err?.status === 409 && err?.info?.error === 'compliance_warning') {
        if (window.confirm(t('approvals.confirmOverCap'))) {
          try {
            await decideApproval(item.stepId, { decision: 'approve', confirm: true })
            await mutate()
          } catch (e2) {
            setError(e2?.message || t('common.errActionFailed'))
          }
        }
      } else {
        setError(err?.message || t('common.errActionFailed'))
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      <h1 className="font-zh text-2xl text-slate-800 mb-1">{t('approvals.title')}</h1>
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6">{t('approvals.titleEn')}</p>

      {error && <p className="font-zh text-sm text-red-500 mb-4">{error}</p>}

      {isLoading ? (
        <p className="font-zh text-sm text-slate-400 text-center py-10">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <p className="font-zh text-sm text-slate-400 text-center py-16">{t('approvals.empty')}</p>
      ) : (
        <div className="space-y-3">
          {list.map((item) => (
            <div key={item.stepId} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-sky-600 bg-sky-50 px-2 py-0.5 rounded">
                  {TYPE_LABEL_KEY[item.requestType] ? t(TYPE_LABEL_KEY[item.requestType]) : item.requestType}
                </span>
                <span className="font-zh text-sm text-slate-700">{item.applicant}</span>
                <span className="ml-auto text-[10px] font-black text-slate-400">{t('approvals.level', { level: item.level })}</span>
              </div>
              <p className="font-zh text-xs text-slate-500 mb-3">
                {item.requestType === 'leave' && `${leaveTypeLabel(t, item.leaveType)}・${formatDate(item.startDate)} ${item.startTime} ~ ${formatDate(item.endDate)} ${item.endTime}`}
                {item.requestType === 'correction' && (() => {
                  // item.reason 是儲存格式（`[上班] 09:00 - 說明`），拆開後類型才翻譯
                  const c = parseCorrectionReason(item.reason)
                  return `${formatDate(item.workDate)}・${punchTypeLabel(t, c.type)} ${c.time}${c.detail ? ` - ${c.detail}` : ''}`
                })()}
                {item.requestType === 'overtime' && `${formatDate(item.workDate)}・${t('common.minutesValue', { value: item.requestedMinutes })}`}
                {item.reason && item.requestType !== 'correction' ? ` ${t('approvals.reasonPrefix', { reason: item.reason })}` : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === item.stepId}
                  onClick={() => decide(item, 'approve')}
                  className="flex-1 py-2 rounded-lg bg-emerald-500 text-white font-zh text-sm disabled:opacity-50"
                >{t('approvals.approve')}</button>
                <button
                  type="button"
                  disabled={busyId === item.stepId}
                  onClick={() => decide(item, 'reject')}
                  className="flex-1 py-2 rounded-lg bg-red-100 text-red-600 font-zh text-sm disabled:opacity-50"
                >{t('approvals.reject')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
