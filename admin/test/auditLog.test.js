import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AUDIT_CATEGORIES, actionLabelKey, actionCategory, actionTone, changedFieldRows, formatAuditValue,
  auditSummary, buildAuditQuery,
} from '../src/lib/auditLog.js'
import { AUDIT_ACTIONS } from '../../server/src/services/audit.js'

const zhTW = JSON.parse(readFileSync(new URL('../src/i18n/locales/zh-TW.json', import.meta.url), 'utf-8'))
const en = JSON.parse(readFileSync(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf-8'))

test('server 的每個 action 在 zh-TW / en 都有標籤，分類也都在篩選清單內', () => {
  for (const action of Object.keys(AUDIT_ACTIONS)) {
    const leaf = actionLabelKey(action).split('.').pop()
    assert.ok(zhTW.auditLog.action[leaf], `zh-TW 缺 ${action}`)
    assert.ok(en.auditLog.action[leaf], `en 缺 ${action}`)
    assert.ok(AUDIT_CATEGORIES.includes(actionCategory(action)), `分類清單缺 ${actionCategory(action)}`)
  }
  for (const c of AUDIT_CATEGORIES) {
    assert.ok(zhTW.auditLog.category[c], `zh-TW 缺分類 ${c}`)
    assert.ok(en.auditLog.category[c], `en 缺分類 ${c}`)
  }
})

test('actionTone：失敗 / 駁回為紅，其餘依分類', () => {
  assert.equal(actionTone('auth.login_failed'), 'red')
  assert.equal(actionTone('approval.step_rejected'), 'red')
  assert.equal(actionTone('leave.approved'), 'sky')
  assert.equal(actionTone('attendance.edited'), 'emerald')
  assert.equal(actionTone('payroll.run_unlocked'), 'slate')
})

test('changedFieldRows：合併 before / after 的欄位', () => {
  assert.deepEqual(changedFieldRows({ isLate: true }, { isLate: false }), [{ field: 'isLate', before: true, after: false }])
  assert.deepEqual(changedFieldRows({ lockedAt: '2026-01-01T00:00:00.000Z' }, null), [
    { field: 'lockedAt', before: '2026-01-01T00:00:00.000Z', after: null },
  ])
})

test('formatAuditValue：空值、布林、ISO 時間、陣列、物件', () => {
  assert.equal(formatAuditValue(null), '—')
  assert.deepEqual(formatAuditValue(false), { bool: false })
  assert.equal(formatAuditValue('2026-09-15T01:02:03.000Z', { formatDateTime: () => 'X' }), 'X')
  assert.equal(formatAuditValue(['leaves', 'payroll']), 'leaves, payroll')
  assert.equal(formatAuditValue([]), '[]')
  assert.equal(formatAuditValue({ a: 1 }), '{"a":1}')
  assert.equal(formatAuditValue(30000), '30000')
})

test('auditSummary：排班算格數、換薪算人數、其餘列欄位', () => {
  assert.deepEqual(auditSummary({ meta: { changes: [1, 2, 3] } }), { type: 'cells', count: 3 })
  assert.deepEqual(auditSummary({ meta: { results: [1] } }), { type: 'people', count: 1 })
  assert.deepEqual(auditSummary({ meta: { count: 2, users: [{}, {}] } }), { type: 'people', count: 2 })
  assert.deepEqual(auditSummary({ before: { isLate: true }, after: { isLate: false } }), { type: 'fields', fields: ['isLate'] })
  assert.deepEqual(auditSummary({ meta: { month: '2026-09' } }), { type: 'none' })
})

test('buildAuditQuery：略過空值、分類轉前綴、帶 cursor', () => {
  assert.equal(buildAuditQuery({ from: '', category: 'leave' }), 'action=leave.*&limit=50')
  assert.equal(
    buildAuditQuery({ from: '2026-09-01', to: '2026-09-15', targetUserId: 'u1' }, { cursor: 'c9' }),
    'from=2026-09-01&to=2026-09-15&targetUserId=u1&limit=50&cursor=c9',
  )
})
