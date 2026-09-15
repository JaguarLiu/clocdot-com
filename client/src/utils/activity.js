// 員工端「我的紀錄」（GET /api/my/activity）的顯示邏輯，純函式便於測試。
import { eventLabelKey } from './requestProgress.js'

export const ACTIVITY_FILTERS = ['all', 'attendance', 'request', 'account']

const REQUEST_PREFIXES = ['leave', 'correction', 'overtime', 'approval']

export function activityCategory(action) {
  const prefix = String(action ?? '').split('.')[0]
  if (prefix === 'attendance') return 'attendance'
  if (REQUEST_PREFIXES.includes(prefix)) return 'request'
  return 'account'
}

/** 標籤 key：申請事件沿用申請進度的文案，其餘走 activity.action.* */
export function activityLabelKey(event) {
  if (activityCategory(event?.action) === 'request') return eventLabelKey(event)
  return `activity.action.${String(event?.action ?? '').replace('.', '_')}`
}

/**
 * 語意色：上班卡綠、下班卡橘、補卡橘、請假藍、加班 / 簽核琥珀、駁回紅、帳號灰
 * @returns {'emerald'|'orange'|'sky'|'amber'|'red'|'slate'}
 */
export function activityTone(action) {
  const a = String(action ?? '')
  if (a.endsWith('rejected')) return 'red'
  if (a === 'attendance.punched_out') return 'orange'
  if (a.startsWith('attendance.')) return 'emerald'
  if (a.startsWith('correction.')) return 'orange'
  if (a.startsWith('leave.')) return 'sky'
  if (a.startsWith('overtime.') || a.startsWith('approval.')) return 'amber'
  return 'slate'
}

/** 事件是別人（管理員 / 主管）幫我做的 */
export function isByOthers(event, myId) {
  return Boolean(event?.actor?.id && myId && event.actor.id !== myId)
}

/** 本地時區的 YYYY-MM-DD，給分組用 */
export function localDateKey(value) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 依本地日期分組，保留原本（由新到舊）的順序 */
export function groupByLocalDate(items) {
  const groups = []
  const byKey = new Map()
  for (const item of items ?? []) {
    const key = localDateKey(item.createdAt)
    if (!byKey.has(key)) {
      const group = { key, items: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    byKey.get(key).items.push(item)
  }
  return groups
}

// 出勤變更要列出的欄位（依顯示順序）
const ATTENDANCE_FIELDS = ['punchIn', 'punchOut', 'workDuration', 'isLate', 'isEarlyLeave', 'leaveType', 'isHoliday']

/** 管理員修改 / 補卡改寫出勤：逐欄 before → after */
export function attendanceChanges(event) {
  if (!['attendance.edited', 'attendance.corrected'].includes(event?.action)) return []
  const before = event.before ?? {}
  const after = event.after ?? {}
  return ATTENDANCE_FIELDS
    .filter((f) => f in before || f in after)
    .map((field) => ({ field, before: before[field] ?? null, after: after[field] ?? null }))
}

/** 打卡事件的主資訊：時間 + 異常旗標；重複打下班卡時帶出被覆蓋的時間 */
export function punchSummary(event) {
  const after = event?.after ?? {}
  if (event?.action === 'attendance.punched_in') {
    return { time: after.punchIn ?? null, flag: after.isLate ? 'late' : null, replaced: null, offline: Boolean(event.meta?.offline) }
  }
  if (event?.action === 'attendance.punched_out') {
    return {
      time: after.punchOut ?? null,
      flag: after.isEarlyLeave ? 'early' : null,
      replaced: event.before?.punchOut ?? null,
      offline: Boolean(event.meta?.offline),
    }
  }
  return null
}

const REQUEST_PAGE = { leave: '/leave', correction: '/correction', overtime: '/overtime' }

/** 申請事件 → 對應的申請清單頁 */
export function requestLink(event) {
  if (activityCategory(event?.action) !== 'request') return null
  const path = REQUEST_PAGE[event.entityType]
  return path ? `${path}?tab=list` : null
}
