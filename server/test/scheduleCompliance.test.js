import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateScheduleCompliance, dayIndex, indexToDateStr,
  MAX_CONSECUTIVE_WORKDAYS, MIN_REST_HOURS,
} from '../src/services/scheduleCompliance.js'

const DAY = (shift) => shift // 可讀性別名
const SHIFT_9_18 = { startTime: '09:00', endTime: '18:00' }
const SHIFT_NIGHT = { startTime: '21:00', endTime: '09:00' } // 跨夜班：翌日 09:00 下班

// 由 'YYYY-MM-DD' 陣列建 worked map（全部視為變更日，除非另指定）
function schedule(dates, shift = SHIFT_9_18, { changedDates } = {}) {
  const worked = new Map()
  for (const d of dates) worked.set(dayIndex(d), DAY(shift))
  const changed = new Set((changedDates ?? dates).map(dayIndex))
  return { userId: 'u1', userName: '小明', worked, changed }
}

// ── dayIndex / indexToDateStr round-trip ──
test('dayIndex 與 indexToDateStr 互逆', () => {
  assert.equal(indexToDateStr(dayIndex('2026-07-21')), '2026-07-21')
})

// ── 七休一 ──
test('連上 6 天不違規', () => {
  const days = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06']
  assert.equal(days.length, MAX_CONSECUTIVE_WORKDAYS)
  const v = evaluateScheduleCompliance([schedule(days)])
  assert.equal(v.filter((x) => x.type === 'seven_day_rest').length, 0)
})

test('連上 7 天觸發七休一', () => {
  const days = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07']
  const v = evaluateScheduleCompliance([schedule(days)])
  const seven = v.filter((x) => x.type === 'seven_day_rest')
  assert.equal(seven.length, 1)
  assert.equal(seven[0].days, 7)
  assert.equal(seven[0].startDate, '2026-07-01')
  assert.equal(seven[0].endDate, '2026-07-07')
})

test('中間有休息 → 兩段各 ≤6 天不違規', () => {
  // 1-4 工作、5 休、6-9 工作
  const days = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09']
  const v = evaluateScheduleCompliance([schedule(days)])
  assert.equal(v.filter((x) => x.type === 'seven_day_rest').length, 0)
})

test('連上 7 天但無一天是本次變更 → 不回報（不翻舊帳）', () => {
  const days = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07']
  const v = evaluateScheduleCompliance([schedule(days, SHIFT_9_18, { changedDates: [] })])
  assert.equal(v.length, 0)
})

// ── 輪班間隔 ──
test('一般日班 09-18 接隔天 09-18，間隔 15h，不違規', () => {
  const v = evaluateScheduleCompliance([schedule(['2026-07-01', '2026-07-02'])])
  assert.equal(v.filter((x) => x.type === 'shift_interval').length, 0)
})

test('大夜 21-09 接隔天 09-18 → 間隔 0h 觸發', () => {
  const worked = new Map([
    [dayIndex('2026-07-01'), SHIFT_NIGHT],   // 7/2 09:00 下班
    [dayIndex('2026-07-02'), SHIFT_9_18],    // 7/2 09:00 上班
  ])
  const v = evaluateScheduleCompliance([{ userId: 'u1', userName: '小明', worked, changed: new Set([dayIndex('2026-07-02')]) }])
  const iv = v.filter((x) => x.type === 'shift_interval')
  assert.equal(iv.length, 1)
  assert.equal(iv[0].restHours, 0)
  assert.equal(iv[0].prevDate, '2026-07-01')
  assert.equal(iv[0].date, '2026-07-02')
})

test('剛好 11 小時不違規（早 18:00 下班、隔天 05:00 上班）', () => {
  const worked = new Map([
    [dayIndex('2026-07-01'), { startTime: '09:00', endTime: '18:00' }],
    [dayIndex('2026-07-02'), { startTime: '05:00', endTime: '14:00' }],
  ])
  const v = evaluateScheduleCompliance([{ userId: 'u1', userName: '小明', worked, changed: new Set([dayIndex('2026-07-02')]) }])
  assert.equal(v.filter((x) => x.type === 'shift_interval').length, 0)
})

test('間隔 10.5 小時觸發（18:00 下班、隔天 04:30 上班）', () => {
  const worked = new Map([
    [dayIndex('2026-07-01'), { startTime: '09:00', endTime: '18:00' }],
    [dayIndex('2026-07-02'), { startTime: '04:30', endTime: '13:00' }],
  ])
  const v = evaluateScheduleCompliance([{ userId: 'u1', userName: '小明', worked, changed: new Set([dayIndex('2026-07-01')]) }])
  const iv = v.filter((x) => x.type === 'shift_interval')
  assert.equal(iv.length, 1)
  assert.equal(iv[0].restHours, 10.5)
})

test('非相鄰日（中間空一天）不檢查間隔', () => {
  const worked = new Map([
    [dayIndex('2026-07-01'), SHIFT_NIGHT],
    [dayIndex('2026-07-03'), SHIFT_9_18],
  ])
  const v = evaluateScheduleCompliance([{ userId: 'u1', userName: '小明', worked, changed: new Set([dayIndex('2026-07-03')]) }])
  assert.equal(v.filter((x) => x.type === 'shift_interval').length, 0)
})

test('間隔違規但該對皆非變更日 → 不回報', () => {
  const worked = new Map([
    [dayIndex('2026-07-01'), SHIFT_NIGHT],
    [dayIndex('2026-07-02'), SHIFT_9_18],
  ])
  const v = evaluateScheduleCompliance([{ userId: 'u1', userName: '小明', worked, changed: new Set() }])
  assert.equal(v.length, 0)
})

// ── 多員工 ──
test('多員工各自獨立計算', () => {
  const days = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07']
  const a = { ...schedule(days), userId: 'a', userName: 'A' }
  const b = { ...schedule(['2026-07-01']), userId: 'b', userName: 'B' }
  const v = evaluateScheduleCompliance([a, b])
  assert.equal(v.length, 1)
  assert.equal(v[0].userId, 'a')
})

test('MIN_REST_HOURS 常數為 11', () => {
  assert.equal(MIN_REST_HOURS, 11)
})
