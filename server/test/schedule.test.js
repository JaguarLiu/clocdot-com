import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateShiftPayload, shiftFor, dateKey, isOvernightShift, shouldFallbackToYesterday } from '../src/services/schedule.js'

const morning = { id: 's1', name: '早班', startTime: '09:00', endTime: '18:00', breakMinutes: 60 }
const night = { id: 's2', name: '晚班', startTime: '13:00', endTime: '22:00', breakMinutes: 60 }

function bundle({ assignments = [], defaults = [] } = {}) {
  return {
    assignmentsByKey: new Map(assignments.map(([userId, dateStr, shift]) => [dateKey(userId, dateStr), shift])),
    defaultShiftByUser: new Map(defaults),
  }
}

// ── shiftFor 解析順序 ──
test('當日有指派 → 用指派班別 (source=assignment)', () => {
  const b = bundle({ assignments: [['u1', '2026-07-06', night]], defaults: [['u1', morning]] })
  assert.deepEqual(shiftFor(b, 'u1', '2026-07-06'), { shift: night, source: 'assignment' })
})

test('無指派但有預設班 → 用預設班 (source=default)', () => {
  const b = bundle({ defaults: [['u1', morning]] })
  assert.deepEqual(shiftFor(b, 'u1', '2026-07-06'), { shift: morning, source: 'default' })
})

test('無指派也無預設班 → null', () => {
  assert.equal(shiftFor(bundle(), 'u1', '2026-07-06'), null)
})

test('指派只影響該日，其他日仍回預設班', () => {
  const b = bundle({ assignments: [['u1', '2026-07-06', night]], defaults: [['u1', morning]] })
  assert.deepEqual(shiftFor(b, 'u1', '2026-07-07'), { shift: morning, source: 'default' })
})

test('不同員工互不影響', () => {
  const b = bundle({ assignments: [['u1', '2026-07-06', night]], defaults: [['u2', morning]] })
  assert.equal(shiftFor(b, 'u2', '2026-07-06').source, 'default')
  assert.equal(shiftFor(b, 'u1', '2026-07-07'), null)
})

// ── validateShiftPayload ──
const valid = { name: '早班', startTime: '09:00', endTime: '18:00', breakMinutes: 60 }

test('合法 payload → null', () => {
  assert.equal(validateShiftPayload(valid), null)
})

test('名稱空白 → 錯誤', () => {
  assert.notEqual(validateShiftPayload({ ...valid, name: '  ' }), null)
  assert.notEqual(validateShiftPayload({ ...valid, name: undefined }), null)
})

test('時間格式錯誤 → 錯誤', () => {
  assert.notEqual(validateShiftPayload({ ...valid, startTime: '9:00' }), null)
  assert.notEqual(validateShiftPayload({ ...valid, endTime: '25:00' }), null)
  assert.notEqual(validateShiftPayload({ ...valid, endTime: undefined }), null)
})

test('start 與 end 相同 → 錯誤;end < start 為跨日班(合法)', () => {
  assert.equal(validateShiftPayload({ ...valid, startTime: '18:00', endTime: '09:00' }), null)
  assert.notEqual(validateShiftPayload({ ...valid, startTime: '09:00', endTime: '09:00' }), null)
})

test('breakMinutes 超界或非整數 → 錯誤', () => {
  assert.notEqual(validateShiftPayload({ ...valid, breakMinutes: -1 }), null)
  assert.notEqual(validateShiftPayload({ ...valid, breakMinutes: 481 }), null)
  assert.notEqual(validateShiftPayload({ ...valid, breakMinutes: 60.5 }), null)
})

// ── 跨日班 ──
const overnight = { id: 's3', name: '晚班', startTime: '22:00', endTime: '06:00', breakMinutes: 60 }

test('validateShiftPayload:跨日班(22:00–06:00)合法', () => {
  assert.equal(validateShiftPayload({ ...valid, startTime: '22:00', endTime: '06:00' }), null)
})

test('validateShiftPayload:上下班時間相同 → 錯誤(不允許 24h 班)', () => {
  assert.notEqual(validateShiftPayload({ ...valid, startTime: '09:00', endTime: '09:00' }), null)
})

test('isOvernightShift:end < start → true;正常班 → false;null/缺欄位 → false', () => {
  assert.equal(isOvernightShift(overnight), true)
  assert.equal(isOvernightShift(morning), false)
  assert.equal(isOvernightShift(null), false)
  assert.equal(isOvernightShift({ startTime: '22:00' }), false)
})

// ── 下班卡回溯判定 ──
test('昨天跨日班且有 punchIn、今天無可下班紀錄 → 回溯', () => {
  assert.equal(shouldFallbackToYesterday({
    todayRecord: null,
    yesterdayRecord: { punchIn: new Date() },
    yesterdayShift: overnight,
  }), true)
})

test('今天已有 punchIn → 不回溯(下班歸今天)', () => {
  assert.equal(shouldFallbackToYesterday({
    todayRecord: { punchIn: new Date() },
    yesterdayRecord: { punchIn: new Date() },
    yesterdayShift: overnight,
  }), false)
})

test('昨天班別非跨日 → 不回溯', () => {
  assert.equal(shouldFallbackToYesterday({
    todayRecord: null,
    yesterdayRecord: { punchIn: new Date() },
    yesterdayShift: morning,
  }), false)
})

test('昨天無紀錄或無 punchIn → 不回溯', () => {
  assert.equal(shouldFallbackToYesterday({ todayRecord: null, yesterdayRecord: null, yesterdayShift: overnight }), false)
  assert.equal(shouldFallbackToYesterday({ todayRecord: null, yesterdayRecord: { punchIn: null }, yesterdayShift: overnight }), false)
})
