import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import useSWRInfinite from 'swr/infinite'
import {
  ArrowLeft, ArrowRight, AlertCircle, Inbox, LogIn, LogOut, PencilLine, FileText, KeyRound, ShieldCheck, WifiOff,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { fetcher } from '../services/api.js'
import PaperPiece from '../components/PaperPiece.jsx'
import { formatDate, formatDuration, formatTime, getDayName } from '../utils/time.js'
import { leaveTypeLabel } from '../utils/leaveTypes.js'
import {
  ACTIVITY_FILTERS, activityLabelKey, activityTone, attendanceChanges, groupByLocalDate, isByOthers, punchSummary, requestLink,
} from '../utils/activity.js'
import { eventLevel } from '../utils/requestProgress.js'

const PAGE_SIZE = 30

// 同一頁多張紙片用不同方向旋轉（±1deg 內）
const ROTATIONS = ['-0.6deg', '0.5deg', '-0.4deg', '0.7deg', '-0.3deg']

const TONE = {
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-500',
  orange: 'bg-orange-50 border-orange-100 text-orange-500',
  sky: 'bg-sky-50 border-sky-100 text-sky-500',
  amber: 'bg-amber-50 border-amber-100 text-amber-500',
  red: 'bg-red-50 border-red-100 text-red-500',
  slate: 'bg-slate-50 border-slate-200 text-slate-500',
}

const ICONS = {
  'attendance.punched_in': LogIn,
  'attendance.punched_out': LogOut,
  'attendance.edited': PencilLine,
  'attendance.corrected': PencilLine,
  'auth.password_changed': KeyRound,
  'user.password_reset': KeyRound,
  'user.unlocked': ShieldCheck,
}

export default function Activity() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite(
    (pageIndex, previous) => {
      if (previous && !previous.nextCursor) return null
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (filter !== 'all') qs.set('category', filter)
      if (pageIndex > 0) qs.set('cursor', previous.nextCursor)
      return `/my/activity?${qs}`
    },
    fetcher,
    { revalidateFirstPage: false },
  )

  const groups = useMemo(() => groupByLocalDate((data ?? []).flatMap((page) => page.items)), [data])
  const hasMore = Boolean(data?.at(-1)?.nextCursor)
  const loadingMore = isValidating && size > (data?.length ?? 0)

  return (
    <main className="w-full relative z-10 px-4 animate-in slide-in-from-bottom-4 duration-300 py-4 pb-20">
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="flex items-center gap-2 mb-6 text-slate-500 hover:text-slate-700 transition-colors font-zh text-xs active:scale-95"
      >
        <ArrowLeft size={16} aria-hidden="true" /> {t('history.backToProfile')}
      </button>

      <div className="flex items-center gap-1 mb-5 px-1 flex-wrap" role="tablist" aria-label={t('activity.filterAria')}>
        {ACTIVITY_FILTERS.map((key) => {
          const active = filter === key
          return (
            <button
              type="button"
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(key)}
              className={`font-zh text-[12px] px-3 py-1 border transition-colors active:scale-95
                ${active ? 'bg-white text-sky-600 border-sky-200 shadow-sm' : 'bg-transparent text-slate-500 border-transparent hover:text-slate-700'}`}
              style={{ borderRadius: '8px 2px 10px 3px/3px 10px 2px 8px' }}
            >
              {t(`activity.filter.${key}`)}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <p className="text-center text-slate-500 text-xs py-20 font-zh">{t('common.loading')}</p>
      ) : error ? (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-500 text-center">
          {t('activity.loadFailed')}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 opacity-60 flex flex-col items-center gap-2">
          <Inbox size={40} className="text-slate-400" aria-hidden="true" />
          <p className="font-zh text-xs text-slate-500">{t('activity.empty')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group, index) => {
            const day = new Date(`${group.key}T00:00:00`)
            return (
              <section key={group.key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full" aria-hidden="true" />
                  <h3 className="font-mono font-black text-xs text-slate-600 tabular-nums">{formatDate(day, lang)}</h3>
                  <span className="font-zh text-[11px] text-slate-500">{getDayName(day, lang)}</span>
                </div>
                <PaperPiece color="white" rotate={ROTATIONS[index % ROTATIONS.length]} className="px-4 py-1">
                  <ul>
                    {group.items.map((event, i) => (
                      <ActivityItem key={event.id} event={event} isLast={i === group.items.length - 1} />
                    ))}
                  </ul>
                </PaperPiece>
              </section>
            )
          })}

          <div className="flex justify-center pt-2">
            {hasMore ? (
              <button
                type="button"
                onClick={() => setSize(size + 1)}
                disabled={loadingMore}
                className="font-zh text-sm text-slate-600 bg-white border-b-4 border-slate-300 px-5 py-2 active:border-b-0 active:translate-y-[2px] transition-all disabled:opacity-60 disabled:pointer-events-none"
                style={{ borderRadius: '6px 2px 8px 2px/2px 8px 2px 6px' }}
              >
                {loadingMore ? t('common.loading') : t('activity.loadMore')}
              </button>
            ) : (
              <p className="font-zh text-[11px] text-slate-500">{t('activity.end')}</p>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

function ActivityItem({ event, isLast }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const navigate = useNavigate()
  const { user } = useAuth()
  const Icon = ICONS[event.action] ?? FileText
  const punch = punchSummary(event)
  const changes = attendanceChanges(event)
  const link = requestLink(event)
  const byOthers = isByOthers(event, user?.id)
  const note = event.meta?.note || event.meta?.reviewNote || event.meta?.cancelReason

  return (
    <li className={`flex gap-3 py-3 ${isLast ? '' : 'border-b border-dashed border-slate-200'}`}>
      <div
        className={`shrink-0 w-9 h-9 border flex items-center justify-center ${TONE[activityTone(event.action)]}`}
        style={{ borderRadius: '10px 3px 12px 4px/4px 12px 3px 10px' }}
      >
        <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-zh text-sm text-slate-700">
            {t(activityLabelKey(event), { level: eventLevel(event), defaultValue: t('activity.action.unknown') })}
          </p>
          <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">{formatTime(new Date(event.createdAt), lang)}</span>
        </div>

        {punch && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {punch.time && formatTime(new Date(punch.time), lang) !== formatTime(new Date(event.createdAt), lang) && (
              <span className="font-mono font-black text-xs text-slate-600 tabular-nums">{formatTime(new Date(punch.time), lang)}</span>
            )}
            {punch.flag && (
              <span className="inline-flex items-center gap-1 font-zh text-[10px] text-red-500 bg-red-50 border border-red-100 px-1.5 leading-4">
                <AlertCircle size={10} strokeWidth={3} aria-hidden="true" />
                {punch.flag === 'late' ? t('history.late') : t('history.earlyLeave')}
              </span>
            )}
            {punch.offline && (
              <span className="inline-flex items-center gap-1 font-zh text-[10px] text-slate-500">
                <WifiOff size={10} aria-hidden="true" /> {t('activity.offline')}
              </span>
            )}
            {punch.replaced && (
              <span className="font-zh text-[10px] text-slate-500">
                {t('activity.replacedPunchOut', { time: formatTime(new Date(punch.replaced), lang) })}
              </span>
            )}
          </div>
        )}

        {changes.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {changes.map((c) => (
              <li key={c.field} className="font-zh text-[11px] text-slate-500">
                {t('activity.fieldLabel', { field: t(`activity.field.${c.field}`) })}
                <span className="font-mono tabular-nums">
                  <span className="line-through decoration-slate-300">{formatValue(t, lang, c.field, c.before)}</span>
                  {' → '}
                  <span className="text-slate-700 font-black">{formatValue(t, lang, c.field, c.after)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {note && <p className="font-zh text-[11px] text-slate-500 mt-0.5 break-words">「{note}」</p>}

        <div className="flex items-center justify-between gap-2 mt-1">
          {byOthers && event.actor?.name ? (
            <span className="font-zh text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 leading-4">
              {t('activity.byOthers', { name: event.actor.name })}
            </span>
          ) : <span />}
          {link && (
            <button
              type="button"
              onClick={() => navigate(link)}
              className="inline-flex items-center gap-1 font-zh text-[11px] text-sky-600 hover:text-sky-700 active:scale-95 transition-transform"
            >
              {t('activity.viewRequest')} <ArrowRight size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

function formatValue(t, lang, field, value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? t('activity.yes') : t('activity.no')
  if (field === 'punchIn' || field === 'punchOut') return formatTime(new Date(value), lang)
  if (field === 'workDuration') return formatDuration(value)
  if (field === 'leaveType') return leaveTypeLabel(t, value)
  return String(value)
}
