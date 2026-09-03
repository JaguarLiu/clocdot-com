import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/index.js'
import { formatYearMonth, formatList } from '../lib/datetime.js'
import { Wallet, Lock, LockOpen, RefreshCw, Download, ChevronDown, Plus, Trash2, AlertTriangle, CalendarClock } from 'lucide-react'
import PaperPiece from '../components/PaperPiece.jsx'
import PaperToast from '../components/PaperToast.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import MarkerButton from '../components/MarkerButton.jsx'
import {
  getPayrollRun, generatePayrollRun, savePayrollAdjustments,
  lockPayrollRun, unlockPayrollRun, downloadPayrollCSV, cashoutPayroll,
} from '../services/api.js'

function buildMonthOptions(lang) {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = formatYearMonth(d, lang)
    return { value, label }
  })
}
const money = (n) => (n ?? 0).toLocaleString('en-US')
const fmtMin = (t, m) => t('payslip.hoursMinutes', { hours: Math.floor((m ?? 0) / 60), minutes: (m ?? 0) % 60 })

export default function Payroll() {
  const { t } = useTranslation()
  const lang = i18n.resolvedLanguage
  const monthOptions = buildMonthOptions(lang)
  const [month, setMonth] = useState(monthOptions[0].value)
  const [run, setRun] = useState(null)
  const [skipped, setSkipped] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [confirm, setConfirm] = useState(null) // { title, message, onConfirm }
  const [cashoutOpen, setCashoutOpen] = useState(false)
  const [cashoutSel, setCashoutSel] = useState(() => new Set())

  const locked = run?.status === 'locked'
  // PT（時薪制）無特休額度，特休換薪名單排除
  const cashoutable = run ? run.items.filter((i) => i.payslip?.meta?.payType !== 'hourly') : []

  async function load(m) {
    setLoading(true)
    try {
      const data = await getPayrollRun(m)
      setRun(data)
      setSkipped(data.skipped ?? [])
    } catch (err) {
      if (err.status === 404) { setRun(null); setSkipped([]) }
      // 用 i18n 單例而非 hook 的 t：避免 load 閉包到反應式值而動到 effect 依賴
      else setToast({ variant: 'error', message: err.message || i18n.t('common.errLoadFailed') })
    } finally {
      setLoading(false)
    }
  }

  // 月份變動時重新載入；load() 內的 setLoading(true) 屬正常 fetch effect。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(month) }, [month])

  async function doGenerate() {
    setBusy(true)
    try {
      const data = await generatePayrollRun(month)
      setRun(data)
      setSkipped(data.skipped ?? [])
      setToast({ variant: 'success', message: t('payroll.okRun') })
    } catch (err) {
      setToast({ variant: 'error', message: err.message || t('payroll.errRun') })
    } finally { setBusy(false); setConfirm(null) }
  }

  async function doLock() {
    setBusy(true)
    try {
      await lockPayrollRun(month)
      await load(month)
      setToast({ variant: 'success', message: t('payroll.okLocked') })
    } catch (err) {
      setToast({ variant: 'error', message: err.message || t('payroll.errLock') })
    } finally { setBusy(false); setConfirm(null) }
  }

  async function doUnlock() {
    setBusy(true)
    try {
      await unlockPayrollRun(month)
      await load(month)
      setToast({ variant: 'success', message: t('payroll.okUnlocked') })
    } catch (err) {
      setToast({ variant: 'error', message: err.message || t('payroll.errUnlock') })
    } finally { setBusy(false); setConfirm(null) }
  }

  async function saveAdjustments(userId, adjustments) {
    try {
      const updated = await savePayrollAdjustments(month, userId, adjustments)
      setRun((r) => ({ ...r, items: r.items.map((i) => (i.userId === userId ? updated : i)) }))
      setToast({ variant: 'success', message: t('payroll.okAdjustments') })
    } catch (err) {
      setToast({ variant: 'error', message: err.message || t('common.errSaveFailed') })
    }
  }

  async function doCashout() {
    setBusy(true)
    try {
      const data = await cashoutPayroll(month, [...cashoutSel])
      setRun(data)
      setSkipped(data.skipped ?? [])
      setToast({ variant: 'success', message: t('payroll.okCashout') })
      setCashoutOpen(false)
      setCashoutSel(new Set())
    } catch (err) {
      setToast({ variant: 'error', message: err.message || t('payroll.errCashout') })
    } finally { setBusy(false) }
  }

  return (
    <div className="animate-in fade-in duration-300 max-w-7xl">
      {/* 頁面標題 — §3.7 格式 */}
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-lg bg-emerald-500 shadow-sm"
            style={{ transform: 'rotate(-3deg)' }}
          >
            <Wallet size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-3xl font-zh text-slate-800">{t('nav.payroll')}</h2>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
              PAYROLL SETTLEMENT
            </p>
          </div>
        </div>

        {/* 操作區 */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label={t('common.selectMonth')}
              className="appearance-none bg-white px-4 py-2 pr-8 border border-slate-200 shadow-sm text-xs font-black text-slate-600 tracking-tight focus:outline-none"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          </div>
          {!locked && (
            <MarkerButton
              color="#10b981"
              onClick={() => setConfirm({
                title: t('payroll.runTitle'),
                message: t('payroll.runMessage', { month }),
                onConfirm: doGenerate,
              })}
            >
              <RefreshCw size={14} /> {run ? t('payroll.rerun') : t('payroll.run')}
            </MarkerButton>
          )}
          {run && !locked && (
            <MarkerButton
              color="#10b981"
              onClick={() => { setCashoutSel(new Set(run.items.map((i) => i.userId))); setCashoutOpen(true) }}
            >
              <CalendarClock size={14} /> {t('payroll.cashout')}
            </MarkerButton>
          )}
          {run && !locked && (
            <MarkerButton
              color="#f59e0b"
              onClick={() => setConfirm({
                title: t('payroll.lockTitle'),
                message: t('payroll.lockMessage', { month }),
                onConfirm: doLock,
              })}
            >
              <Lock size={14} /> {t('payroll.lock')}
            </MarkerButton>
          )}
          {locked && (
            <MarkerButton
              color="#0ea5e9"
              onClick={() => setConfirm({
                title: t('payroll.unlockTitle'),
                message: t('payroll.unlockMessage', { month }),
                onConfirm: doUnlock,
              })}
            >
              <LockOpen size={14} /> {t('payroll.unlock')}
            </MarkerButton>
          )}
          {run && (
            <MarkerButton
              color="#64748b"
              onClick={() => downloadPayrollCSV(month).catch((e) => setToast({ variant: 'error', message: e.message }))}
            >
              <Download size={14} /> {t('report.export')}
            </MarkerButton>
          )}
        </div>
      </div>

      {/* 鎖定徽記 — §3.8 印章感 */}
      {locked && (
        <div
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-700 border-2 border-dashed border-amber-300 bg-amber-50/60 px-2 py-0.5 mb-4"
        >
          <Lock size={11} /> LOCKED · {run.lockedAt ? new Date(run.lockedAt).toLocaleString('zh-TW') : ''}
        </div>
      )}

      {/* 略過員工警示 */}
      {skipped.length > 0 && (
        <PaperPiece color="#fef2f2" rotate="-0.4deg" variant="card" className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="font-zh text-sm text-slate-700">{t('payroll.skippedTitle')}</span>
          </div>
          <p className="font-zh text-xs text-slate-500">
            {t('payroll.skippedHint', { names: formatList(skipped.map((x) => x.name || x.empNo || x.userId), lang) })}
          </p>
        </PaperPiece>
      )}

      {/* 主體 */}
      {loading ? (
        <p className="font-zh text-sm text-slate-400 py-12 text-center">{t('common.loading')}</p>
      ) : !run ? (
        <p className="font-zh text-sm text-slate-400 py-12 text-center">
          {t('payroll.notRunYet')}
        </p>
      ) : (
        <div className="space-y-2">
          {run.items.map((item) => (
            <PayrollRow
              key={`${item.userId}-${item.updatedAt ?? ''}`}
              item={item}
              locked={locked}
              expanded={expanded === item.userId}
              onToggle={() => setExpanded(expanded === item.userId ? null : item.userId)}
              onSave={(adj) => saveAdjustments(item.userId, adj)}
            />
          ))}
        </div>
      )}

      {cashoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setCashoutOpen(false)}>
          <PaperPiece color="#fdfbf4" rotate="-0.6deg" variant="card" className="w-full max-w-lg p-6" >
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock size={18} className="text-emerald-600" />
                <h3 className="font-zh text-lg text-slate-800">{t('payroll.cashout')}</h3>
              </div>
              <p className="font-zh text-xs text-slate-500 mb-4">
                {t('payroll.cashoutHint')}
              </p>
              <label className="flex items-center gap-2 mb-2 font-zh text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={cashoutSel.size === cashoutable.length && cashoutable.length > 0}
                  onChange={(e) => setCashoutSel(e.target.checked ? new Set(cashoutable.map((i) => i.userId)) : new Set())}
                />
                {t('payroll.selectAll', { selected: cashoutSel.size, total: cashoutable.length })}
              </label>
              <div className="max-h-64 overflow-auto border border-dashed border-slate-200 divide-y divide-slate-100">
                {cashoutable.map((i) => (
                  <label key={i.userId} className="flex items-center gap-3 px-3 py-2 font-zh text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={cashoutSel.has(i.userId)}
                      onChange={(e) => setCashoutSel((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(i.userId); else next.delete(i.userId)
                        return next
                      })}
                    />
                    <span className="font-mono text-xs text-slate-400 w-10">{i.empNo ?? '—'}</span>
                    <span className="flex-1">{i.name}</span>
                    {i.payslip?.earnings?.leaveCashout && (
                      <span className="font-mono text-xs text-emerald-700">{t('payroll.cashedOut', { amount: money(i.payslip.earnings.leaveCashout.amount) })}</span>
                    )}
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-end gap-3 mt-5">
                <button type="button" onClick={() => setCashoutOpen(false)} className="font-zh text-sm text-slate-500 px-3 py-1.5">{t('common.cancel')}</button>
                <MarkerButton color="#10b981" disabled={busy || cashoutSel.size === 0} onClick={doCashout}>
                  {t('payroll.applyCashout', { count: cashoutSel.size })}
                </MarkerButton>
              </div>
            </div>
          </PaperPiece>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        loading={busy}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />

      {toast && (
        <PaperToast
          variant={toast.variant}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}

function PayrollRow({ item, locked, expanded, onToggle, onSave }) {
  const { t } = useTranslation()
  const p = item.payslip
  // key includes updatedAt so the component remounts after a successful save,
  // resetting adj to the server-confirmed adjustments without needing a setState-in-effect.
  const [adj, setAdj] = useState(item.adjustments ?? [])

  return (
    <PaperPiece color="#fdfbf4" rotate="-0.2deg" variant="card" className="p-4">
      {/* 摘要列 */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left active:scale-[0.98] transition-transform"
        >
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
          <span className="font-mono text-xs text-slate-400 w-12">{item.empNo ?? '—'}</span>
          <span className="font-zh text-sm text-slate-800">{item.name}</span>
          {p?.meta?.unpaidAbsentMonth && (
            <span className="font-zh text-[10px] px-2 py-0.5 bg-red-50 text-red-600 border border-red-200">
              {t('payroll.zeroAttendance')}
            </span>
          )}
        </button>
        <div className="flex items-center gap-6 font-mono text-sm tabular-nums">
          <span className="text-slate-500">{t('payroll.abbrGross', { amount: money(item.grossPay) })}</span>
          <span className="text-red-500">{t('payroll.abbrDeductions', { amount: money(item.totalDeductions) })}</span>
          <span className="text-sky-600">{t('payroll.abbrAdjustments', { amount: money(item.adjustmentsTotal) })}</span>
          <span className="text-emerald-700 font-black w-28 text-right">{t('payroll.abbrNet', { amount: money(item.netPay) })}</span>
        </div>
      </div>

      {/* 展開明細 */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          {p.meta?.payType === 'hourly' ? (
            <Line label={t('payslip.hourlyLine', { rate: money(p.earnings.hourlyRate), duration: fmtMin(t, p.earnings.regularMinutes) })} v={p.earnings.regularPay} />
          ) : (
            <>
              <Line label={t('payslip.baseSalary')} v={p.earnings.baseSalary} />
              {(p.earnings.allowances ?? []).map((a, i) => (
                <Line key={i} label={t('payslip.allowance', { name: a.name })} v={a.amount} />
              ))}
            </>
          )}
          {(p.earnings.overtime?.tiers ?? []).map((tier, i) => (
            <Line key={i} label={t('payslip.overtimeTier', { rate: tier.rate, minutes: tier.minutes })} v={tier.amount} />
          ))}
          {p.earnings.leaveCashout && (
            <Line label={t('payroll.cashoutLine', { days: p.earnings.leaveCashout.days })} v={p.earnings.leaveCashout.amount} />
          )}
          <Line label={t('payslip.grossPay')} v={p.earnings.grossPay} strong />
          <Line label={t('payslip.laborInsurance')} v={-p.deductions.laborInsurance} />
          <Line label={t('payslip.healthInsurance')} v={-p.deductions.healthInsurance} />
          <Line label={t('payslip.pensionVoluntary')} v={-p.deductions.pensionVoluntary} />
          <Line label={t('payslip.incomeTax')} v={-p.deductions.incomeTax} />
          {p.deductions.attendanceDeduction > 0 && (
            <Line label={t('payslip.attendanceDeduction')} v={-p.deductions.attendanceDeduction} />
          )}
          {p.deductions.leaveDeduction > 0 && (
            <Line label={t('payslip.leaveDeduction')} v={-p.deductions.leaveDeduction} />
          )}
          <Line label={t('payslip.deductionsTotal')} v={-p.deductions.total} strong />

          {/* 手動調整區 */}
          <div className="col-span-2 mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-zh text-slate-500">{t('payroll.manualAdjustments')}</span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => setAdj([...adj, { label: '', amount: 0 }])}
                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-sky-700 active:scale-[0.97]"
                >
                  <Plus size={12} /> {t('common.add')}
                </button>
              )}
            </div>
            {adj.map((a, i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <input
                  disabled={locked}
                  placeholder={t('payroll.adjustmentLabel')}
                  value={a.label}
                  onChange={(e) =>
                    setAdj(adj.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))
                  }
                  className="flex-1 px-2 py-1 bg-white border border-slate-200 outline-none font-zh text-sm disabled:bg-slate-50"
                />
                <input
                  disabled={locked}
                  type="number"
                  placeholder={t('payroll.adjustmentAmount')}
                  value={a.amount}
                  onChange={(e) =>
                    setAdj(adj.map((x, idx) => (idx === i ? { ...x, amount: e.target.value } : x)))
                  }
                  className="w-28 px-2 py-1 bg-white border border-slate-200 outline-none font-mono text-sm disabled:bg-slate-50"
                />
                {!locked && (
                  <button
                    type="button"
                    onClick={() => setAdj(adj.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 active:scale-[0.97]"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {!locked && (
              <div className="mt-2">
                <MarkerButton
                  color="#0ea5e9"
                  onClick={() =>
                    onSave(adj.map((a) => ({ label: a.label, amount: parseInt(a.amount, 10) || 0 })))
                  }
                >
                  {t('payroll.saveAdjustments')}
                </MarkerButton>
              </div>
            )}
          </div>
        </div>
      )}
    </PaperPiece>
  )
}

function Line({ label, v, strong }) {
  return (
    <div
      className={`flex items-center justify-between ${strong ? 'font-black text-slate-700' : 'text-slate-500'}`}
    >
      <span className="font-zh">{label}</span>
      <span className="font-mono tabular-nums">{money(v)}</span>
    </div>
  )
}
