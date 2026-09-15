// 稽核紀錄頁的顯示邏輯（純函式）。action 清單以 server/src/services/audit.js 為準。

// 篩選下拉的分類 → server 的 action 前綴查詢（'leave.*'）
export const AUDIT_CATEGORIES = [
  'auth', 'user', 'role', 'department', 'company', 'company_location', 'attendance', 'leave', 'correction',
  'overtime', 'approval', 'leave_policy', 'salary_profile', 'payroll', 'schedule', 'shift',
]

const CATEGORY_TONE = {
  attendance: 'emerald',
  correction: 'orange',
  leave: 'sky',
  overtime: 'amber',
  approval: 'amber',
}

/** 'leave.cancel_requested' → 'auditLog.action.leave_cancel_requested' */
export function actionLabelKey(action) {
  return `auditLog.action.${String(action ?? '').replace('.', '_')}`
}

export function actionCategory(action) {
  return String(action ?? '').split('.')[0]
}

/** 動作 badge 的語意色：失敗 / 駁回一律紅，其餘依分類，無對應則 slate */
export function actionTone(action) {
  if (/(\.login_failed|rejected)$/.test(action ?? '')) return 'red'
  return CATEGORY_TONE[actionCategory(action)] ?? 'slate'
}

/** before / after → 逐欄列（欄位順序依 after，再補 before 獨有的） */
export function changedFieldRows(before, after) {
  const b = before ?? {}
  const a = after ?? {}
  const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  return fields.map((field) => ({ field, before: b[field] ?? null, after: a[field] ?? null }))
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/**
 * 稽核值轉顯示字串。布林交給呼叫端翻譯（回傳 { bool }），其餘回字串。
 * @returns {string | {bool:boolean}}
 */
export function formatAuditValue(value, { formatDateTime = (d) => d.toISOString() } = {}) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return { bool: value }
  if (typeof value === 'string' && ISO_RE.test(value)) return formatDateTime(new Date(value))
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (value.every((v) => typeof v !== 'object' || v === null)) return value.join(', ')
    return JSON.stringify(value)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** 表格「摘要」欄：優先列變動欄位；排班 / 換薪 / 批次匯入用筆數 */
export function auditSummary(log) {
  const changes = log?.meta?.changes
  if (Array.isArray(changes)) return { type: 'cells', count: changes.length }
  const people = log?.meta?.results ?? log?.meta?.users
  if (Array.isArray(people)) return { type: 'people', count: people.length }
  const fields = changedFieldRows(log?.before, log?.after).map((r) => r.field)
  if (fields.length) return { type: 'fields', fields }
  return { type: 'none' }
}

/** 組查詢字串（空值略過；分類轉成前綴查詢） */
export function buildAuditQuery({ from, to, category, actorId, targetUserId }, { limit = 50, cursor } = {}) {
  const qs = new URLSearchParams()
  if (from) qs.set('from', from)
  if (to) qs.set('to', to)
  if (category) qs.set('action', `${category}.*`)
  if (actorId) qs.set('actorId', actorId)
  if (targetUserId) qs.set('targetUserId', targetUserId)
  qs.set('limit', String(limit))
  if (cursor) qs.set('cursor', cursor)
  return qs.toString()
}
