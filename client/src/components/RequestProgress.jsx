import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { Check, X, Clock, ChevronDown, Route, FastForward } from 'lucide-react'
import { fetcher } from '../services/api.js'
import { formatDate, formatTime } from '../utils/time.js'
import { eventLabelKey, eventLevel, stepTone } from '../utils/requestProgress.js'

// 申請卡片底部的「查看進度」：展開後顯示簽核關卡 + 時間軸。
// 收合時不發請求；展開才載入 GET /api/requests/:type/:id/progress。

const TONE = {
  approved: { Icon: Check, dot: 'bg-emerald-500 border-emerald-500 text-white', text: 'text-emerald-600' },
  rejected: { Icon: X, dot: 'bg-red-500 border-red-500 text-white', text: 'text-red-500' },
  skipped: { Icon: FastForward, dot: 'bg-slate-100 border-slate-300 text-slate-500', text: 'text-slate-500' },
  current: { Icon: Clock, dot: 'bg-amber-50 border-amber-500 text-amber-600 animate-pulse', text: 'text-amber-600' },
  waiting: { Icon: null, dot: 'bg-white border-slate-300 text-slate-300', text: 'text-slate-500' },
}

function formatStamp(value, lang) {
  if (!value) return ''
  const d = new Date(value)
  return `${formatDate(d, lang)} ${formatTime(d, lang)}`
}

export default function RequestProgress({ type, id }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelId = `progress-${type}-${id}`

  return (
    <div className="mt-3 border-t border-dashed border-slate-200 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex items-center gap-1.5 py-1 font-zh text-[12px] text-slate-500 hover:text-sky-600 active:scale-95 transition-all"
      >
        <Route size={13} strokeWidth={2.5} aria-hidden="true" />
        {open ? t('progress.hide') : t('progress.show')}
        <ChevronDown
          size={13}
          strokeWidth={2.5}
          aria-hidden="true"
          className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <ProgressPanel id={panelId} type={type} requestId={id} />}
    </div>
  )
}

function ProgressPanel({ id, type, requestId }) {
  const { t } = useTranslation()
  const { data, error, isLoading } = useSWR(`/requests/${type}/${requestId}/progress`, fetcher)

  return (
    <div id={id} className="mt-2 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
      {isLoading ? (
        <p className="font-zh text-[11px] text-slate-500 py-2">{t('common.loading')}</p>
      ) : error ? (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-500 text-center">
          {t('progress.loadFailed')}
        </div>
      ) : (
        <>
          <StepList steps={data.steps} activeLevel={data.activeLevel} />
          <Timeline events={data.events} />
        </>
      )}
    </div>
  )
}

function SectionTitle({ label, code, dotClass }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      <h4 className="font-zh text-[12px] text-slate-600">{label}</h4>
      {code && (
        <span className="font-black text-[9px] text-slate-400 uppercase tracking-[0.2em]">{code}</span>
      )}
    </div>
  )
}

function StepList({ steps, activeLevel }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage

  return (
    <section>
      <SectionTitle label={t('progress.stepsTitle')} code={t('progress.stepsCode')} dotClass="bg-amber-400" />
      {steps.length === 0 ? (
        <p className="font-zh text-[11px] text-slate-500">{t('progress.noSteps')}</p>
      ) : (
        <ol className="relative ml-2.5 border-l-2 border-dashed border-slate-200 space-y-3">
          {steps.map((step) => {
            const tone = stepTone(step, activeLevel)
            const style = TONE[tone]
            const StepIcon = style.Icon
            return (
              <li key={step.level} className="relative pl-5">
                <span
                  className={`absolute -left-[11px] top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${style.dot}`}
                  aria-hidden="true"
                >
                  {StepIcon && <StepIcon size={11} strokeWidth={3} />}
                </span>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <p className="font-zh text-[12px] text-slate-700">
                    {t('progress.level', { level: step.level })}
                    <span className="text-slate-500"> · {step.approver?.name || t('progress.noApprover')}</span>
                  </p>
                  <span className={`font-zh text-[11px] ${style.text}`}>{t(`progress.tone.${tone}`)}</span>
                </div>
                {step.decidedAt && (
                  <p className="font-mono text-[10px] text-slate-500 tabular-nums mt-0.5">
                    {formatStamp(step.decidedAt, lang)}
                    {tone === 'skipped' && step.decidedBy?.name && (
                      <span className="font-zh"> · {step.decidedBy.name}</span>
                    )}
                  </p>
                )}
                {step.note && (
                  <p className="font-zh text-[11px] text-slate-500 mt-0.5 break-words">「{step.note}」</p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function Timeline({ events }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage

  return (
    <section>
      <SectionTitle label={t('progress.timelineTitle')} code={t('progress.timelineCode')} dotClass="bg-sky-400" />
      {events.length === 0 ? (
        <p className="font-zh text-[11px] text-slate-500">{t('progress.noEvents')}</p>
      ) : (
        <ul className="space-y-2.5">
          {events.map((event) => {
            const level = eventLevel(event)
            const note = event.meta?.note || event.meta?.reviewNote || event.meta?.cancelReason
            return (
              <li key={event.id} className="flex gap-2.5 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-300 shrink-0 mt-1.5" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-zh text-[12px] text-slate-700">
                    {t(eventLabelKey(event), { level, defaultValue: t('progress.action.unknown') })}
                    {event.meta?.byAdmin && (
                      <span className="ml-1.5 inline-block font-zh text-[10px] text-sky-600 bg-sky-50 border border-sky-100 px-1.5 leading-4">
                        {t('progress.byAdmin')}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    <span className="font-mono tabular-nums">{formatStamp(event.createdAt, lang)}</span>
                    {event.actor?.name && (
                      <span className="font-zh"> · {t('progress.actor', { name: event.actor.name })}</span>
                    )}
                  </p>
                  {note && (
                    <p className="font-zh text-[11px] text-slate-500 break-words">「{note}」</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
