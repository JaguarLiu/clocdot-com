import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR, { useSWRConfig } from 'swr'
import {
  Users, Plus, Upload, Pencil, KeyRound, LockOpen, Check, X, Inbox, User as UserIcon, GripVertical,
} from 'lucide-react'
import {
  fetcher, deleteUser, unlockUser, setUserPassword, updateUser, updateDepartment,
} from '../services/api.js'
import { useAuth } from '../hooks/useAuth.js'
import PaperPiece from '../components/PaperPiece.jsx'
import PaperToast from '../components/PaperToast.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import MarkerButton from '../components/MarkerButton.jsx'
import SalaryProfileModal from '../components/SalaryProfileModal.jsx'
import EmployeeImportModal from '../components/EmployeeImportModal.jsx'
import EmployeeFormModal from '../components/EmployeeFormModal.jsx'
import OrgChart from '../components/OrgChart.jsx'

const PASSWORD_MIN = 8

function PasswordModal({ open, employee, onClose, onToast }) {
  const { t } = useTranslation()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (pw.length < PASSWORD_MIN) {
      onToast({ variant: 'error', message: t('employees.errPasswordShort', { min: PASSWORD_MIN }) })
      return
    }
    setBusy(true)
    try {
      await setUserPassword(employee.id, pw)
      onToast({ variant: 'success', message: t('employees.okPasswordUpdated') })
      setPw('')
      onClose()
    } catch (err) {
      onToast({ variant: 'error', message: err?.message || t('common.errActionFailed') })
    } finally {
      setBusy(false)
    }
  }

  if (!open || !employee) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="close"
        tabIndex={-1}
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-[#1c1810]/20 backdrop-blur-[2px] cursor-default"
      />
      <PaperPiece color="#fdfbf4" rotate="-0.4deg" variant="card" className="relative w-full max-w-md p-7 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-5">
          <div className="bg-sky-500 p-2.5 rounded-lg shadow-sm shrink-0" style={{ transform: 'rotate(-4deg)' }}>
            <KeyRound size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="font-zh text-lg text-slate-800">{t('employees.setPassword')}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
              {employee.email}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('employees.newPasswordLabel', { min: PASSWORD_MIN })}</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-sky-400 outline-none font-mono text-sm text-slate-700"
            />
          </label>
          <div className="flex items-center justify-end gap-3 pt-1">
            <MarkerButton color="#94a3b8" rotate="0.5deg" onClick={() => !busy && onClose()} disabled={busy}>
              <X size={14} strokeWidth={3} />{t('common.cancel')}
            </MarkerButton>
            <MarkerButton as="button" type="submit" color="#0ea5e9" rotate="-0.5deg" disabled={busy}>
              <Check size={14} strokeWidth={3} />{busy ? t('common.saving') : t('common.save')}
            </MarkerButton>
          </div>
        </form>
      </PaperPiece>
    </div>
  )
}

// 左欄：未編入部門的員工。整列為紙片，可拖曳至右側部門便條紙以編入。
function UnassignedRow({ u, isSelf, rotate, onEdit, onUnlock }) {
  const { t } = useTranslation()
  const locked = Boolean(u.lockedAt)
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', u.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className="cursor-grab active:cursor-grabbing hover:-translate-y-px transition-transform"
    >
      <PaperPiece color="white" rotate={rotate} variant="card" className="flex items-center gap-2 px-2.5 py-2">
        <GripVertical size={14} className="text-slate-300 shrink-0" />
        <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-emerald-50 flex items-center justify-center overflow-hidden shrink-0">
          {u.avatar
            ? <img src={u.avatar} alt={u.name} referrerPolicy="no-referrer" draggable={false} className="w-full h-full object-cover" />
            : <UserIcon size={14} className="text-emerald-600" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-zh text-xs text-slate-700 truncate">
            {u.name || '—'}
            {isSelf && <span className="ml-1.5 text-[8px] font-black text-emerald-500 uppercase tracking-widest">You</span>}
            {locked && <span className="ml-1.5 text-[8px] font-black text-red-500 uppercase tracking-widest">Locked</span>}
          </p>
          <p className="text-[10px] text-slate-400 truncate font-mono">{u.email}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {locked && (
            <MarkerButton color="#f59e0b" rotate="-0.5deg" fontSize={11} title={t('employees.unlock')} ariaLabel={t('employees.unlock')} contentStyle={{ padding: '6px' }} onClick={() => onUnlock(u)}>
              <LockOpen size={12} strokeWidth={3} />
            </MarkerButton>
          )}
          <MarkerButton color="#10b981" rotate="0.5deg" fontSize={11} title={t('common.edit')} ariaLabel={t('common.edit')} contentStyle={{ padding: '6px' }} onClick={() => onEdit(u)}>
            <Pencil size={12} strokeWidth={3} />
          </MarkerButton>
        </div>
      </PaperPiece>
    </div>
  )
}

function UnassignedList({ users, currentUser, onEdit, onUnlock, onUnassign }) {
  const { t } = useTranslation()
  const [over, setOver] = useState(false)
  const dragDepth = useRef(0)

  // 安全網：拖曳結束（放開 / 取消）一律清除 highlight，避免 drop zone 卡在「放開以移出部門」狀態
  useEffect(() => {
    const clear = () => { dragDepth.current = 0; setOver(false) }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  return (
    <div className="w-full lg:w-80 shrink-0">
      <div
        className="relative pt-3"
        onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setOver(true) }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setOver(false) }}
        onDrop={(e) => {
          e.preventDefault()
          dragDepth.current = 0
          setOver(false)
          const id = e.dataTransfer.getData('text/plain')
          if (id) onUnassign(id)
        }}
      >
        <PaperPiece color="#fdf3b8" rotate="-0.6deg" variant="card" className="relative">
          {/* 紙膠帶（白色半透明）*/}
          <div
            className="absolute -top-2 left-1/2 w-12 h-4 bg-white/60 border border-white/50 shadow-sm"
            style={{ transform: 'translateX(-50%) rotate(-2deg)' }}
          />
          <div className="px-3.5 pt-4 pb-3.5">
            {/* 標題：與部門便條紙一致 */}
            <div className="flex items-center justify-between gap-2">
              <p className="font-zh text-sm text-slate-800 truncate leading-tight">{t('employees.noDepartment')}</p>
              <span
                className="shrink-0 text-[10px] font-mono font-black tabular-nums text-amber-800 bg-amber-200/60 border border-amber-300 px-1.5 py-0.5"
                style={{ borderRadius: '4px 1px 5px 2px/2px 5px 1px 4px' }}
              >
                {t('employees.peopleCount', { count: users.length })}
              </span>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-dashed border-amber-400/40 space-y-2 min-h-[110px] max-h-[64vh] overflow-y-auto custom-scrollbar">
              {users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-amber-600/50">
                  <Inbox size={24} />
                  <p className="font-zh text-xs">{t('employees.allAssigned')}</p>
                </div>
              ) : (
                users.map((u, i) => (
                  <UnassignedRow
                    key={u.id}
                    u={u}
                    isSelf={u.id === currentUser?.id}
                    rotate={i % 2 === 0 ? '-0.4deg' : '0.4deg'}
                    onEdit={onEdit}
                    onUnlock={onUnlock}
                  />
                ))
              )}
            </div>
          </div>
        </PaperPiece>

        {over && (
          <div className="absolute inset-0 top-3 z-20 flex items-center justify-center pointer-events-none border-2 border-dashed border-emerald-500 bg-emerald-50/45 rounded-[14px]">
            <span className="font-zh text-xs text-emerald-700 bg-white/90 px-2 py-1 shadow-sm">{t('employees.dropToRemove')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Employees() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const { data, mutate } = useSWR('/admin/users', fetcher)
  const { data: deptData } = useSWR('/admin/departments', fetcher)
  const { mutate: globalMutate } = useSWRConfig()
  const departments = deptData ?? []
  const [editing, setEditing] = useState(null) // null | 'new' | user.id
  const [toast, setToast] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [pwTarget, setPwTarget] = useState(null)
  const [salaryTarget, setSalaryTarget] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const list = data ?? []
  const unassigned = list.filter((u) => !u.departmentId)

  function openNew() { setEditing('new') }
  function openEdit(u) { setEditing(u.id) }
  function closeForm() { setEditing(null) }

  function refresh() {
    mutate()
    globalMutate('/admin/departments')
  }

  // 拖曳指派 / 移出部門（deptId 為 null 代表移出）
  async function assign(userId, deptId) {
    const u = list.find((x) => x.id === userId)
    if (!u) return
    const fromDeptId = u.departmentId ?? null
    if (fromDeptId === (deptId ?? null)) return
    try {
      await updateUser(userId, { departmentId: deptId || null })
      // 若被移出者原本是該部門主管，順帶把主管清成「未指定」
      const fromDept = departments.find((d) => d.id === fromDeptId)
      if (fromDept && fromDept.managerId === userId) {
        await updateDepartment(fromDeptId, { managerId: null })
      }
      setToast({ variant: 'success', message: deptId ? t('employees.okAssigned') : t('employees.okUnassigned') })
      refresh()
    } catch (err) {
      setToast({ variant: 'error', message: err?.message || t('common.errActionFailed') })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      setToast({ variant: 'success', message: t('employees.okDeleted') })
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      setToast({ variant: 'error', message: err?.message || t('common.errDeleteFailed') })
    } finally {
      setDeleting(false)
    }
  }

  async function handleUnlock(u) {
    try {
      await unlockUser(u.id)
      setToast({ variant: 'success', message: t('employees.okUnlocked', { name: u.name || u.email }) })
      refresh()
    } catch (err) {
      setToast({ variant: 'error', message: err?.message || t('employees.errUnlock') })
    }
  }

  const editingUser = editing && editing !== 'new' ? list.find((u) => u.id === editing) : null

  return (
    <div className="animate-in fade-in duration-300">
      {toast && <PaperToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}

      <ConfirmDialog
        open={deleteTarget !== null}
        variant="danger"
        title={t('employees.deleteTitle')}
        message={deleteTarget && t('employees.deleteConfirm', { name: deleteTarget.name || deleteTarget.email })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <PasswordModal
        open={pwTarget !== null}
        employee={pwTarget}
        onClose={() => setPwTarget(null)}
        onToast={setToast}
      />

      <SalaryProfileModal
        open={Boolean(salaryTarget)}
        employee={salaryTarget}
        onClose={() => setSalaryTarget(null)}
        onToast={setToast}
        onSaved={refresh}
      />

      <EmployeeImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onToast={setToast}
        onImported={() => refresh()}
      />

      {editing !== null && (
        <EmployeeFormModal
          key={editing}
          open
          mode={editing === 'new' ? 'new' : 'edit'}
          employee={editingUser}
          departments={departments}
          currentUser={currentUser}
          onClose={closeForm}
          onToast={setToast}
          onSaved={refresh}
          onPassword={(u) => { closeForm(); setPwTarget(u) }}
          onSalary={(u) => { closeForm(); setSalaryTarget(u) }}
          onDelete={(u) => { closeForm(); setDeleteTarget(u) }}
        />
      )}

      <div className="flex items-center gap-3 mb-10 flex-wrap">
        <div className="p-2.5 rounded-lg bg-emerald-500 shadow-sm" style={{ transform: 'rotate(-3deg)' }}>
          <Users size={22} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-3xl font-zh text-slate-800">{t('nav.employees')}</h2>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
            Employee Directory
          </p>
        </div>
      </div>

      <OrgChart
        onToast={setToast}
        onAssign={assign}
        onEditUser={openEdit}
        actions={(
          <>
            <MarkerButton color="#0ea5e9" rotate="0.5deg" onClick={() => setImportOpen(true)}>
              <Upload size={15} strokeWidth={3} />{t('import.title')}
            </MarkerButton>
            <MarkerButton color="#10b981" rotate="-0.6deg" onClick={openNew}>
              <Plus size={15} strokeWidth={3} />{t('employees.add')}
            </MarkerButton>
          </>
        )}
        leftPanel={(
          <UnassignedList
            users={unassigned}
            currentUser={currentUser}
            onEdit={openEdit}
            onUnlock={handleUnlock}
            onUnassign={(id) => assign(id, null)}
          />
        )}
      />
    </div>
  )
}
