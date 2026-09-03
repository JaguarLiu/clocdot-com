import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { Clock3, Plus, Pencil, Trash2, Check, X, Star } from 'lucide-react'
import { fetcher, createShift, updateShift, deleteShift } from '../services/api.js'
import PaperPiece from './PaperPiece.jsx'
import MarkerButton from './MarkerButton.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { formatShiftRange } from '../lib/shiftTime.js'

const EMPTY_FORM = { name: '', startTime: '09:00', endTime: '18:00', breakMinutes: 60, isDefault: false }

// 班別管理 popup（排班頁的「貼紙簿」）：清單 + 新增/編輯表單。
// SWR key 與排班頁調色盤共用（/admin/shifts），這裡 mutate 後調色盤即時更新。
export default function ShiftManagerModal({ open, onClose, onToast, onCreated, onDeleted }) {
  const { t } = useTranslation()
  const { data, mutate } = useSWR(open ? '/admin/shifts' : null, fetcher)
  const shifts = data ?? []
  const [editing, setEditing] = useState(null) // null | 'new' | shift.id
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function openNew() { setEditing('new'); setForm(EMPTY_FORM) }
  function openEdit(s) {
    setEditing(s.id)
    setForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes, isDefault: s.isDefault })
  }
  function cancelEdit() { setEditing(null); setForm(EMPTY_FORM) }

  async function save(e) {
    e.preventDefault()
    const breakMin = Number(form.breakMinutes)
    if (!form.name.trim()) { onToast({ variant: 'error', message: t('shift.errNameRequired') }); return }
    if (!form.startTime || !form.endTime || form.startTime === form.endTime) {
      onToast({ variant: 'error', message: t('shift.errSameTime') }); return
    }
    if (!Number.isInteger(breakMin) || breakMin < 0 || breakMin > 480) {
      onToast({ variant: 'error', message: t('shift.errBreakRange') }); return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(), startTime: form.startTime, endTime: form.endTime,
        breakMinutes: breakMin, isDefault: form.isDefault,
      }
      if (editing === 'new') {
        const created = await createShift(payload)
        onCreated?.(created)
        onToast({ variant: 'success', message: t('shift.okCreated') })
      } else {
        await updateShift(editing, payload)
        onToast({ variant: 'success', message: t('shift.okUpdated') })
      }
      mutate()
      cancelEdit()
    } catch (err) {
      onToast({ variant: 'error', message: err?.message || t('common.errActionFailed') })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteShift(deleteTarget.id)
      onDeleted?.(deleteTarget.id)
      mutate()
      onToast({ variant: 'success', message: t('shift.okDisabled') })
      setDeleteTarget(null)
    } catch (err) {
      onToast({ variant: 'error', message: err?.message || t('common.errDeleteFailed') })
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true">
      <button type="button" aria-label="close" tabIndex={-1} onClick={() => !saving && onClose()} className="absolute inset-0 bg-[#1c1810]/20 backdrop-blur-[2px] cursor-default" />
      <PaperPiece color="#fdfbf4" rotate="-0.3deg" variant="card" className="relative w-full max-w-lg p-7 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-start gap-4 mb-5">
          <div className="bg-emerald-500 p-2.5 rounded-lg shadow-sm shrink-0" style={{ transform: 'rotate(-4deg)' }}>
            <Clock3 size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 pt-0.5 flex-1">
            <h3 className="font-zh text-lg text-slate-800">{t('shift.title')}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">Shift Templates</p>
          </div>
          {editing === null && (
            <MarkerButton color="#10b981" rotate="-0.6deg" fontSize={12} onClick={openNew}>
              <Plus size={13} strokeWidth={3} />{t('shift.add')}
            </MarkerButton>
          )}
        </div>

        <div className="space-y-2 mb-5">
          {shifts.length === 0 ? (
            <p className="font-zh text-sm text-slate-400 text-center py-3">{t('shift.empty')}</p>
          ) : shifts.map((s) => (
            <div key={s.id} className="flex items-center gap-3 bg-white border border-slate-200 p-3" style={{ borderRadius: '6px 2px 7px 3px/3px 7px 2px 6px' }}>
              <div className="min-w-0 flex-1">
                <p className="font-zh text-sm text-slate-700 flex items-center gap-1.5">
                  {s.name}
                  {s.isDefault && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-px" style={{ borderRadius: '4px 1px 5px 2px/2px 5px 1px 4px' }}>
                      <Star size={9} strokeWidth={3} />Default
                    </span>
                  )}
                </p>
                <p className="font-mono font-black text-xs text-slate-500 tabular-nums mt-0.5">
                  {formatShiftRange(s)}
                  <span className="font-zh font-normal text-slate-400 ml-2">{t('shift.breakMinutes', { minutes: s.breakMinutes })}</span>
                </p>
              </div>
              <MarkerButton color="#10b981" rotate="-0.5deg" fontSize={11} onClick={() => openEdit(s)} title={t('common.edit')} ariaLabel={t('shift.editAria')} contentStyle={{ padding: '7px' }}>
                <Pencil size={12} strokeWidth={3} />
              </MarkerButton>
              <MarkerButton color="#ef4444" rotate="0.5deg" fontSize={11} onClick={() => setDeleteTarget(s)} title={t('shift.disable')} ariaLabel={t('shift.disableAria')} contentStyle={{ padding: '7px' }}>
                <Trash2 size={12} strokeWidth={3} />
              </MarkerButton>
            </div>
          ))}
        </div>

        {editing !== null && (
          <form onSubmit={save} className="bg-white border border-slate-200 p-4 space-y-3 mb-5" style={{ borderRadius: '6px 2px 7px 3px/3px 7px 2px 6px' }}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
              {editing === 'new' ? 'New Shift' : 'Edit Shift'}
            </p>
            <label className="block">
              <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('shift.fieldName')}</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('shift.namePlaceholder')}
                className="w-full px-3 py-2 bg-[#fdfbf4] border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm text-slate-700"
              />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('shift.fieldStart')}</span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#fdfbf4] border border-slate-200 focus:border-emerald-400 outline-none font-mono tabular-nums text-sm text-slate-700"
                />
              </label>
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('shift.fieldEnd')}</span>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#fdfbf4] border border-slate-200 focus:border-emerald-400 outline-none font-mono tabular-nums text-sm text-slate-700"
                />
              </label>
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('shift.fieldBreak')}</span>
                <input
                  type="number"
                  min={0}
                  max={480}
                  step={5}
                  value={form.breakMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, breakMinutes: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-[#fdfbf4] border border-slate-200 focus:border-emerald-400 outline-none font-mono tabular-nums text-sm text-slate-700"
                />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 select-none font-zh text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              {t('shift.setDefault')}
              <span className="font-zh text-xs text-slate-400">{t('shift.setDefaultHint')}</span>
            </label>
            <div className="flex items-center gap-3 pt-1">
              <MarkerButton as="button" type="submit" color="#10b981" rotate="-0.5deg" fontSize={12} disabled={saving}>
                <Check size={13} strokeWidth={3} />{saving ? t('common.saving') : t('common.save')}
              </MarkerButton>
              <MarkerButton color="#94a3b8" rotate="0.5deg" fontSize={12} onClick={cancelEdit} disabled={saving}>
                <X size={13} strokeWidth={3} />{t('common.cancel')}
              </MarkerButton>
            </div>
          </form>
        )}

        <div className="flex items-center justify-end">
          <MarkerButton color="#94a3b8" rotate="0.5deg" onClick={() => !saving && onClose()}>
            <X size={14} strokeWidth={3} />{t('common.close')}
          </MarkerButton>
        </div>
      </PaperPiece>

      <ConfirmDialog
        open={deleteTarget !== null}
        variant="danger"
        title={t('shift.disableTitle')}
        message={deleteTarget && t('shift.disableConfirm', { name: deleteTarget.name })}
        confirmLabel={t('shift.disable')}
        cancelLabel={t('common.cancel')}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  )
}
