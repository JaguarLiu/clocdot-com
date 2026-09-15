import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWRInfinite from 'swr/infinite'
import { ScrollText, ChevronDown, ChevronRight, Inbox, X, Bot } from 'lucide-react'
import { fetcher } from '../services/api.js'
import PaperPiece from '../components/PaperPiece.jsx'
import { formatDateTime } from '../lib/datetime.js'
import { leaveTypeLabel, minutesToDays } from '../utils/leaveTypes.js'
import {
  AUDIT_CATEGORIES, actionLabelKey, actionTone, auditSummary, buildAuditQuery, changedFieldRows, formatAuditValue,
} from '../lib/auditLog.js'

const PAGE_SIZE = 50

const TONE_CLASSES = {
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  orange: 'bg-orange-50 border-orange-100 text-orange-700',
  sky: 'bg-sky-50 border-sky-100 text-sky-700',
  amber: 'bg-amber-50 border-amber-100 text-amber-700',
  red: 'bg-red-50 border-red-100 text-red-600',
  slate: 'bg-slate-50 border-slate-200 text-slate-600',
}

const FIELD_CLASS = 'appearance-none bg-white px-3 py-2 border border-slate-200 shadow-sm text-xs font-black text-slate-600 tracking-tight focus:outline-none focus:border-sky-400'

const EMPTY_FILTERS = { from: '', to: '', category: '', actorId: '', targetUserId: '' }

const PLAIN_LOG = { entityType: null }

// 假別政策的 before / after 以假別為 key，其餘以欄位名為 key
function fieldLabel(t, log, field) {
  if (log.entityType === 'leave_policy') return leaveTypeLabel(t, field)
  return t(`auditLog.field.${field}`, { defaultValue: field })
}

export default function AuditLog() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  // 點選姓名篩選時，保留姓名給 chip 顯示
  const [personLabel, setPersonLabel] = useState('')
  const [expanded, setExpanded] = useState(null)

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite(
    (pageIndex, previous) => {
      if (previous && !previous.nextCursor) return null
      const cursor = pageIndex === 0 ? undefined : previous.nextCursor
      return `/admin/audit-logs?${buildAuditQuery(filters, { limit: PAGE_SIZE, cursor })}`
    },
    fetcher,
    { revalidateFirstPage: false },
  )

  const rows = useMemo(() => (data ?? []).flatMap((page) => page.items), [data])
  const hasMore = Boolean(data?.at(-1)?.nextCursor)
  const loadingMore = isValidating && size > (data?.length ?? 0)
  const hasFilters = Object.values(filters).some(Boolean)

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setExpanded(null)
  }

  function filterByPerson(role, person) {
    if (!person?.id) return
    setFilters((prev) => ({ ...prev, actorId: '', targetUserId: '', [role]: person.id }))
    setPersonLabel(person.name || person.email || person.id)
    setExpanded(null)
  }

  function clearPerson() {
    setFilters((prev) => ({ ...prev, actorId: '', targetUserId: '' }))
    setPersonLabel('')
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-10">
        <div className="p-2.5 rounded-lg bg-sky-500 shadow-sm" style={{ transform: 'rotate(-3deg)' }}>
          <ScrollText size={22} className="text-white" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-3xl font-zh text-slate-800">{t('nav.auditLog')}</h2>
          {t('auditLog.taglineCode') && (
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
              {t('auditLog.taglineCode')}
            </p>
          )}
        </div>
      </div>

      {/* 篩選列 */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('auditLog.from')}</span>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => updateFilter('from', e.target.value)} className={FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('auditLog.to')}</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter('to', e.target.value)} className={FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('auditLog.categoryLabel')}</span>
          <div className="relative">
            <select value={filters.category} onChange={(e) => updateFilter('category', e.target.value)} className={`${FIELD_CLASS} pr-8 min-w-[140px]`}>
              <option value="">{t('auditLog.allCategories')}</option>
              {AUDIT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`auditLog.category.${c}`)}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          </div>
        </label>

        {personLabel && (
          <span
            className="inline-flex items-center gap-2 bg-white border-2 border-dashed border-sky-300 px-3 py-1.5 font-zh text-xs text-sky-700"
            style={{ borderRadius: '8px 2px 10px 3px/3px 10px 2px 8px' }}
          >
            {filters.actorId ? t('auditLog.chipActor', { name: personLabel }) : t('auditLog.chipTarget', { name: personLabel })}
            <button type="button" onClick={clearPerson} aria-label={t('auditLog.clearPerson')} className="text-sky-500 hover:text-sky-700 active:scale-90 transition-transform">
              <X size={13} strokeWidth={3} aria-hidden="true" />
            </button>
          </span>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setFilters(EMPTY_FILTERS); setPersonLabel(''); setExpanded(null) }}
            className="font-zh text-xs text-slate-500 hover:text-slate-700 underline decoration-dashed decoration-slate-300 underline-offset-4 py-2 active:scale-[0.97] transition-colors"
          >
            {t('auditLog.clearFilters')}
          </button>
        )}
      </div>

      <p className="font-zh text-[11px] text-slate-500 mb-2">{t('auditLog.hint')}</p>

      {isLoading ? (
        <p className="text-center text-slate-400 text-sm py-24 font-zh">{t('common.loading')}</p>
      ) : error ? (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-sm font-zh text-red-500 text-center">
          {error.message || t('common.errLoadFailed')}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-24 opacity-40 flex flex-col items-center gap-3">
          <Inbox size={48} className="text-slate-300" aria-hidden="true" />
          <p className="font-zh text-sm text-slate-400">{hasFilters ? t('auditLog.emptyFiltered') : t('auditLog.empty')}</p>
        </div>
      ) : (
        <>
          <PaperPiece variant="card" rotate="-0.2deg" className="shadow-md overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-dashed border-slate-200">
                  {[t('auditLog.colTime'), t('auditLog.colActor'), t('auditLog.colAction'), t('auditLog.colTarget'), t('auditLog.colSummary')].map((h) => (
                    <th key={h} className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th className="px-2 py-4"><span className="sr-only">{t('auditLog.colDetail')}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((log, idx) => (
                  <AuditRow
                    key={log.id}
                    log={log}
                    isLast={idx === rows.length - 1}
                    isOpen={expanded === log.id}
                    onToggle={() => setExpanded((cur) => (cur === log.id ? null : log.id))}
                    onPerson={filterByPerson}
                  />
                ))}
              </tbody>
            </table>
          </PaperPiece>

          <div className="flex justify-center mt-6">
            {hasMore ? (
              <button
                type="button"
                onClick={() => setSize(size + 1)}
                disabled={loadingMore}
                className="relative group active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
              >
                <div className="absolute inset-0 bg-slate-300 translate-y-[2px]" />
                <div className="relative bg-white border border-slate-300 text-slate-600 px-5 py-2 font-zh text-sm group-hover:-translate-y-[1px] transition-transform">
                  {loadingMore ? t('common.loading') : t('auditLog.loadMore')}
                </div>
              </button>
            ) : (
              <p className="font-zh text-[11px] text-slate-400">{t('auditLog.end')}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function PersonCell({ person, fallback, role, onPerson }) {
  const { t } = useTranslation()
  if (!person) return <span className="font-zh text-xs text-slate-400">{fallback}</span>
  const name = person.name || person.email || t('auditLog.unknownUser')
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onPerson(role, person) }}
      title={role === 'actorId' ? t('auditLog.filterByActor') : t('auditLog.filterByTarget')}
      className="text-left group active:scale-[0.97] transition-transform"
    >
      <span className="font-zh text-sm text-slate-700 group-hover:text-sky-600 underline decoration-dashed decoration-transparent group-hover:decoration-sky-300 underline-offset-4">
        {name}
      </span>
      {person.empNo != null && (
        <span className="block text-[10px] font-black text-slate-400 tabular-nums">#{person.empNo}</span>
      )}
    </button>
  )
}

function AuditRow({ log, isLast, isOpen, onToggle, onPerson }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const summary = auditSummary(log)
  const rowBorder = isLast && !isOpen ? '' : 'border-b border-dashed border-slate-100'

  let summaryText = '—'
  if (summary.type === 'cells') summaryText = t('auditLog.summaryCells', { count: summary.count })
  else if (summary.type === 'people') summaryText = t('auditLog.summaryPeople', { count: summary.count })
  else if (summary.type === 'fields') {
    // 欄位名稱清單用語系分隔符（Intl.ListFormat 的 unit 樣式在中文不加分隔）
    summaryText = summary.fields.map((f) => fieldLabel(t, log, f)).join(t('auditLog.listSeparator'))
  }

  return (
    <Fragment>
      <tr
        onClick={onToggle}
        className={`cursor-pointer hover:bg-slate-50/60 transition-colors ${rowBorder} ${isOpen ? 'bg-sky-50/40' : ''}`}
      >
        <td className="px-4 py-3 whitespace-nowrap font-mono font-black text-xs text-slate-600 tabular-nums">
          {formatDateTime(new Date(log.createdAt), lang)}
        </td>
        <td className="px-4 py-3">
          <PersonCell person={log.actor} role="actorId" onPerson={onPerson} fallback={
            <span className="inline-flex items-center gap-1"><Bot size={12} aria-hidden="true" />{t('auditLog.system')}</span>
          } />
        </td>
        <td className="px-4 py-3">
          <span className={`inline-block border px-2 py-0.5 font-zh text-xs whitespace-nowrap ${TONE_CLASSES[actionTone(log.action)]}`}>
            {t(actionLabelKey(log.action), { defaultValue: log.action })}
          </span>
        </td>
        <td className="px-4 py-3">
          <PersonCell person={log.target} role="targetUserId" onPerson={onPerson} fallback="—" />
        </td>
        <td className="px-4 py-3 font-zh text-xs text-slate-500 max-w-[280px] truncate">{summaryText}</td>
        <td className="px-2 py-3 text-slate-400">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            aria-expanded={isOpen}
            aria-label={isOpen ? t('auditLog.collapse') : t('auditLog.expand')}
            className="p-1 hover:text-sky-600 active:scale-90 transition-transform"
          >
            {isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className={isLast ? '' : 'border-b border-dashed border-slate-100'}>
          <td colSpan={6} className="px-6 pb-5 pt-1 bg-sky-50/40">
            <AuditDetail log={log} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function useValueFormatter(log) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  return (value) => {
    if (log.entityType === 'leave_policy') {
      if (!value) return t('auditLog.policyUnset')
      const rate = value.deductRate == null ? t('auditLog.policyRateDefault') : String(value.deductRate)
      return t('auditLog.policyValue', { days: minutesToDays(value.annualQuotaMinutes), rate })
    }
    const out = formatAuditValue(value, { formatDateTime: (d) => formatDateTime(d, lang) })
    return typeof out === 'object' ? t(out.bool ? 'auditLog.yes' : 'auditLog.no') : out
  }
}

function AuditDetail({ log }) {
  const { t } = useTranslation()
  const fmt = useValueFormatter(log)
  const fmtMeta = useValueFormatter(PLAIN_LOG)
  const fieldRows = changedFieldRows(log.before, log.after)
  const meta = log.meta && typeof log.meta === 'object' ? Object.entries(log.meta) : []

  return (
    <div className="grid gap-6 md:grid-cols-2 pt-3">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t('auditLog.changes')}</p>
        {fieldRows.length === 0 ? (
          <p className="font-zh text-xs text-slate-500">{t('auditLog.noChanges')}</p>
        ) : (
          <table className="w-full bg-white border border-slate-200">
            <thead>
              <tr className="border-b border-dashed border-slate-200">
                {[t('auditLog.colField'), t('auditLog.colBefore'), t('auditLog.colAfter')].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fieldRows.map((r, i) => (
                <tr key={r.field} className={i === fieldRows.length - 1 ? '' : 'border-b border-dashed border-slate-100'}>
                  <td className="px-3 py-2 font-zh text-xs text-slate-600 whitespace-nowrap">
                    {fieldLabel(t, log, r.field)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-red-500 break-all line-through decoration-red-200">{fmt(r.before)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-emerald-700 break-all">{fmt(r.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="space-y-4">
        {meta.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t('auditLog.meta')}</p>
            <dl className="bg-white border border-slate-200 divide-y divide-dashed divide-slate-100">
              {meta.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2">
                  <dt className="font-zh text-xs text-slate-500">{t(`auditLog.metaKey.${key}`, { defaultValue: key })}</dt>
                  <dd className="font-mono text-xs text-slate-700 break-all max-h-40 overflow-y-auto custom-scrollbar">
                    {key === 'users' && Array.isArray(value) ? (
                      <ul className="space-y-0.5">
                        {value.map((u, i) => (
                          <li key={u.email ?? i}>
                            <span className="font-zh">{u.name || '—'}</span>
                            {u.empNo != null && <span className="text-slate-400"> #{u.empNo}</span>}
                            <span className="text-slate-500"> · {u.email}</span>
                          </li>
                        ))}
                      </ul>
                    ) : fmtMeta(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t('auditLog.source')}</p>
          <dl className="bg-white border border-slate-200 divide-y divide-dashed divide-slate-100">
            <div className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2">
              <dt className="font-zh text-xs text-slate-500">IP</dt>
              <dd className="font-mono text-xs text-slate-700">{log.ip || '—'}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2">
              <dt className="font-zh text-xs text-slate-500">{t('auditLog.userAgent')}</dt>
              <dd className="font-mono text-[11px] text-slate-600 break-all">{log.userAgent || '—'}</dd>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2">
              <dt className="font-zh text-xs text-slate-500">{t('auditLog.entity')}</dt>
              <dd className="font-mono text-[11px] text-slate-600 break-all">
                {log.entityType}{log.entityId ? ` · ${log.entityId}` : ''}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
