import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expandLeaveToDays } from '../src/services/leaveExpansion.js'

test('同日半日事假 09:00-13:00 → 240 分', () => {
  const out = expandLeaveToDays({
    leaveType: 'personal',
    startDate: new Date('2026-05-20'), startTime: '09:00',
    endDate: new Date('2026-05-20'), endTime: '13:00',
  })
  assert.deepEqual(out, [{ date: '2026-05-20', leaveType: 'personal', minutes: 240 }])
})

test('跨三日病假：首日尾段 + 中間整日 + 末日前段 (480 基準)', () => {
  const out = expandLeaveToDays({
    leaveType: 'sick',
    startDate: new Date('2026-05-20'), startTime: '06:00', // 首日 480-360=120
    endDate: new Date('2026-05-22'), endTime: '04:00',     // 末日 240
  }, 480)
  assert.deepEqual(out, [
    { date: '2026-05-20', leaveType: 'sick', minutes: 120 },
    { date: '2026-05-21', leaveType: 'sick', minutes: 480 },
    { date: '2026-05-22', leaveType: 'sick', minutes: 240 },
  ])
})

test('全日請假 09:00-17:00 (480) → 單日 480', () => {
  const out = expandLeaveToDays({
    leaveType: 'personal',
    startDate: new Date('2026-05-20'), startTime: '09:00',
    endDate: new Date('2026-05-20'), endTime: '17:00',
  })
  assert.equal(out[0].minutes, 480)
})
