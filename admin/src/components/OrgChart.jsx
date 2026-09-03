import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import {
  Network, Plus, Pencil, Trash2, Check, X, Inbox, UserRound, Crown, ShieldCheck,
} from 'lucide-react'
import {
  fetcher, createDepartment, updateDepartment, deleteDepartment, updateUser,
  createDepartmentRole, deleteRole,
} from '../services/api.js'
import { useAuth } from '../hooks/useAuth.js'
import PaperPiece from './PaperPiece.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import MarkerButton from './MarkerButton.jsx'
import { buildDepartmentTree } from '../lib/orgChart.js'

const EMPTY_DEPT_FORM = { name: '', parentId: '', managerId: '' }

// 可授權給角色的後台模組（與 server services/rbac.js GRANTABLE_MODULES 一致）
const GRANTABLE_MODULES = [
  { key: 'monthly-report', labelKey: 'nav.monthlyReport' },
  { key: 'corrections', labelKey: 'nav.corrections' },
  { key: 'leaves', labelKey: 'nav.leaves' },
  { key: 'overtime-reviews', labelKey: 'nav.overtimeReviews' },
  { key: 'employees', labelKey: 'nav.employees' },
  { key: 'payroll', labelKey: 'nav.payroll' },
  { key: 'schedule', labelKey: 'nav.schedule' },
]

const MODULE_LABEL_KEY = Object.fromEntries(GRANTABLE_MODULES.map((m) => [m.key, m.labelKey]))

// 部門角色管理 popup（admin 專屬）：定義角色名稱 + 勾選後台模組
function RolesModal({ department, onClose, onToast }) {
  const { t } = useTranslation()
  const { data, mutate } = useSWR(`/admin/departments/${department.id}/roles`, fetcher)
  const roles = data ?? []
  const [name, setName] = useState('')
  const [perms, setPerms] = useState([])
  const [busy, setBusy] = useState(false)

  function togglePerm(k) {
    setPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
  }
  async function add() {
    if (!name.trim()) { onToast({ variant: 'error', message: t('org.errRoleNameRequired') }); return }
    setBusy(true)
    try {
      await createDepartmentRole(department.id, { name: name.trim(), permissions: perms })
      setName(''); setPerms([]); mutate()
      onToast({ variant: 'success', message: t('org.okRoleCreated') })
    } catch (err) { onToast({ variant: 'error', message: err?.message || t('common.errActionFailed') }) } finally { setBusy(false) }
  }
  async function remove(r) {
    try { await deleteRole(r.id); mutate(); onToast({ variant: 'success', message: t('org.okRoleDeleted') }) }
    catch (err) { onToast({ variant: 'error', message: err?.message || t('common.errDeleteFailed') }) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true">
      <button type="button" aria-label="close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-[#1c1810]/20 backdrop-blur-[2px] cursor-default" />
      <PaperPiece color="#fdfbf4" rotate="-0.3deg" variant="card" className="relative w-full max-w-lg p-7 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-start gap-4 mb-5">
          <div className="bg-violet-500 p-2.5 rounded-lg shadow-sm shrink-0" style={{ transform: 'rotate(-4deg)' }}>
            <ShieldCheck size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="font-zh text-lg text-slate-800">{t('org.rolesTitle')}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">{department.name}</p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {roles.length === 0 ? (
            <p className="font-zh text-sm text-slate-400 text-center py-3">{t('org.rolesEmpty')}</p>
          ) : roles.map((r) => (
            <div key={r.id} className="flex items-start gap-2 bg-white border border-slate-200 p-3" style={{ borderRadius: '6px 2px 7px 3px/3px 7px 2px 6px' }}>
              <div className="min-w-0 flex-1">
                <p className="font-zh text-sm text-slate-700">{r.name} <span className="text-[10px] text-slate-400">{t('org.memberCount', { count: r.memberCount })}</span></p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.permissions.length === 0
                    ? <span className="text-[10px] text-slate-400 font-zh">{t('org.noModules')}</span>
                    : r.permissions.map((k) => (
                      <span key={k} className="text-[10px] font-zh bg-violet-50 border border-violet-200 text-violet-700 px-1.5 py-0.5 rounded">{MODULE_LABEL_KEY[k] ? t(MODULE_LABEL_KEY[k]) : k}</span>
                    ))}
                </div>
              </div>
              <button type="button" onClick={() => remove(r)} className="text-slate-300 hover:text-red-500 shrink-0" aria-label={t('org.deleteRoleAria')}>
                <Trash2 size={14} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 p-3 space-y-2" style={{ borderRadius: '6px 2px 7px 3px/3px 7px 2px 6px' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('org.roleNamePlaceholder')}
            className="w-full px-2 py-1.5 bg-[#fdfbf4] border border-slate-200 outline-none focus:border-violet-400 font-zh text-sm" />
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {GRANTABLE_MODULES.map((m) => (
              <label key={m.key} className="inline-flex items-center gap-1 text-xs font-zh text-slate-600">
                <input type="checkbox" checked={perms.includes(m.key)} onChange={() => togglePerm(m.key)} />
                {t(m.labelKey)}
              </label>
            ))}
          </div>
          <MarkerButton as="button" type="button" color="#8b5cf6" rotate="-0.5deg" fontSize={12} onClick={add} disabled={busy}>
            <Plus size={13} strokeWidth={3} />{busy ? t('common.adding') : t('org.addRole')}
          </MarkerButton>
        </div>

        <div className="flex items-center justify-end pt-4">
          <MarkerButton color="#94a3b8" rotate="0.5deg" onClick={onClose}>
            <X size={14} strokeWidth={3} />{t('common.close')}
          </MarkerButton>
        </div>
      </PaperPiece>
    </div>
  )
}

function Avatar({ user, size = 30, ring = 'ring-white' }) {
  const dim = { width: size, height: size }
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name || ''}
        referrerPolicy="no-referrer"
        draggable={false}
        style={dim}
        className={`rounded-full object-cover ring-2 ${ring} bg-slate-100 shrink-0`}
      />
    )
  }
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase()
  return (
    <span
      style={dim}
      className={`rounded-full ring-2 ${ring} bg-slate-100 text-slate-500 flex items-center justify-center font-zh text-[11px] shrink-0`}
    >
      {initial || <UserRound size={size * 0.5} />}
    </span>
  )
}

// 員工紙片，貼在黃色便條紙裡（拖出 = 調動/移出；點擊 = 開編輯 popup）
function MemberCard({ user, isManager, rotate, canDrag, onEditUser }) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) return
        e.dataTransfer.setData('text/plain', user.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onEditUser(user)}
      onKeyDown={(e) => { if (e.key === 'Enter') onEditUser(user) }}
      title={user.name || user.email}
      className="cursor-grab active:cursor-grabbing hover:-translate-y-px transition-transform"
    >
      <PaperPiece color="white" rotate={rotate} variant="card" className="flex items-center gap-2 px-2 py-1.5">
        <Avatar user={user} size={22} />
        <div className="min-w-0 flex-1">
          <p className="font-zh text-[11px] text-slate-700 truncate leading-tight flex items-center gap-1">
            {isManager && <Crown size={10} strokeWidth={2.5} className="text-amber-500 shrink-0" />}
            {user.name || '—'}
          </p>
          <p className="text-[9px] text-slate-400 font-mono truncate leading-tight">{user.email}</p>
          {user.roleName && (
            <span className="inline-block mt-0.5 text-[8px] font-zh bg-violet-50 border border-violet-200 text-violet-700 px-1 py-px rounded leading-none">{user.roleName}</span>
          )}
        </div>
      </PaperPiece>
    </div>
  )
}

function DeptCard({ node, managerId, members, isAdmin, onEditDept, onDeleteDept, onManageRoles, onAssign, onEditUser }) {
  const { t } = useTranslation()
  const [over, setOver] = useState(false)
  const dragDepth = useRef(0) // enter/leave 計數，避免子元素造成 highlight 閃爍

  const reset = () => { dragDepth.current = 0; setOver(false) }

  // 安全網：任何拖曳結束（放開 / 取消）都強制清除 highlight。
  // 因為可拖曳的卡片本身在 drop zone 內，enter/leave 計數會失衡，光靠計數無法保證歸零。
  useEffect(() => {
    const clear = () => { dragDepth.current = 0; setOver(false) }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  const sorted = managerId
    ? [...members].sort((a, b) => (a.id === managerId ? -1 : b.id === managerId ? 1 : 0))
    : members

  return (
    <div
      className="relative"
      onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setOver(true) }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setOver(false) }}
      onDrop={(e) => {
        e.preventDefault()
        reset()
        if (!isAdmin) return
        const userId = e.dataTransfer.getData('text/plain')
        if (userId) onAssign(userId, node.id)
      }}
    >
      <PaperPiece
        color="#fdf3b8"
        rotate={node.depth % 2 === 0 ? '-0.7deg' : '0.7deg'}
        variant="card"
        className={`group relative w-[230px] transition-transform ${over ? 'scale-[1.02]' : ''}`}
      >
        {/* 紙膠帶（白色半透明）*/}
        <div
          className="absolute -top-2 left-1/2 w-12 h-4 bg-white/60 border border-white/50 shadow-sm"
          style={{ transform: 'translateX(-50%) rotate(-2deg)' }}
        />

        {/* hover 部門操作 */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {isAdmin && (
            <MarkerButton color="#8b5cf6" rotate="0.5deg" fontSize={11} onClick={() => onManageRoles(node)} title={t('org.rolesTitle')} ariaLabel={t('org.rolesTitle')} contentStyle={{ padding: '7px' }}>
              <ShieldCheck size={12} strokeWidth={3} />
            </MarkerButton>
          )}
          {isAdmin && (
            <>
              <MarkerButton color="#10b981" rotate="-0.5deg" fontSize={11} onClick={() => onEditDept(node)} title={t('org.editDept')} ariaLabel={t('org.editDept')} contentStyle={{ padding: '7px' }}>
                <Pencil size={12} strokeWidth={3} />
              </MarkerButton>
              <MarkerButton color="#ef4444" rotate="0.5deg" fontSize={11} onClick={() => onDeleteDept(node)} title={t('org.deleteDept')} ariaLabel={t('org.deleteDept')} contentStyle={{ padding: '7px' }}>
                <Trash2 size={12} strokeWidth={3} />
              </MarkerButton>
            </>
          )}
        </div>

        <div className="px-3.5 pt-4 pb-3.5 text-left">
          {/* 部門名 + 人數 */}
          <div className="flex items-center justify-between gap-2 pr-12">
            <p className="font-zh text-sm text-slate-800 truncate leading-tight">{node.name}</p>
            <span
              className="shrink-0 text-[10px] font-mono font-black tabular-nums text-amber-800 bg-amber-200/60 border border-amber-300 px-1.5 py-0.5"
              style={{ borderRadius: '4px 1px 5px 2px/2px 5px 1px 4px' }}
            >
              {t('employees.peopleCount', { count: members.length })}
            </span>
          </div>

          {/* 員工白卡 */}
          <div className="mt-2.5 pt-2.5 border-t border-dashed border-amber-400/40 space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
            {sorted.length === 0 ? (
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-600/50 text-center py-3">
                {t('org.dragHere')}
              </p>
            ) : (
              sorted.map((m, i) => (
                <MemberCard
                  key={m.id}
                  user={m}
                  isManager={m.id === managerId}
                  rotate={i % 2 === 0 ? '-0.5deg' : '0.5deg'}
                  canDrag={isAdmin}
                  onEditUser={onEditUser}
                />
              ))
            )}
          </div>
        </div>
      </PaperPiece>

      {/* 拖曳放置提示 */}
      {over && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none border-2 border-dashed border-emerald-500 bg-emerald-50/45 rounded-[14px]">
          <span className="font-zh text-xs text-emerald-700 bg-white/90 px-2 py-1 shadow-sm">{t('org.dropInto', { name: node.name })}</span>
        </div>
      )}
    </div>
  )
}

function TreeNode({ node, membersByDept, isAdmin, onEditDept, onDeleteDept, onManageRoles, onAssign, onEditUser }) {
  return (
    <li className="org-tree__node">
      <DeptCard
        node={node}
        managerId={node.managerId ?? null}
        members={membersByDept.get(node.id) ?? []}
        isAdmin={isAdmin}
        onEditDept={onEditDept}
        onDeleteDept={onDeleteDept}
        onManageRoles={onManageRoles}
        onAssign={onAssign}
        onEditUser={onEditUser}
      />
      {node.children.length > 0 && (
        <ul className="org-tree__branch">
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              membersByDept={membersByDept}
              isAdmin={isAdmin}
              onEditDept={onEditDept}
              onDeleteDept={onDeleteDept}
              onManageRoles={onManageRoles}
              onAssign={onAssign}
              onEditUser={onEditUser}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// 為節點補上 depth，方便卡片決定旋轉/accent
function withDepth(nodes, depth = 0) {
  return nodes.map((n) => ({ ...n, depth, children: withDepth(n.children, depth + 1) }))
}

export default function OrgChart({ onToast, onAssign, onEditUser, actions, leftPanel }) {
  const { t } = useTranslation()
  const { data: depts, mutate, isLoading } = useSWR('/admin/departments', fetcher)
  const { data: users, mutate: mutateUsers } = useSWR('/admin/users', fetcher)
  const [editing, setEditing] = useState(null) // null | 'new' | id
  const [form, setForm] = useState(EMPTY_DEPT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [rolesTarget, setRolesTarget] = useState(null)
  const { user } = useAuth()
  const isAdmin = Boolean(user?.isAdmin)

  const list = useMemo(() => depts ?? [], [depts])
  const employees = useMemo(() => users ?? [], [users])

  const membersByDept = useMemo(() => {
    const m = new Map()
    for (const u of employees) {
      if (!u.departmentId) continue
      if (!m.has(u.departmentId)) m.set(u.departmentId, [])
      m.get(u.departmentId).push(u)
    }
    return m
  }, [employees])

  const tree = useMemo(() => withDepth(buildDepartmentTree(list)), [list])

  function openNew() { setEditing('new'); setForm(EMPTY_DEPT_FORM) }
  function openEdit(d) {
    setEditing(d.id)
    setForm({ name: d.name, parentId: d.parentId ?? '', managerId: d.managerId ?? '' })
  }
  function cancel() { setEditing(null); setForm(EMPTY_DEPT_FORM) }

  async function save(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        parentId: form.parentId || null,
        managerId: form.managerId || null,
      }
      let deptId = editing
      if (editing === 'new') {
        const created = await createDepartment(payload)
        deptId = created?.id
        onToast({ variant: 'success', message: t('org.okDeptCreated') })
      } else {
        await updateDepartment(editing, payload)
        onToast({ variant: 'success', message: t('org.okDeptUpdated') })
      }
      // 指定主管者自動編入該部門，卡片才會出現在便條紙內
      if (payload.managerId && deptId) {
        const mgr = employees.find((u) => u.id === payload.managerId)
        if (mgr && mgr.departmentId !== deptId) {
          // 若該主管原本是別的部門主管，順帶把舊部門主管清成未指定
          const fromDept = list.find((d) => d.id === mgr.departmentId)
          if (fromDept && fromDept.managerId === mgr.id) {
            await updateDepartment(fromDept.id, { managerId: null })
          }
          await updateUser(payload.managerId, { departmentId: deptId })
          mutateUsers()
        }
      }
      mutate()
      cancel()
    } catch (err) {
      onToast({ variant: 'error', message: err?.message || t('common.errActionFailed') })
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDepartment(deleteTarget.id)
      mutate()
      onToast({ variant: 'success', message: t('org.okDeptDeleted') })
      setDeleteTarget(null)
    } catch (err) {
      onToast({ variant: 'error', message: err?.message || t('common.errDeleteFailed') })
    } finally {
      setDeleting(false)
    }
  }

  // 編輯時避免把自己列為自己的上層
  const parentOptions = list.filter((d) => editing === 'new' || d.id !== editing)

  return (
    <section>
      <ConfirmDialog
        open={deleteTarget !== null}
        variant="danger"
        title={t('org.deleteDept')}
        message={deleteTarget && t('org.deleteDeptConfirm', { name: deleteTarget.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      {rolesTarget && (
        <RolesModal department={rolesTarget} onClose={() => setRolesTarget(null)} onToast={onToast} />
      )}

      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {actions}
        {isAdmin && editing === null && (
          <MarkerButton className="ml-auto" color="#f59e0b" rotate="-0.6deg" onClick={openNew}>
            <Plus size={15} strokeWidth={3} />{t('org.addDept')}
          </MarkerButton>
        )}
      </div>

      {editing !== null && (
        <PaperPiece color="white" rotate="-0.2deg" variant="card" className="p-6 mb-8">
          <form onSubmit={save} className="space-y-4">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
              {editing === 'new' ? 'New Department' : 'Edit Department'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('org.deptName')}</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('org.deptNamePlaceholder')}
                  className="w-full px-3 py-2 bg-[#fdfbf4] border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm text-slate-700"
                />
              </label>
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('org.parentDept')}</span>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#fdfbf4] border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm text-slate-700"
                >
                  <option value="">{t('org.optTopLevel')}</option>
                  {parentOptions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-zh text-xs text-slate-500 mb-1.5 block">{t('org.manager')}</span>
                <select
                  value={form.managerId}
                  onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#fdfbf4] border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm text-slate-700"
                >
                  <option value="">{t('org.optUnspecified')}</option>
                  {employees.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <MarkerButton as="button" type="submit" color="#10b981" rotate="-0.5deg" disabled={submitting}>
                <Check size={14} strokeWidth={3} />{submitting ? t('common.saving') : t('common.save')}
              </MarkerButton>
              <MarkerButton color="#94a3b8" rotate="0.5deg" onClick={cancel} disabled={submitting}>
                <X size={14} strokeWidth={3} />{t('common.cancel')}
              </MarkerButton>
            </div>
          </form>
        </PaperPiece>
      )}

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {leftPanel}

        <div className="flex-1 min-w-0 w-full">
          {isLoading ? (
            <p className="font-zh text-sm text-slate-400 py-10 text-center">{t('common.loading')}</p>
          ) : list.length === 0 ? (
            <div className="text-center py-16 opacity-40 flex flex-col items-center gap-3">
              <Inbox size={40} className="text-slate-300" />
              <p className="font-zh text-sm text-slate-400">{t('org.deptsEmpty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar pt-3 pb-6">
              <ul className="org-tree min-w-max px-4">
                {tree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    membersByDept={membersByDept}
                    isAdmin={isAdmin}
                    onEditDept={openEdit}
                    onDeleteDept={setDeleteTarget}
                    onManageRoles={setRolesTarget}
                    onAssign={onAssign}
                    onEditUser={onEditUser}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
