import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { eventLabelKey, stepTone, eventLevel } from '../src/utils/requestProgress.js'

const zhTW = JSON.parse(readFileSync(new URL('../src/i18n/locales/zh-TW.json', import.meta.url), 'utf-8'))
const en = JSON.parse(readFileSync(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf-8'))

test('eventLabelKey：action 的點換成底線；加班重送另給標籤', () => {
  assert.equal(eventLabelKey({ action: 'leave.cancel_requested' }), 'progress.action.leave_cancel_requested')
  assert.equal(eventLabelKey({ action: 'overtime.submitted', meta: { resubmitted: true } }), 'progress.action.overtime_resubmitted')
  assert.equal(eventLabelKey({ action: 'overtime.submitted', meta: { resubmitted: false } }), 'progress.action.overtime_submitted')
})

test('stepTone：已決議照狀態；pending 依是否為目前關卡分 current / waiting', () => {
  assert.equal(stepTone({ level: 1, status: 'approved' }, 2), 'approved')
  assert.equal(stepTone({ level: 1, status: 'skipped' }, null), 'skipped')
  assert.equal(stepTone({ level: 2, status: 'pending' }, 2), 'current')
  assert.equal(stepTone({ level: 3, status: 'pending' }, 2), 'waiting')
})

test('eventLevel：只接受整數', () => {
  assert.equal(eventLevel({ meta: { level: 2 } }), 2)
  assert.equal(eventLevel({ meta: null }), null)
})

// 員工看得到的申請事件都要有中英標籤，避免畫面出現原始 key
const REQUEST_ACTIONS = [
  'leave.submitted', 'leave.withdrawn', 'leave.cancel_requested', 'leave.cancel_confirmed', 'leave.cancel_rejected',
  'leave.approved', 'leave.rejected', 'correction.submitted', 'correction.approved', 'correction.rejected',
  'overtime.submitted', 'overtime.approved', 'overtime.rejected', 'approval.step_approved', 'approval.step_rejected',
]

test('每個申請事件在 zh-TW / en 都有標籤', () => {
  const keys = [...REQUEST_ACTIONS.map((action) => eventLabelKey({ action })), 'progress.action.overtime_resubmitted']
  for (const key of keys) {
    const leaf = key.split('.').pop()
    assert.ok(zhTW.progress.action[leaf], `zh-TW 缺 ${key}`)
    assert.ok(en.progress.action[leaf], `en 缺 ${key}`)
  }
})

test('REQUEST_ACTIONS 與 server 的員工可見清單一致', async () => {
  const { EMPLOYEE_VISIBLE_ACTIONS } = await import('../../server/src/services/audit.js')
  const serverRequestActions = EMPLOYEE_VISIBLE_ACTIONS.filter((a) => /^(leave|correction|overtime|approval)\./.test(a))
  assert.deepEqual([...serverRequestActions].sort(), [...REQUEST_ACTIONS].sort())
})
