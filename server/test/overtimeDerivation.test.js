import { test } from 'node:test'
import assert from 'node:assert/strict'
import { derivePendingOvertime } from '../src/services/overtimeDerivation.js'

const company = {
  standardDailyMinutes: 480,
  workdayWeekdays: [1, 2, 3, 4, 5],
  restDayWeekdays: [6],
  regularLeaveWeekdays: [7],
}
const holidays = new Set()

// 工作日(週三 2026-05-20) 工時 600 = 超時 120
const records = [
  { workDate: '2026-05-20', workDuration: 600 }, // 平日超時 2h
  { workDate: '2026-05-21', workDuration: 480 }, // 平日剛好 8h → 無加班
  { workDate: '2026-05-23', workDuration: 180 }, // 週六休息日 3h → 全加班
]

test('推導出有加班的日子，剔除無加班與已送出的日子', () => {
  const existing = new Set(['2026-05-23']) // 23 已送出 → 排除
  const result = derivePendingOvertime({ records, company, holidays, exceptions: {}, existingDates: existing })
  assert.equal(result.length, 1)
  assert.equal(result[0].workDate, '2026-05-20')
  assert.equal(result[0].dayType, 'workday')
  assert.equal(result[0].derivedMinutes, 120)
  assert.deepEqual(result[0].tiers, [{ rate: '1.34', minutes: 120 }])
})

test('無 existingDates 時全部有加班的日子都列出', () => {
  const result = derivePendingOvertime({ records, company, holidays, exceptions: {}, existingDates: new Set() })
  assert.deepEqual(result.map((r) => r.workDate), ['2026-05-20', '2026-05-23'])
})

test('未完成打卡 (workDuration 為 null) 跳過', () => {
  const recs = [{ workDate: '2026-05-20', workDuration: null }]
  const result = derivePendingOvertime({ records: recs, company, holidays, exceptions: {}, existingDates: new Set() })
  assert.deepEqual(result, [])
})
