import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { weekdayNarrowNames } from '../lib/datetime.js'
import useSWR from 'swr'
import { CalendarDays, ChevronLeft, ChevronRight, Save, Eraser, Inbox, Star, Pencil } from 'lucide-react'
import { fetcher, saveScheduleAssignments } from '../services/api.js'
import PaperPiece from '../components/PaperPiece.jsx'
import MarkerButton from '../components/MarkerButton.jsx'
import PaperToast from '../components/PaperToast.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import ShiftManagerModal from '../components/ShiftManagerModal.jsx'
import { formatShiftRange } from '../lib/shiftTime.js'

// 班別顏色（依列表順序輪替）：[實色 bg, 實色 text, 淡色 bg, 淡色 text]
const SHIFT_COLORS = [
  ['bg-emerald-500 text-white', 'bg-emerald-50 text-emerald-700'],
  ['bg-sky-500 text-white', 'bg-sky-50 text-sky-700'],
  ['bg-amber-500 text-white', 'bg-amber-50 text-amber-700'],
  ['bg-violet-500 text-white', 'bg-violet-50 text-violet-700'],
  ['bg-rose-500 text-white', 'bg-rose-50 text-rose-700'],
  ['bg-teal-500 text-white', 'bg-teal-50 text-teal-700'],
]

function monthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: n }, (_, i) => {
    const dateStr = `${month}-${String(i + 1).padStart(2, '0')}`
    const dow = new Date(Date.UTC(y, m - 1, i + 1)).getUTCDay() // 0=Sun
    return { day: i + 1, dateStr, dow }
  })
}

// 星期表頭交給 Intl，隨語系變動

export default function Schedule() {
  const { t, i18n } = useTranslation()
  const dowNames = weekdayNarrowNames(i18n.resolvedLanguage)
  const [month, setMonth] = useState(() => monthStr(new Date()))
  const [departmentId, setDepartmentId] = useState('')
  const [selectedShiftId, setSelectedShiftId] = useState(null) // shift.id | 'clear' | null
  const [pending, setPending] = useState(new Map()) // `${userId}|${date}` → shiftId|null
  const [painting, setPainting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [showShiftManager, setShowShiftManager] = useState(false)
  const [complianceWarning, setComplianceWarning] = useState(null) // 違規清單 | null

  const { data: shifts } = useSWR('/admin/shifts', fetcher)
  const { data: depts } = useSWR('/admin/departments', fetcher)
  const scheduleKey = `/admin/schedule?month=${month}${departmentId ? `&departmentId=${departmentId}` : ''}`
  const { data: schedule, mutate, isLoading } = useSWR(scheduleKey, fetcher)

  // 拖曳塗抹：mouseup 時結束（掛在 window 保證放開一定收到）
  useEffect(() => {
    const stop = () => setPainting(false)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  const shiftList = useMemo(() => shifts ?? [], [shifts])
  const shiftById = useMemo(() => new Map(shiftList.map((s) => [s.id, s])), [shiftList])
  const colorByShift = useMemo(
    () => new Map(shiftList.map((s, i) => [s.id, SHIFT_COLORS[i % SHIFT_COLORS.length]])),
    [shiftList],
  )
  const users = schedule?.users ?? []
  const days = useMemo(() => daysInMonth(month), [month])

  // 後端指派（未含前端暫存）
  const assignedByKey = useMemo(() => {
    const m = new Map()
    for (const a of schedule?.assignments ?? []) m.set(`${a.userId}|${a.date}`, a.shiftId)
    return m
  }, [schedule])

  // 解析格子顯示：暫存 > 後端指派 > 預設班
  function cellShift(user, dateStr) {
    const key = `${user.id}|${dateStr}`
    if (pending.has(key)) {
      const sid = pending.get(key)
      return sid ? { shift: shiftById.get(sid), assigned: true, dirty: true } : (
        user.defaultShift ? { shift: user.defaultShift, assigned: false, dirty: true } : null
      )
    }
    const sid = assignedByKey.get(key)
    if (sid) {
      // 停用班別不在 shiftById（列表不含已停用）→ 顯示為未知指派，仍可清除
      return { shift: shiftById.get(sid) ?? { id: sid, name: t('schedule.disabledShift'), startTime: '', endTime: '' }, assigned: true, dirty: false }
    }
    return user.defaultShift ? { shift: user.defaultShift, assigned: false, dirty: false } : null
  }

  function paintCell(user, dateStr) {
    if (!selectedShiftId) return
    const key = `${user.id}|${dateStr}`
    setPending((prev) => {
      const next = new Map(prev)
      const target = selectedShiftId === 'clear' ? null : selectedShiftId
      const current = assignedByKey.get(key) ?? null
      if (target === current) next.delete(key) // 回到原狀就不算變更
      else next.set(key, target)
      return next
    })
  }

  async function doSave(confirm = false) {
    if (pending.size === 0) return
    setSaving(true)
    try {
      const changes = [...pending.entries()].map(([key, shiftId]) => {
        const [userId, date] = key.split('|')
        return { userId, date, shiftId }
      })
      await saveScheduleAssignments(changes, { confirm })
      setPending(new Map())
      setComplianceWarning(null)
      mutate()
      setToast({ variant: 'success', message: t('schedule.okSaved', { count: changes.length }) })
    } catch (err) {
      // 排班法規警告（七休一 / 輪班間隔）→ 顯示可覆寫的確認框，而非錯誤 toast
      if (err?.status === 409 && err?.info?.error === 'schedule_compliance_warning') {
        setComplianceWarning(err.info.violations ?? [])
      } else {
        setToast({ variant: 'error', message: err?.message || t('common.errSaveFailed') })
      }
    } finally {
      setSaving(false)
    }
  }

  const save = () => doSave(false)

  // 有未儲存變更時切月 → 先經 ConfirmDialog（禁用原生 confirm）
  const [confirmMonthDelta, setConfirmMonthDelta] = useState(null) // null | -1 | 1

  function applyMonthShift(delta) {
    const [y, m] = month.split('-').map(Number)
    setPending(new Map())
    setMonth(monthStr(new Date(y, m - 1 + delta, 1)))
  }

  function shiftMonth(delta) {
    if (pending.size > 0) { setConfirmMonthDelta(delta); return }
    applyMonthShift(delta)
  }

  return (
    <div className="animate-in fade-in duration-300 select-none">
      {toast && <PaperToast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />}
      <ConfirmDialog
        open={confirmMonthDelta !== null}
        variant="danger"
        title={t('schedule.discardTitle')}
        message={t('schedule.discardMessage', { count: pending.size })}
        confirmLabel={t('schedule.discardConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => { applyMonthShift(confirmMonthDelta); setConfirmMonthDelta(null) }}
        onCancel={() => setConfirmMonthDelta(null)}
      />
      <ConfirmDialog
        open={complianceWarning !== null}
        variant="warning"
        title={t('schedule.complianceTitle')}
        loading={saving}
        message={
          <span className="block">
            <span className="block mb-1.5">{t('schedule.complianceIntro')}</span>
            {(complianceWarning ?? []).map((v, i) => (
              <span key={i} className="block mt-1 text-amber-700">・{v.message}</span>
            ))}
            <span className="block mt-3 text-slate-500">{t('schedule.complianceOutro')}</span>
          </span>
        }
        confirmLabel={t('schedule.complianceConfirm')}
        cancelLabel={t('schedule.complianceCancel')}
        onConfirm={() => doSave(true)}
        onCancel={() => setComplianceWarning(null)}
      />
      <ShiftManagerModal
        open={showShiftManager}
        onClose={() => setShowShiftManager(false)}
        onToast={setToast}
        onCreated={(s) => setSelectedShiftId(s.id)}
        onDeleted={(id) => { if (selectedShiftId === id) setSelectedShiftId(null) }}
      />

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="bg-emerald-500 p-2.5 rounded-lg shadow-sm" style={{ transform: 'rotate(-3deg)' }}>
          <CalendarDays size={20} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="font-zh text-xl text-slate-800">{t('schedule.title')}</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-0.5">Shift Schedule</p>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label={t('common.prevMonth')} className="p-1.5 text-slate-400 hover:text-emerald-600 active:scale-90 transition-transform">
            <ChevronLeft size={18} strokeWidth={3} />
          </button>
          <span className="font-mono font-black text-lg text-slate-700 tabular-nums">{month}</span>
          <button type="button" onClick={() => shiftMonth(1)} aria-label={t('common.nextMonth')} className="p-1.5 text-slate-400 hover:text-emerald-600 active:scale-90 transition-transform">
            <ChevronRight size={18} strokeWidth={3} />
          </button>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="ml-2 px-3 py-2 bg-white border border-slate-200 focus:border-emerald-400 outline-none font-zh text-sm text-slate-700"
          >
            <option value="">{t('schedule.allDepartments')}</option>
            {(depts ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* 班別調色盤：先選班別，再點/拖格子塗抹 */}
      {/* 間距須放 PaperPiece 外層——className 掛在內層 grid cell 上，margin 只會把紙撐高不會隔開兩張紙 */}
      <div className="mb-10">
      <PaperPiece color="#fdfbf4" rotate="-0.2deg" variant="card" className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-zh text-xs text-slate-500 mr-1">{t('schedule.paintHint')}</span>
          {shiftList.map((s) => {
            const [solid] = colorByShift.get(s.id)
            const active = selectedShiftId === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedShiftId(active ? null : s.id)}
                aria-pressed={active}
                className={`px-2.5 py-1.5 font-zh text-xs transition-transform active:scale-95 ${solid} ${active ? 'ring-2 ring-offset-1 ring-slate-700' : 'opacity-80 hover:opacity-100'}`}
                style={{ borderRadius: '6px 2px 7px 3px/3px 7px 2px 6px', transform: active ? 'rotate(-1deg)' : 'none' }}
              >
                <span className="inline-flex items-center gap-1">
                  {s.isDefault && <Star size={10} strokeWidth={3} className="shrink-0" />}
                  {s.name} {formatShiftRange(s)}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setSelectedShiftId(selectedShiftId === 'clear' ? null : 'clear')}
            aria-pressed={selectedShiftId === 'clear'}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-zh text-xs bg-slate-200 text-slate-600 transition-transform active:scale-95 ${selectedShiftId === 'clear' ? 'ring-2 ring-offset-1 ring-slate-700' : 'opacity-80 hover:opacity-100'}`}
            style={{ borderRadius: '6px 2px 7px 3px/3px 7px 2px 6px' }}
          >
            <Eraser size={12} strokeWidth={3} />{t('schedule.clearAssignment')}
          </button>
          <button
            type="button"
            onClick={() => setShowShiftManager(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 font-zh text-xs text-slate-500 border-2 border-dashed border-slate-300 hover:text-emerald-600 hover:border-emerald-300 transition-colors active:scale-95"
            style={{ borderRadius: '6px 2px 7px 3px/3px 7px 2px 6px' }}
          >
            <Pencil size={12} strokeWidth={3} />{t('shift.title')}
          </button>

          <span className="font-zh text-[11px] text-slate-400 ml-auto">{t('schedule.legend')}</span>
          <MarkerButton as="button" type="button" color="#10b981" rotate="-0.5deg" fontSize={12} onClick={save} disabled={saving || pending.size === 0}>
            <Save size={13} strokeWidth={3} />
            {saving
              ? t('common.saving')
              : (pending.size > 0 ? t('schedule.saveChangesCount', { count: pending.size }) : t('schedule.saveChanges'))}
          </MarkerButton>
        </div>
      </PaperPiece>
      </div>

      {isLoading ? (
        <p className="font-zh text-sm text-slate-400 py-10 text-center">{t('common.loading')}</p>
      ) : users.length === 0 ? (
        <div className="text-center py-16 opacity-40 flex flex-col items-center gap-3">
          <Inbox size={40} className="text-slate-300" />
          <p className="font-zh text-sm text-slate-400">{t('schedule.noSchedulable')}</p>
        </div>
      ) : (
        <PaperPiece color="white" rotate="0deg" variant="card" className="p-4">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="border-separate border-spacing-0 min-w-max">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white text-left font-zh text-xs text-slate-500 px-3 py-2 border-b-2 border-dashed border-slate-200 min-w-36">{t('schedule.employeeCol')}</th>
                  {days.map((d) => (
                    <th
                      key={d.dateStr}
                      className={`font-mono text-[10px] font-black tabular-nums px-1 py-2 border-b-2 border-dashed border-slate-200 text-center min-w-9 ${d.dow === 0 || d.dow === 6 ? 'text-rose-400 bg-rose-50/40' : 'text-slate-500'}`}
                    >
                      {d.day}
                      <span className="block font-zh font-normal text-[9px] text-slate-400">{dowNames[d.dow]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-b border-dashed border-slate-100">
                      <p className="font-zh text-xs text-slate-700 whitespace-nowrap">{u.name || '—'}</p>
                      <p className="text-[9px] font-mono text-slate-400">
                        {u.empNo ?? ''}{u.defaultShift ? ` ・${t('schedule.defaultShiftIs', { name: u.defaultShift.name })}` : ` ・${t('schedule.noDefaultShift')}`}
                      </p>
                    </td>
                    {days.map((d) => {
                      const cell = cellShift(u, d.dateStr)
                      const colors = cell?.shift?.id ? colorByShift.get(cell.shift.id) : null
                      const cls = cell
                        ? (cell.assigned
                            ? (colors ? colors[0] : 'bg-slate-400 text-white')
                            : (colors ? colors[1] : 'bg-slate-50 text-slate-400'))
                        : 'bg-white text-slate-200'
                      return (
                        <td
                          key={d.dateStr}
                          onMouseDown={() => { setPainting(true); paintCell(u, d.dateStr) }}
                          onMouseEnter={() => { if (painting) paintCell(u, d.dateStr) }}
                          title={cell
                            ? `${cell.shift.name} ${formatShiftRange(cell.shift)}${cell.assigned ? t('schedule.tagAssigned') : t('schedule.tagDefault')}`
                            : t('attendance.noShift')}
                          className={`border-b border-dashed border-slate-100 px-0.5 py-1 text-center align-middle ${selectedShiftId ? 'cursor-crosshair' : 'cursor-default'}`}
                        >
                          <span
                            className={`block mx-auto w-8 py-1 text-[9px] font-zh leading-tight truncate ${cls} ${cell?.dirty ? 'ring-2 ring-amber-400' : ''}`}
                            style={{ borderRadius: '4px 1px 5px 2px/2px 5px 1px 4px' }}
                          >
                            {cell ? cell.shift.name.slice(0, 2) : '—'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PaperPiece>
      )}
    </div>
  )
}
