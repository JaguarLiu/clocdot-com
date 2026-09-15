import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AUDIT_ACTIONS, EMPLOYEE_VISIBLE_ACTIONS, toAuditValue, diffFields, auditContext, buildAuditData,
  writeAudit, resolveRetentionDays, retentionCutoff, DEFAULT_RETENTION_DAYS, MIN_RETENTION_DAYS,
  buildAdminAuditWhere, resolvePageLimit, AUDIT_PAGE_MAX, toEmployeeEvent, employeeActivityActions,
} from '../src/services/audit.js'

test('toAuditValue：Date → ISO、Decimal → 字串、密碼遮蔽、帳號只留末四碼', () => {
  const decimal = { toFixed: () => '0.030', isFinite: () => true, toString: () => '0.03' }
  const out = toAuditValue({
    at: new Date('2026-09-15T01:00:00Z'), rate: decimal, password: 'hash', bankAccount: '0123456789',
    nested: [{ password: 'x', ok: 1 }], skip: undefined,
  })
  assert.deepEqual(out, {
    at: '2026-09-15T01:00:00.000Z', rate: '0.03', password: '[REDACTED]', bankAccount: '****6789',
    nested: [{ password: '[REDACTED]', ok: 1 }],
  })
})

test('diffFields：只留有變動的欄位；無變動回 null', () => {
  const before = { isLate: true, isHoliday: false, leaveType: null, other: 'x' }
  assert.deepEqual(diffFields(before, { isLate: false, isHoliday: false }), {
    before: { isLate: true }, after: { isLate: false },
  })
  assert.equal(diffFields(before, { isLate: true }), null)
})

test('diffFields：Date 與陣列以值比較、undefined 視同 null', () => {
  const d = new Date('2026-01-01T00:00:00Z')
  assert.equal(diffFields({ hireDate: d, ips: ['1.1.1.1'] }, { hireDate: new Date(d), ips: ['1.1.1.1'] }), null)
  assert.equal(diffFields({}, { managerId: null }), null)
  assert.deepEqual(diffFields({ ips: [] }, { ips: ['10.0.0.0/8'] }), { before: { ips: [] }, after: { ips: ['10.0.0.0/8'] } })
})

test('diffFields：before 為 null（新建）時全部欄位都算變動', () => {
  assert.deepEqual(diffFields(null, { baseSalary: 30000 }), { before: { baseSalary: null }, after: { baseSalary: 30000 } })
})

test('auditContext：從 request 取操作者、IP、截斷 UA', () => {
  const ctx = auditContext({
    companyId: 'c1', user: { id: 'u1' }, ip: '1.2.3.4', headers: { 'user-agent': 'x'.repeat(500) },
  })
  assert.equal(ctx.companyId, 'c1')
  assert.equal(ctx.actorId, 'u1')
  assert.equal(ctx.ip, '1.2.3.4')
  assert.equal(ctx.userAgent.length, 300)
  assert.deepEqual(auditContext({ headers: {} }), { companyId: null, actorId: null, ip: null, userAgent: null })
})

test('buildAuditData：entry 的 companyId / actorId 可覆寫 ctx（actorId 可顯式設為 null）', () => {
  const ctx = { companyId: null, actorId: 'u1', ip: '1.1.1.1', userAgent: 'ua' }
  const data = buildAuditData(ctx, {
    action: 'auth.login_failed', entityType: 'user', entityId: 42, companyId: 'c9', actorId: null,
  })
  assert.equal(data.companyId, 'c9')
  assert.equal(data.actorId, null)
  assert.equal(data.entityId, '42')
  assert.equal(data.before, undefined)
})

test('writeAudit：ctx 為 null 時不寫；否則呼叫 auditLog.create', () => {
  const calls = []
  const db = { auditLog: { create: (args) => { calls.push(args); return 'promise' } } }
  assert.equal(writeAudit(db, null, { action: 'user.unlocked', entityType: 'user' }), null)
  assert.equal(writeAudit(db, { actorId: 'a' }, { action: 'user.unlocked', entityType: 'user' }), 'promise')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].data.action, 'user.unlocked')
})

test('action 清單：命名 <entity>.<verb>；員工可見清單不含薪資 / 權限類', () => {
  for (const a of Object.keys(AUDIT_ACTIONS)) assert.match(a, /^[a-z_]+\.[a-z_]+$/)
  for (const hidden of ['salary_profile.updated', 'payroll.run_unlocked', 'role.updated', 'auth.login_failed']) {
    assert.equal(EMPLOYEE_VISIBLE_ACTIONS.includes(hidden), false)
  }
  assert.ok(EMPLOYEE_VISIBLE_ACTIONS.includes('leave.approved'))
})

test('resolveRetentionDays：預設 5 年、非法值回預設、過短拉到下限', () => {
  assert.equal(resolveRetentionDays(undefined), DEFAULT_RETENTION_DAYS)
  assert.equal(resolveRetentionDays('abc'), DEFAULT_RETENTION_DAYS)
  assert.equal(resolveRetentionDays('-5'), DEFAULT_RETENTION_DAYS)
  assert.equal(resolveRetentionDays('30'), MIN_RETENTION_DAYS)
  assert.equal(resolveRetentionDays('2555'), 2555)
})

test('retentionCutoff：往前推 N 天', () => {
  const now = new Date('2026-09-15T00:00:00Z')
  assert.equal(retentionCutoff(now, 365).toISOString(), '2025-09-15T00:00:00.000Z')
})

test('buildAdminAuditWhere：日期以台北時區換算、含頭含尾', () => {
  const r = buildAdminAuditWhere({ companyId: 'c1' }, { from: '2026-09-01', to: '2026-09-15' })
  assert.equal(r.ok, true)
  assert.equal(r.where.companyId, 'c1')
  assert.equal(r.where.createdAt.gte.toISOString(), '2026-08-31T16:00:00.000Z')
  assert.equal(r.where.createdAt.lt.toISOString(), '2026-09-15T16:00:00.000Z')
})

test('buildAdminAuditWhere：action 支援 prefix.*、非 admin 限縮部門範圍', () => {
  const r = buildAdminAuditWhere({ companyId: 'c1', scopeUserIds: ['u1', 'u2'] }, { action: 'leave.*', targetUserId: 'u1' })
  assert.deepEqual(r.where.action, { startsWith: 'leave.' })
  assert.equal(r.where.targetUserId, 'u1')
  assert.deepEqual(r.where.OR, [{ actorId: { in: ['u1', 'u2'] } }, { targetUserId: { in: ['u1', 'u2'] } }])
})

test('buildAdminAuditWhere：日期格式錯誤回 error', () => {
  assert.deepEqual(buildAdminAuditWhere({ companyId: 'c1' }, { from: '2026/09/01' }), {
    ok: false, error: 'from / to 需為 YYYY-MM-DD',
  })
})

test('resolvePageLimit：預設 50、上限 100', () => {
  assert.equal(resolvePageLimit(undefined), 50)
  assert.equal(resolvePageLimit('10'), 10)
  assert.equal(resolvePageLimit('9999'), AUDIT_PAGE_MAX)
})

test('toEmployeeEvent：不外洩 IP / UA，帶操作者姓名', () => {
  const e = toEmployeeEvent({
    id: 'a1', action: 'leave.approved', entityType: 'leave', entityId: 'L1', createdAt: new Date(0),
    actorId: 'mgr', ip: '9.9.9.9', userAgent: 'ua', companyId: 'c1', before: null, after: null, meta: { level: 1 },
  }, { mgr: '王主管' })
  assert.equal('ip' in e, false)
  assert.equal('userAgent' in e, false)
  assert.deepEqual(e.actor, { id: 'mgr', name: '王主管' })
})

test('employeeActivityActions：三個分類剛好切分員工可見清單；未知分類回全部', () => {
  const all = ['attendance', 'request', 'account'].flatMap((c) => employeeActivityActions(c))
  assert.deepEqual([...all].sort(), [...EMPLOYEE_VISIBLE_ACTIONS].sort())
  assert.ok(employeeActivityActions('attendance').includes('attendance.edited'))
  assert.ok(employeeActivityActions('request').includes('approval.step_approved'))
  assert.deepEqual(employeeActivityActions('account').sort(), ['auth.password_changed', 'user.password_reset', 'user.unlocked'])
  assert.equal(employeeActivityActions('nope'), EMPLOYEE_VISIBLE_ACTIONS)
  assert.equal(employeeActivityActions(undefined), EMPLOYEE_VISIBLE_ACTIONS)
})
