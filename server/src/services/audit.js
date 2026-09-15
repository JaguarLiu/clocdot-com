// 稽核紀錄（AuditLog）：action 清單、欄位 diff／去敏、寫入與查詢條件組裝。
//
// 寫入原則：
//   - 與業務寫入放在同一個 transaction（writeAudit 第一個參數傳 tx），要嘛一起成功要嘛一起 rollback
//   - before / after 只記「有變動的欄位」，敏感欄位一律遮蔽
//   - ctx 為 null 時 writeAudit 為 no-op，讓純邏輯測試（mock tx）不必準備 auditLog

import { localTimeToUTC } from '../utils/timezone.js'

// employee: true → 員工端「我的紀錄 / 申請進度」看得到
export const AUDIT_ACTIONS = {
  // 登入 / 帳號
  'auth.login_succeeded': { employee: false },
  'auth.login_failed': { employee: false },
  'auth.password_changed': { employee: true },
  'user.password_reset': { employee: true },
  'user.unlocked': { employee: true },
  'user.created': { employee: false },
  'user.imported': { employee: false },
  'user.updated': { employee: false },
  'user.deleted': { employee: false },
  'role.created': { employee: false },
  'role.updated': { employee: false },
  'role.deleted': { employee: false },
  'department.created': { employee: false },
  'department.updated': { employee: false },
  'department.deleted': { employee: false },
  'company.updated': { employee: false },
  'company_location.created': { employee: false },
  'company_location.updated': { employee: false },
  'company_location.deleted': { employee: false },
  'leave_policy.updated': { employee: false },

  // 打卡 / 出勤
  'attendance.punched_in': { employee: true },
  'attendance.punched_out': { employee: true },
  'attendance.corrected': { employee: true }, // 補卡核准後改寫出勤
  'attendance.edited': { employee: true }, // 管理員手動修改出勤旗標

  // 申請流程（entityType = leave | correction | overtime）
  'leave.submitted': { employee: true },
  'leave.withdrawn': { employee: true },
  'leave.cancel_requested': { employee: true },
  'leave.cancel_confirmed': { employee: true },
  'leave.cancel_rejected': { employee: true },
  'leave.approved': { employee: true },
  'leave.rejected': { employee: true },
  'correction.submitted': { employee: true },
  'correction.approved': { employee: true },
  'correction.rejected': { employee: true },
  'overtime.submitted': { employee: true },
  'overtime.approved': { employee: true },
  'overtime.rejected': { employee: true },
  'approval.step_approved': { employee: true },
  'approval.step_rejected': { employee: true },

  // 薪資 / 排班
  'salary_profile.updated': { employee: false },
  'payroll.run_generated': { employee: false },
  'payroll.cashout_applied': { employee: false },
  'payroll.item_adjusted': { employee: false },
  'payroll.run_locked': { employee: false },
  'payroll.run_unlocked': { employee: false },
  'schedule.assignments_updated': { employee: false },
  'shift.created': { employee: false },
  'shift.updated': { employee: false },
  'shift.deleted': { employee: false },
}

export const EMPLOYEE_VISIBLE_ACTIONS = Object.keys(AUDIT_ACTIONS).filter((a) => AUDIT_ACTIONS[a].employee)

// 員工端「我的紀錄」的分類
const EMPLOYEE_CATEGORY_OF_PREFIX = {
  attendance: 'attendance',
  leave: 'request', correction: 'request', overtime: 'request', approval: 'request',
  auth: 'account', user: 'account',
}
export const EMPLOYEE_ACTIVITY_CATEGORIES = ['attendance', 'request', 'account']

/** 員工可見 action 依分類過濾；未知或未指定分類 → 全部 */
export function employeeActivityActions(category) {
  if (!EMPLOYEE_ACTIVITY_CATEGORIES.includes(category)) return EMPLOYEE_VISIBLE_ACTIONS
  return EMPLOYEE_VISIBLE_ACTIONS.filter((a) => EMPLOYEE_CATEGORY_OF_PREFIX[a.split('.')[0]] === category)
}

const REDACTED_KEYS = new Set(['password', 'passwordHash', 'hash'])
const MASKED_KEYS = new Set(['bankAccount'])
const USER_AGENT_MAX = 300

function maskTail(v) {
  const s = String(v)
  return s.length <= 4 ? '****' : `****${s.slice(-4)}`
}

/** 轉成可安全存入 Json 欄位的值：Date → ISO、Decimal → 字串、敏感欄位遮蔽 */
export function toAuditValue(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toAuditValue)
  if (typeof value === 'object') {
    // Prisma Decimal（decimal.js）
    if (typeof value.toFixed === 'function' && typeof value.isFinite === 'function') return value.toString()
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue
      if (REDACTED_KEYS.has(k)) out[k] = '[REDACTED]'
      else if (MASKED_KEYS.has(k) && v != null) out[k] = maskTail(v)
      else out[k] = toAuditValue(v)
    }
    return out
  }
  return value
}

/**
 * 比對 before / after，只留有變動的欄位。
 * @param {object|null} before
 * @param {object|null} after
 * @param {string[]} [keys] 要比對的欄位；預設為 after 的所有 key
 * @returns {{before:object, after:object} | null} 無變動回 null
 */
export function diffFields(before, after, keys) {
  const b = toAuditValue(before ?? {})
  const a = toAuditValue(after ?? {})
  const fields = keys ?? Object.keys(a)
  const outBefore = {}
  const outAfter = {}
  let changed = false
  for (const k of fields) {
    const bv = b[k] === undefined ? null : b[k]
    const av = a[k] === undefined ? null : a[k]
    if (JSON.stringify(bv) === JSON.stringify(av)) continue
    outBefore[k] = bv
    outAfter[k] = av
    changed = true
  }
  return changed ? { before: outBefore, after: outAfter } : null
}

/** 從 Fastify request 取出寫入稽核所需的操作者資訊 */
export function auditContext(request) {
  const ua = request.headers?.['user-agent']
  return {
    companyId: request.companyId ?? null,
    actorId: request.user?.id ?? null,
    ip: request.ip ?? null,
    userAgent: typeof ua === 'string' ? ua.slice(0, USER_AGENT_MAX) : null,
  }
}

/** 組出 AuditLog create data（純函式，便於測試） */
export function buildAuditData(ctx, entry) {
  return {
    companyId: entry.companyId ?? ctx.companyId ?? null,
    actorId: entry.actorId !== undefined ? entry.actorId : (ctx.actorId ?? null),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId != null ? String(entry.entityId) : null,
    targetUserId: entry.targetUserId ?? null,
    before: entry.before != null ? toAuditValue(entry.before) : undefined,
    after: entry.after != null ? toAuditValue(entry.after) : undefined,
    meta: entry.meta != null ? toAuditValue(entry.meta) : undefined,
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
  }
}

/**
 * 寫一筆稽核紀錄。刻意不是 async：回傳 Prisma 的 lazy promise，
 * 可直接 await，也可塞進 `$transaction([...])` 陣列跟業務寫入一起送出。
 * @param {object} db prisma 或 tx
 * @param {object|null} ctx auditContext(request)；null → 不寫
 * @param {{action:string, entityType:string, entityId?:string|number, targetUserId?:string,
 *          companyId?:string, actorId?:string|null, before?:object, after?:object, meta?:object}} entry
 */
export function writeAudit(db, ctx, entry) {
  if (!ctx) return null
  return db.auditLog.create({ data: buildAuditData(ctx, entry) })
}

// ── 保存期限 ────────────────────────────────────────────────────────────

// 出勤紀錄依勞基法須保存 5 年，稽核紀錄預設同長
export const DEFAULT_RETENTION_DAYS = 1825
export const MIN_RETENTION_DAYS = 365

/** 解析保存天數；非法值回預設，過短值拉到下限（避免設錯把紀錄清光） */
export function resolveRetentionDays(raw) {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_RETENTION_DAYS
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_RETENTION_DAYS
  return Math.max(n, MIN_RETENTION_DAYS)
}

export function retentionCutoff(now, days) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

// ── 查詢 ────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const AUDIT_PAGE_MAX = 100
export const AUDIT_PAGE_DEFAULT = 50

export function resolvePageLimit(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return AUDIT_PAGE_DEFAULT
  return Math.min(n, AUDIT_PAGE_MAX)
}

/**
 * 後台查詢條件。from / to 為公司時區（Asia/Taipei）的日期，含頭含尾。
 * 非 admin（有 scopeUserIds）只看得到「操作者或受影響者在自己部門範圍內」的紀錄。
 * @returns {{ok:true, where:object} | {ok:false, error:string}}
 */
export function buildAdminAuditWhere({ companyId, scopeUserIds, timezone = 'Asia/Taipei' }, query = {}) {
  const { from, to, actorId, targetUserId, action, entityType, entityId } = query
  const where = { companyId }

  if (from !== undefined || to !== undefined) {
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      return { ok: false, error: 'from / to 需為 YYYY-MM-DD' }
    }
    where.createdAt = {}
    if (from) where.createdAt.gte = localTimeToUTC(from, '00:00', timezone)
    if (to) {
      const end = localTimeToUTC(to, '00:00', timezone)
      where.createdAt.lt = new Date(end.getTime() + 24 * 60 * 60 * 1000)
    }
  }
  if (actorId) where.actorId = String(actorId)
  if (targetUserId) where.targetUserId = String(targetUserId)
  if (action) {
    const a = String(action)
    // 'leave.*' → 前綴比對
    where.action = a.endsWith('.*') ? { startsWith: a.slice(0, -1) } : a
  }
  if (entityType) where.entityType = String(entityType)
  if (entityId) where.entityId = String(entityId)

  if (scopeUserIds) {
    where.OR = [
      { actorId: { in: scopeUserIds } },
      { targetUserId: { in: scopeUserIds } },
    ]
  }
  return { ok: true, where }
}

/** 員工視角：拿掉他人的 IP / UA，只留流程需要的資訊 */
export function toEmployeeEvent(log, namesById = {}) {
  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    createdAt: log.createdAt,
    actor: log.actorId ? { id: log.actorId, name: namesById[log.actorId] ?? null } : null,
    before: log.before ?? null,
    after: log.after ?? null,
    meta: log.meta ?? null,
  }
}
