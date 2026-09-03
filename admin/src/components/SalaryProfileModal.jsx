import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wallet, Plus, Trash2, Check, X } from 'lucide-react'
import PaperPiece from './PaperPiece.jsx'
import MarkerButton from './MarkerButton.jsx'
import { getSalaryProfile, saveSalaryProfile, updateUser } from '../services/api.js'

const EMPTY = {
  baseSalary: '',
  hourlyRate: '',
  allowances: [],
  laborInsuredSalary: '',
  healthInsuredSalary: '',
  healthDependents: 0,
  pensionVoluntaryRate: 0,
  taxDependents: 0,
  bankAccount: '',
  note: '',
}

const toIntOrNull = (v) => (v === '' || v === null ? null : parseInt(v, 10))

export default function SalaryProfileModal({ open, employee, onClose, onToast, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const isHourly = employee?.employmentType === 'parttime'

  // 開啟時載入該員工薪資設定；setLoading(true) 為抓取前的載入旗標，屬正常 fetch effect。
  useEffect(() => {
    if (!open || !employee) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    getSalaryProfile(employee.id)
      .then((p) => {
        setForm(p ? {
          baseSalary: p.baseSalary ?? '',
          hourlyRate: p.hourlyRate ?? '',
          allowances: Array.isArray(p.allowances) ? p.allowances : [],
          laborInsuredSalary: p.laborInsuredSalary ?? '',
          healthInsuredSalary: p.healthInsuredSalary ?? '',
          healthDependents: p.healthDependents ?? 0,
          pensionVoluntaryRate: p.pensionVoluntaryRate ?? 0,
          taxDependents: p.taxDependents ?? 0,
          bankAccount: p.bankAccount ?? '',
          note: p.note ?? '',
        } : EMPTY)
      })
      .catch(() => onToast?.({ variant: 'error', message: t('salary.errLoad') }))
      .finally(() => setLoading(false))
  }, [open, employee, onToast, t])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  function setAllowance(i, key, value) {
    setForm((f) => ({
      ...f,
      allowances: f.allowances.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)),
    }))
  }
  function addAllowance() {
    setForm((f) => ({ ...f, allowances: [...f.allowances, { name: '', amount: 0, insured: true, taxable: true }] }))
  }
  function removeAllowance(i) {
    setForm((f) => ({ ...f, allowances: f.allowances.filter((_, idx) => idx !== i) }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      // 從員工編輯表單帶過來的未存變更（含身分），先存員工再存薪資——
      // 後端依 DB 身分驗證薪資欄位，順序不可反
      if (employee.pendingUserPayload) {
        await updateUser(employee.id, employee.pendingUserPayload)
      }
      const common = {
        laborInsuredSalary: toIntOrNull(form.laborInsuredSalary),
        healthInsuredSalary: toIntOrNull(form.healthInsuredSalary),
        healthDependents: parseInt(form.healthDependents, 10) || 0,
        pensionVoluntaryRate: Number(form.pensionVoluntaryRate) || 0,
        taxDependents: parseInt(form.taxDependents, 10) || 0,
        bankAccount: form.bankAccount,
        note: form.note,
      }
      await saveSalaryProfile(employee.id, isHourly
        ? { hourlyRate: toIntOrNull(form.hourlyRate), ...common }
        : {
            baseSalary: toIntOrNull(form.baseSalary),
            allowances: form.allowances.map((a) => ({
              name: a.name,
              amount: parseInt(a.amount, 10) || 0,
              insured: Boolean(a.insured),
              taxable: Boolean(a.taxable),
            })),
            ...common,
          })
      onToast?.({ variant: 'success', message: employee.pendingUserPayload ? t('salary.okSavedWithEmployee') : t('salary.okSaved') })
      onSaved?.()
      onClose()
    } catch (err) {
      onToast?.({ variant: 'error', message: err.message || t('common.errSaveFailed') })
    } finally {
      setBusy(false)
    }
  }

  if (!open || !employee) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label={t('common.close')}
        tabIndex={-1}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-[#1c1810]/20 backdrop-blur-[2px] cursor-default"
      />
      <PaperPiece
        color="#fdfbf4"
        rotate="-0.4deg"
        variant="card"
        className="relative w-full max-w-lg p-7 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start gap-4 mb-5">
          <div
            className="bg-emerald-600 p-2.5 rounded-lg shadow-sm shrink-0"
            style={{ transform: 'rotate(-3deg)' }}
          >
            <Wallet size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="font-zh text-lg text-slate-800 flex items-center gap-2">
              {t('salary.title')}
              {isHourly && (
                <span
                  className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-widest"
                  style={{ transform: 'rotate(-1deg)' }}
                >
                  {t('salary.hourlyToggle')}
                </span>
              )}
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
              {employee?.name || employee?.email}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="font-zh text-sm text-slate-400 py-8 text-center">{t('common.loading')}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {isHourly ? (
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('salary.hourlyRate')}</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.hourlyRate}
                  onChange={(e) => set('hourlyRate', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono text-sm text-slate-700"
                />
              </label>
            ) : (
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('salary.baseSalary')}</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.baseSalary}
                  onChange={(e) => set('baseSalary', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono text-sm text-slate-700"
                />
              </label>
            )}

            {!isHourly && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-zh text-xs text-slate-500">{t('salary.allowances')}</span>
                <button
                  type="button"
                  onClick={addAllowance}
                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 active:scale-95"
                >
                  <Plus size={12} /> {t('common.add')}
                </button>
              </div>
              <div className="space-y-2">
                {form.allowances.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 border-b border-dashed border-slate-100 pb-2">
                    <input
                      placeholder={t('salary.allowanceName')}
                      value={a.name}
                      onChange={(e) => setAllowance(i, 'name', e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-white border border-slate-200 outline-none font-zh text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder={t('salary.allowanceAmount')}
                      value={a.amount}
                      onChange={(e) => setAllowance(i, 'amount', e.target.value)}
                      className="w-24 px-2 py-1.5 bg-white border border-slate-200 outline-none font-mono text-sm tabular-nums"
                    />
                    <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={a.insured}
                        onChange={(e) => setAllowance(i, 'insured', e.target.checked)}
                      />
                      {t('salary.insured')}
                    </label>
                    <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={a.taxable}
                        onChange={(e) => setAllowance(i, 'taxable', e.target.checked)}
                      />
                      {t('salary.taxable')}
                    </label>
                    <button
                      type="button"
                      aria-label={t('salary.deleteAllowance')}
                      onClick={() => removeAllowance(i)}
                      className="text-red-400 hover:text-red-600 active:scale-95"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('salary.laborInsuranceBase')}</span>
                <input
                  type="number"
                  min="0"
                  value={form.laborInsuredSalary}
                  onChange={(e) => set('laborInsuredSalary', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono text-sm tabular-nums"
                />
              </label>
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('salary.healthInsuranceBase')}</span>
                <input
                  type="number"
                  min="0"
                  value={form.healthInsuredSalary}
                  onChange={(e) => set('healthInsuredSalary', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono text-sm tabular-nums"
                />
              </label>
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('salary.healthDependents')}</span>
                <input
                  type="number"
                  min="0"
                  value={form.healthDependents}
                  onChange={(e) => set('healthDependents', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono text-sm tabular-nums"
                />
              </label>
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('salary.taxDependents')}</span>
                <input
                  type="number"
                  min="0"
                  value={form.taxDependents}
                  onChange={(e) => set('taxDependents', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono text-sm tabular-nums"
                />
              </label>
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('salary.pensionRate')}</span>
                <input
                  type="number"
                  min="0"
                  max="0.06"
                  step="0.001"
                  value={form.pensionVoluntaryRate}
                  onChange={(e) => set('pensionVoluntaryRate', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono text-sm tabular-nums"
                />
              </label>
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('salary.bankAccount')}</span>
                <input
                  value={form.bankAccount}
                  onChange={(e) => set('bankAccount', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono text-sm"
                />
              </label>
            </div>

            <label className="block">
              <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('common.note')}</span>
              <input
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm"
              />
            </label>

            <div className="flex items-center justify-end gap-3 pt-1">
              <MarkerButton
                color="#94a3b8"
                rotate="0.5deg"
                onClick={() => !busy && onClose()}
                disabled={busy}
              >
                <X size={14} strokeWidth={3} />
                {t('common.cancel')}
              </MarkerButton>
              <MarkerButton
                as="button"
                type="submit"
                color="#10b981"
                rotate="-0.5deg"
                disabled={busy}
              >
                <Check size={14} strokeWidth={3} />
                {busy ? t('common.saving') : t('common.save')}
              </MarkerButton>
            </div>
          </form>
        )}
      </PaperPiece>
    </div>
  )
}
