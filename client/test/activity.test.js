import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  activityCategory, activityLabelKey, activityTone, isByOthers, groupByLocalDate, attendanceChanges, punchSummary, requestLink,
} from '../src/utils/activity.js'
import { EMPLOYEE_VISIBLE_ACTIONS, employeeActivityActions } from '../../server/src/services/audit.js'

const zhTW = JSON.parse(readFileSync(new URL('../src/i18n/locales/zh-TW.json', import.meta.url), 'utf-8'))
const en = JSON.parse(readFileSync(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf-8'))
const lookup = (dict, key) => key.split('.').reduce((o, k) => o?.[k], dict)

test('員工可見的每個 action 在 zh-TW / en 都有標籤', () => {
  for (const action of EMPLOYEE_VISIBLE_ACTIONS) {
    const key = activityLabelKey({ action })
    assert.ok(lookup(zhTW, key), `zh-TW 缺 ${key}`)
    assert.ok(lookup(en, key), `en 缺 ${key}`)
  }
})

test('activityCategory 與 server 的分類一致', () => {
  for (const c of ['attendance', 'request', 'account']) {
    for (const action of employeeActivityActions(c)) assert.equal(activityCategory(action), c, action)
  }
})

test('activityTone：駁回紅、下班卡橘、請假藍、帳號灰', () => {
  assert.equal(activityTone('approval.step_rejected'), 'red')
  assert.equal(activityTone('attendance.punched_out'), 'orange')
  assert.equal(activityTone('attendance.edited'), 'emerald')
  assert.equal(activityTone('leave.approved'), 'sky')
  assert.equal(activityTone('user.password_reset'), 'slate')
})

test('isByOthers：操作者不是自己才算', () => {
  assert.equal(isByOthers({ actor: { id: 'adm' } }, 'me'), true)
  assert.equal(isByOthers({ actor: { id: 'me' } }, 'me'), false)
  assert.equal(isByOthers({ actor: null }, 'me'), false)
})

test('groupByLocalDate：同一天歸同組、保留順序', () => {
  const a = new Date(2026, 8, 15, 18, 0).toISOString()
  const b = new Date(2026, 8, 15, 9, 0).toISOString()
  const c = new Date(2026, 8, 14, 23, 0).toISOString()
  const groups = groupByLocalDate([{ id: 1, createdAt: a }, { id: 2, createdAt: b }, { id: 3, createdAt: c }])
  assert.deepEqual(groups.map((g) => [g.key, g.items.map((i) => i.id)]), [['2026-09-15', [1, 2]], ['2026-09-14', [3]]])
})

test('attendanceChanges：只列出勤欄位、依固定順序', () => {
  const rows = attendanceChanges({ action: 'attendance.edited', before: { isLate: true, foo: 1 }, after: { isLate: false } })
  assert.deepEqual(rows, [{ field: 'isLate', before: true, after: false }])
  assert.deepEqual(attendanceChanges({ action: 'attendance.punched_in', after: { isLate: true } }), [])
})

test('punchSummary：上班帶遲到、下班帶早退與被覆蓋的時間', () => {
  assert.deepEqual(punchSummary({ action: 'attendance.punched_in', after: { punchIn: 'T1', isLate: true }, meta: { offline: true } }),
    { time: 'T1', flag: 'late', replaced: null, offline: true })
  assert.deepEqual(punchSummary({ action: 'attendance.punched_out', before: { punchOut: 'T0' }, after: { punchOut: 'T2', isEarlyLeave: false } }),
    { time: 'T2', flag: null, replaced: 'T0', offline: false })
  assert.equal(punchSummary({ action: 'leave.approved' }), null)
})

test('requestLink：申請事件連到清單頁；其他沒有連結', () => {
  assert.equal(requestLink({ action: 'approval.step_approved', entityType: 'overtime' }), '/overtime?tab=list')
  assert.equal(requestLink({ action: 'leave.withdrawn', entityType: 'leave' }), '/leave?tab=list')
  assert.equal(requestLink({ action: 'attendance.edited', entityType: 'attendance' }), null)
})
