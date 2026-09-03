import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { UserPlus, Pencil, Check, X, KeyRound, Wallet, Trash2 } from 'lucide-react'
import { createUser, updateUser, fetcher } from '../services/api.js'
import { formatShiftRange } from '../lib/shiftTime.js'
import PaperPiece from './PaperPiece.jsx'
import MarkerButton from './MarkerButton.jsx'

const PASSWORD_MIN = 8

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

// 新增 / 編輯員工的 popup 表單。父層以 key={editing} 重新掛載以重置欄位。
export default function EmployeeFormModal({
  open, mode, employee, departments, currentUser,
  onClose, onToast, onSaved, onPassword, onSalary, onDelete,
}) {
  const { t } = useTranslation()
  const isNew = mode === 'new'
  const [form, setForm] = useState(() => ({
    email: employee?.email ?? '',
    name: employee?.name ?? '',
    empNo: employee?.empNo ?? '',
    password: '',
    hireDate: formatDate(employee?.hireDate),
    departmentId: employee?.departmentId ?? '',
    roleId: employee?.roleId ?? '',
    defaultShiftId: employee?.defaultShiftId ?? '',
    employmentType: employee?.employmentType ?? 'regular',
  }))
  const [saving, setSaving] = useState(false)
  const isSelf = !isNew && employee?.id === currentUser?.id
  const isAdmin = Boolean(currentUser?.isAdmin)
  // 角色為部門範圍：依目前所選部門載入可指派角色（僅 admin 需要）
  const { data: roleData } = useSWR(
    isAdmin && form.departmentId ? `/admin/departments/${form.departmentId}/roles` : null,
    fetcher,
  )
  const roleOptions = roleData ?? []
  const { data: shiftData } = useSWR(isNew ? null : '/admin/shifts', fetcher)
  const shiftOptions = shiftData ?? []

  function buildEditPayload() {
    const payload = {
      name: form.name.trim() || null,
      empNo: form.empNo === '' ? null : Number(form.empNo),
      hireDate: form.hireDate || null,
      departmentId: form.departmentId || null,
    }
    if (isAdmin) payload.roleId = form.roleId || null
    payload.employmentType = form.employmentType
    payload.defaultShiftId = form.defaultShiftId || null
    return payload
  }

  // 薪資主檔的月薪/時薪模式取決於身分——把表單目前內容（含未存的身分變更）帶過去，
  // 由薪資 modal 儲存時一併送出（先員工、後薪資）；取消則兩者皆不儲存
  function openSalary() {
    onSalary({
      ...employee,
      employmentType: form.employmentType,
      pendingUserPayload: buildEditPayload(),
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (isNew && form.password.length < PASSWORD_MIN) {
      onToast({ variant: 'error', message: t('employees.errPasswordRequired', { min: PASSWORD_MIN }) })
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        await createUser({
          email: form.email.trim(),
          name: form.name.trim() || null,
          empNo: form.empNo === '' ? null : Number(form.empNo),
          hireDate: form.hireDate || null,
          departmentId: form.departmentId || null,
          ...(isAdmin ? { roleId: form.roleId || null } : {}),
          employmentType: form.employmentType,
          password: form.password,
        })
        onToast({ variant: 'success', message: t('employees.okCreated') })
      } else {
        await updateUser(employee.id, buildEditPayload())
        onToast({ variant: 'success', message: t('employees.okUpdated') })
      }
      onSaved()
      onClose()
    } catch (err) {
      onToast({ variant: 'error', message: err?.message || t('common.errActionFailed') })
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="close"
        tabIndex={-1}
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-[#1c1810]/20 backdrop-blur-[2px] cursor-default"
      />
      <PaperPiece color="#fdfbf4" rotate="-0.3deg" variant="card" className="relative w-full max-w-lg p-7 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-start gap-4 mb-5">
          <div className="bg-emerald-500 p-2.5 rounded-lg shadow-sm shrink-0" style={{ transform: 'rotate(-4deg)' }}>
            {isNew
              ? <UserPlus size={20} className="text-white" strokeWidth={2.5} />
              : <Pencil size={20} className="text-white" strokeWidth={2.5} />}
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="font-zh text-lg text-slate-800">{isNew ? t('employees.add') : t('employees.edit')}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
              {isNew ? 'New Employee' : (employee?.email || 'Edit Employee')}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="font-zh text-xs text-slate-500 mb-1.5 block">
                Email {!isNew && <span className="text-slate-400">{t('employees.readonly')}</span>}
              </span>
              <input
                type="email"
                value={form.email}
                disabled={!isNew}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="employee@company.com"
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('employees.fieldName')}</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('employees.namePlaceholder')}
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm text-slate-700"
              />
            </label>

            <label className="block">
              <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('employees.fieldEmpNo')}</span>
              <input
                type="number"
                value={form.empNo}
                onChange={(e) => setForm((f) => ({ ...f, empNo: e.target.value }))}
                placeholder="1001"
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono tabular-nums text-sm text-slate-700"
              />
            </label>

          </div>

          <label className="block">
            <span className="font-zh text-xs text-slate-500 mb-1.5 block">
              {t('employees.fieldHireDate')} <span className="text-slate-400">{t('employees.hireDateHint')}</span>
            </span>
            <input
              type="date"
              value={form.hireDate}
              onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono tabular-nums text-sm text-slate-700"
            />
          </label>

          <label className="block">
            <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('employees.fieldDepartment')}</span>
            <select
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value, roleId: '' }))}
              className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm text-slate-700"
            >
              <option value="">{t('employees.optNoDepartment')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('employees.fieldEmploymentType')}</span>
            <select
              value={form.employmentType}
              onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm text-slate-700"
            >
              <option value="regular">{t('employees.employmentRegular')}</option>
              <option value="operation">{t('employees.employmentOperation')}</option>
              <option value="parttime">{t('employees.employmentParttime')}</option>
            </select>
          </label>

          {!isNew && (
            <label className="block">
              <span className="font-zh text-xs text-slate-500 mb-1.5 block">
                {t('employees.fieldDefaultShift')} <span className="text-slate-400">{t('employees.defaultShiftHint')}</span>
              </span>
              <select
                value={form.defaultShiftId}
                onChange={(e) => setForm((f) => ({ ...f, defaultShiftId: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm text-slate-700"
              >
                <option value="">{t('employees.optNoShift')}</option>
                {shiftOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}（{formatShiftRange(s)}）</option>
                ))}
              </select>
            </label>
          )}

          {isAdmin && (
            <label className="block">
              <span className="font-zh text-xs text-slate-500 mb-1.5 block">
                {t('employees.fieldRole')} <span className="text-slate-400">{t('employees.roleHint')}</span>
              </span>
              <select
                value={form.roleId}
                onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm text-slate-700"
              >
                <option value="">{t('employees.optStaff')}</option>
                {currentUser?.adminRoleId != null && (
                  <option value={String(currentUser.adminRoleId)}>{t('employees.optAdmin')}</option>
                )}
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
          )}

          {isNew && (
            <label className="block">
              <span className="font-zh text-xs text-slate-500 mb-1.5 block">
                {t('employees.fieldInitialPassword')} <span className="text-red-500">*</span> {t('employees.minCharsHint', { min: PASSWORD_MIN })}
              </span>
              <input
                type="password"
                required
                minLength={PASSWORD_MIN}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-mono text-sm text-slate-700"
              />
            </label>
          )}

          {/* 編輯模式：員工層級的其他操作 */}
          {!isNew && (
            <div className="flex items-center gap-2 border-t border-dashed border-slate-200 mt-3 pt-3 flex-wrap">
              <MarkerButton color="#0ea5e9" rotate="0.5deg" fontSize={12} onClick={() => onPassword(employee)}>
                <KeyRound size={12} strokeWidth={3} />{t('employees.password')}
              </MarkerButton>
              <MarkerButton color="#10b981" rotate="-0.4deg" fontSize={12} onClick={openSalary}>
                <Wallet size={12} strokeWidth={3} />{t('employees.salary')}
              </MarkerButton>
              {!isSelf && (
                <MarkerButton color="#ef4444" rotate="0.5deg" fontSize={12} onClick={() => onDelete(employee)}>
                  <Trash2 size={12} strokeWidth={3} />{t('common.delete')}
                </MarkerButton>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <MarkerButton color="#94a3b8" rotate="0.5deg" onClick={() => !saving && onClose()} disabled={saving}>
              <X size={14} strokeWidth={3} />{t('common.cancel')}
            </MarkerButton>
            <MarkerButton as="button" type="submit" color="#10b981" rotate="-0.5deg" disabled={saving}>
              <Check size={14} strokeWidth={3} />{saving ? t('common.saving') : t('common.save')}
            </MarkerButton>
          </div>
        </form>
      </PaperPiece>
    </div>
  )
}
