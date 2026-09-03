import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCashout } from '../src/services/leaveCashout.js'

test('整數天數：5 天 × 日薪 (48000/30=1600) = 8000', () => {
  const r = computeCashout({ remainingMinutes: 5 * 480, monthlyWage: 48000 })
  assert.equal(r.minutes, 2400)
  assert.equal(r.days, 5)
  assert.equal(r.dailyWage, 1600)
  assert.equal(r.amount, 8000)
})

test('小數天數：3.5 天 × 1600 = 5600', () => {
  const r = computeCashout({ remainingMinutes: Math.round(3.5 * 480), monthlyWage: 48000 })
  assert.equal(r.days, 3.5)
  assert.equal(r.amount, 5600)
})

test('日薪四捨五入：50000/30 = 1666.67 → 1667', () => {
  const r = computeCashout({ remainingMinutes: 480, monthlyWage: 50000 })
  assert.equal(r.dailyWage, 1667)
  assert.equal(r.amount, 1667)
})

test('剩餘為 0 → 全部 0', () => {
  const r = computeCashout({ remainingMinutes: 0, monthlyWage: 48000 })
  assert.deepEqual(r, { minutes: 0, days: 0, dailyWage: 0, amount: 0 })
})

test('剩餘為負 → 全部 0', () => {
  const r = computeCashout({ remainingMinutes: -100, monthlyWage: 48000 })
  assert.equal(r.amount, 0)
  assert.equal(r.minutes, 0)
})
