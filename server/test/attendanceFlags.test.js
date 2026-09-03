import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAttendanceFlags, lateEarlyMinutes } from '../src/services/attendanceFlags.js'

// Asia/Taipei (UTC+8, 無 DST)：09:00 = 01:00Z、18:00 = 10:00Z
const shift = { startTime: '09:00', endTime: '18:00' }
// 跨日晚班：22:00 = 14:00Z；翌日 06:00 = 當日 22:00Z
const nightShift = { startTime: '22:00', endTime: '06:00' }
const tz = 'Asia/Taipei'
const wd = new Date('2026-05-20T00:00:00Z') // workDate 2026-05-20

test('準時上班 (08:55) → 不遲到', () => {
  const { isLate } = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T00:55:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(isLate, false)
})

test('遲到上班 (09:30) → 遲到', () => {
  const { isLate } = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T01:30:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(isLate, true)
})

test('恰好 09:00 整 → 不算遲到 (邊界, 嚴格大於)', () => {
  const { isLate } = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T01:00:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(isLate, false)
})

test('09:00:59 → 不算遲到 (同一分鐘內忽略秒數)', () => {
  const { isLate } = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T01:00:59Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(isLate, false)
})

test('09:01:00 → 遲到 (跨到下一分鐘)', () => {
  const { isLate } = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T01:01:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(isLate, true)
})

test('17:59:59 → 早退 (尚在 17:59 分)', () => {
  const { isEarlyLeave } = computeAttendanceFlags({
    punchOut: new Date('2026-05-20T09:59:59Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(isEarlyLeave, true)
})

test('18:00:59 → 不算早退 (同一分鐘內忽略秒數)', () => {
  const { isEarlyLeave } = computeAttendanceFlags({
    punchOut: new Date('2026-05-20T10:00:59Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(isEarlyLeave, false)
})

test('早退下班 (17:00) → 早退', () => {
  const { isEarlyLeave } = computeAttendanceFlags({
    punchOut: new Date('2026-05-20T09:00:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(isEarlyLeave, true)
})

test('正常下班 (18:30) → 不早退', () => {
  const { isEarlyLeave } = computeAttendanceFlags({
    punchOut: new Date('2026-05-20T10:30:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(isEarlyLeave, false)
})

test('恰好 18:00 整 → 不算早退 (邊界, 嚴格小於)', () => {
  const { isEarlyLeave } = computeAttendanceFlags({
    punchOut: new Date('2026-05-20T10:00:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(isEarlyLeave, false)
})

// 補卡回歸：基準一律取 workDate，補過去日也正確
test('補卡 (過去工作日) 以該 workDate 為基準計算遲到', () => {
  const { isLate } = computeAttendanceFlags({
    punchIn: new Date('2026-01-10T01:30:00Z'), // 該日 09:30 Taipei
    shift, workDate: new Date('2026-01-10T00:00:00Z'), timezone: tz,
  })
  assert.equal(isLate, true)
})

test('只給 punchIn → 只回傳 isLate，不含 isEarlyLeave', () => {
  const flags = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T01:30:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.deepEqual(flags, { isLate: true })
})

test('只給 punchOut → 只回傳 isEarlyLeave，不含 isLate', () => {
  const flags = computeAttendanceFlags({
    punchOut: new Date('2026-05-20T09:00:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.deepEqual(flags, { isEarlyLeave: true })
})

test('同時給上下班 → 兩個旗標都回傳', () => {
  const flags = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T01:30:00Z'),
    punchOut: new Date('2026-05-20T09:00:00Z'),
    shift, workDate: wd, timezone: tz,
  })
  assert.deepEqual(flags, { isLate: true, isEarlyLeave: true })
})

test('無班別 (shift=null) → 旗標一律 false', () => {
  const flags = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T01:30:00Z'),
    punchOut: new Date('2026-05-20T09:00:00Z'),
    shift: null, workDate: wd, timezone: tz,
  })
  assert.deepEqual(flags, { isLate: false, isEarlyLeave: false })
})

test('缺 workDate → 旗標一律 false（防禦）', () => {
  const flags = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T01:30:00Z'), shift, timezone: tz,
  })
  assert.deepEqual(flags, { isLate: false })
})

test('沒有任何打卡時間 → 空物件', () => {
  assert.deepEqual(computeAttendanceFlags({ shift, workDate: wd, timezone: tz }), {})
})

test('未提供 timezone → 預設 Asia/Taipei', () => {
  const { isLate } = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T01:30:00Z'), shift, workDate: wd,
  })
  assert.equal(isLate, true)
})

test('其他時區 (America/New_York, UTC-5)：09:30 當地 = 14:30Z → 遲到', () => {
  const { isLate } = computeAttendanceFlags({
    punchIn: new Date('2026-01-10T14:30:00Z'), // EST 冬令 09:30
    shift, workDate: new Date('2026-01-10T00:00:00Z'), timezone: 'America/New_York',
  })
  assert.equal(isLate, true)
})

// ── 跨日班 ──
test('跨日班 21:50 上班 → 不遲到；22:30 上班 → 遲到', () => {
  assert.equal(computeAttendanceFlags({
    punchIn: new Date('2026-05-20T13:50:00Z'), shift: nightShift, workDate: wd, timezone: tz,
  }).isLate, false)
  assert.equal(computeAttendanceFlags({
    punchIn: new Date('2026-05-20T14:30:00Z'), shift: nightShift, workDate: wd, timezone: tz,
  }).isLate, true)
})

test('跨日班凌晨 00:30 才打上班卡 → 遲到（基準仍是排班日 22:00）', () => {
  const { isLate } = computeAttendanceFlags({
    punchIn: new Date('2026-05-20T16:30:00Z'), // 台北 5/21 00:30
    shift: nightShift, workDate: wd, timezone: tz,
  })
  assert.equal(isLate, true)
})

test('跨日班翌日 05:50 下班（基準翌日 06:00）→ 早退；06:10 → 不早退', () => {
  assert.equal(computeAttendanceFlags({
    punchOut: new Date('2026-05-20T21:50:00Z'), // 台北 5/21 05:50
    shift: nightShift, workDate: wd, timezone: tz,
  }).isEarlyLeave, true)
  assert.equal(computeAttendanceFlags({
    punchOut: new Date('2026-05-20T22:10:00Z'), // 台北 5/21 06:10
    shift: nightShift, workDate: wd, timezone: tz,
  }).isEarlyLeave, false)
})

// ── lateEarlyMinutes ──
test('遲到 30 分 → lateMinutes=30', () => {
  const { lateMinutes } = lateEarlyMinutes({
    punchIn: new Date('2026-05-20T01:30:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(lateMinutes, 30)
})

test('準時前上班 (08:55) → lateMinutes=0', () => {
  const { lateMinutes } = lateEarlyMinutes({
    punchIn: new Date('2026-05-20T00:55:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(lateMinutes, 0)
})

test('早退 45 分 (17:15 下班) → earlyLeaveMinutes=45', () => {
  const { earlyLeaveMinutes } = lateEarlyMinutes({
    punchOut: new Date('2026-05-20T09:15:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(earlyLeaveMinutes, 45)
})

test('延後下班 (18:30) → earlyLeaveMinutes=0', () => {
  const { earlyLeaveMinutes } = lateEarlyMinutes({
    punchOut: new Date('2026-05-20T10:30:00Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(earlyLeaveMinutes, 0)
})

test('跨日班翌日 05:00 下班 → earlyLeaveMinutes=60', () => {
  const { earlyLeaveMinutes } = lateEarlyMinutes({
    punchOut: new Date('2026-05-20T21:00:00Z'), // 台北 5/21 05:00
    shift: nightShift, workDate: wd, timezone: tz,
  })
  assert.equal(earlyLeaveMinutes, 60)
})

test('無班別 → 分鐘皆 0', () => {
  const r = lateEarlyMinutes({
    punchIn: new Date('2026-05-20T03:00:00Z'),
    punchOut: new Date('2026-05-20T06:00:00Z'),
    shift: null, workDate: wd, timezone: tz,
  })
  assert.deepEqual(r, { lateMinutes: 0, earlyLeaveMinutes: 0 })
})

test('秒數同分鐘內不算遲到 (09:00:59)', () => {
  const { lateMinutes } = lateEarlyMinutes({
    punchIn: new Date('2026-05-20T01:00:59Z'), shift, workDate: wd, timezone: tz,
  })
  assert.equal(lateMinutes, 0)
})
