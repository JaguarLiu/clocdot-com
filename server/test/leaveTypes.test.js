import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveLeaveDeductRate, DEFAULT_LEAVE_DEDUCT_RATE } from '../src/services/leaveTypes.js'

test('事假預設扣全薪 (1.0)', () => {
  assert.equal(resolveLeaveDeductRate('personal', null), 1)
})

test('病假預設扣半薪 (0.5)', () => {
  assert.equal(resolveLeaveDeductRate('sick', null), 0.5)
})

test('其餘假別預設不扣 (0)', () => {
  assert.equal(resolveLeaveDeductRate('annual', null), 0)
  assert.equal(resolveLeaveDeductRate('marriage', undefined), 0)
})

test('政策覆寫優先於系統預設', () => {
  assert.equal(resolveLeaveDeductRate('sick', 0), 0)
  assert.equal(resolveLeaveDeductRate('personal', 0.3), 0.3)
})

test('DEFAULT 常數只含 personal/sick', () => {
  assert.deepEqual(DEFAULT_LEAVE_DEDUCT_RATE, { personal: 1, sick: 0.5 })
})
