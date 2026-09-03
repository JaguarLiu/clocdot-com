import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyOvertime } from '../src/services/overtime.js'

const STD = 480 // 8h

test('工作日未超時 → 無加班', () => {
  const r = classifyOvertime({ dayType: 'workday', workMinutes: 480, standardDailyMinutes: STD })
  assert.deepEqual(r, { tiers: [], totalOvertimeMinutes: 0 })
})

test('工作日超時 1.5h → 全進 1.34 級', () => {
  const r = classifyOvertime({ dayType: 'workday', workMinutes: 480 + 90, standardDailyMinutes: STD })
  assert.deepEqual(r.tiers, [{ rate: '1.34', minutes: 90 }])
  assert.equal(r.totalOvertimeMinutes, 90)
})

test('工作日超時 3h → 前2h 1.34、後1h 1.67', () => {
  const r = classifyOvertime({ dayType: 'workday', workMinutes: 480 + 180, standardDailyMinutes: STD })
  assert.deepEqual(r.tiers, [
    { rate: '1.34', minutes: 120 },
    { rate: '1.67', minutes: 60 },
  ])
  assert.equal(r.totalOvertimeMinutes, 180)
})

test('工作日超時 5h → 單日上限 4h，超出仍計 1.67 並標記 exceedsDailyCap', () => {
  const r = classifyOvertime({ dayType: 'workday', workMinutes: 480 + 300, standardDailyMinutes: STD })
  assert.deepEqual(r.tiers, [
    { rate: '1.34', minutes: 120 },
    { rate: '1.67', minutes: 180 },
  ])
  assert.equal(r.totalOvertimeMinutes, 300)
  assert.equal(r.exceedsDailyCap, true)
})

test('休息日 工作 3h → 前2h 1.34、第3h 1.67', () => {
  const r = classifyOvertime({ dayType: 'restday', workMinutes: 180, standardDailyMinutes: STD })
  assert.deepEqual(r.tiers, [
    { rate: '1.34', minutes: 120 },
    { rate: '1.67', minutes: 60 },
  ])
})

test('休息日 工作 10h → 2h 1.34、6h 1.67、2h 2.67', () => {
  const r = classifyOvertime({ dayType: 'restday', workMinutes: 600, standardDailyMinutes: STD })
  assert.deepEqual(r.tiers, [
    { rate: '1.34', minutes: 120 },
    { rate: '1.67', minutes: 360 },
    { rate: '2.67', minutes: 120 },
  ])
  assert.equal(r.totalOvertimeMinutes, 600)
})

test('國定假日 工作 5h → 全部 holiday 級', () => {
  const r = classifyOvertime({ dayType: 'national_holiday', workMinutes: 300, standardDailyMinutes: STD })
  assert.deepEqual(r.tiers, [{ rate: 'holiday', minutes: 300 }])
})

test('例假 工作 4h → 全部 regular_leave 級', () => {
  const r = classifyOvertime({ dayType: 'regular_leave', workMinutes: 240, standardDailyMinutes: STD })
  assert.deepEqual(r.tiers, [{ rate: 'regular_leave', minutes: 240 }])
})

test('工時為 0 → 無加班', () => {
  const r = classifyOvertime({ dayType: 'restday', workMinutes: 0, standardDailyMinutes: STD })
  assert.deepEqual(r, { tiers: [], totalOvertimeMinutes: 0 })
})
