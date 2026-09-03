import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateOvertimeCompliance, sumCountedMinutes,
  MONTHLY_CAP_NORMAL, MONTHLY_CAP_FLEXIBLE, QUARTER_CAP,
} from '../src/services/compliance.js'

const H = 60

// --- sumCountedMinutes：只計入 1.34 / 1.67 / 2.67 ---
test('sumCountedMinutes 只加總延長工時級，排除 holiday / regular_leave', () => {
  const tiers = [
    { rate: '1.34', minutes: 120 },
    { rate: '1.67', minutes: 60 },
    { rate: '2.67', minutes: 30 },
    { rate: 'holiday', minutes: 480 },
    { rate: 'regular_leave', minutes: 240 },
  ]
  assert.equal(sumCountedMinutes(tiers), 210)
})

test('sumCountedMinutes 容錯：非陣列 / 空 → 0', () => {
  assert.equal(sumCountedMinutes(undefined), 0)
  assert.equal(sumCountedMinutes([]), 0)
})

test('月 41h → ok（低於 90% warn 帶）', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: false,
    monthTiers: [{ rate: '1.67', minutes: 41 * H }],
  })
  assert.equal(r.status, 'ok')
  assert.equal(r.reasons.length, 0)
  assert.equal(r.monthlyCap, MONTHLY_CAP_NORMAL)
})

test('月 42h → warn（落在 [90%,100%] 帶）', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: false,
    monthTiers: [{ rate: '1.67', minutes: 42 * H }],
  })
  assert.equal(r.status, 'warn')
  assert.equal(r.reasons[0].code, 'MONTHLY_46')
  assert.equal(r.reasons[0].severity, 'warn')
})

test('月 46h（=cap）→ warn，不算 exceed', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: false,
    monthTiers: [{ rate: '1.67', minutes: 46 * H }],
  })
  assert.equal(r.status, 'warn')
})

test('月 47h → exceed', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: false,
    monthTiers: [{ rate: '1.67', minutes: 47 * H }],
  })
  assert.equal(r.status, 'exceed')
  assert.equal(r.reasons[0].code, 'MONTHLY_46')
  assert.equal(r.reasons[0].severity, 'exceed')
})

test('非變形時 quarterMinutes / quarterCap 為 null、不報 138', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: false,
    monthTiers: [{ rate: '1.67', minutes: 50 * H }],
    quarterTiers: [{ rate: '1.67', minutes: 200 * H }],
  })
  assert.equal(r.quarterMinutes, null)
  assert.equal(r.quarterCap, null)
  assert.ok(!r.reasons.some((x) => x.code === 'QUARTER_138'))
})

test('變形 月 48h → ok（54h 上限，相同時數在 46h 制下會超標）、quarterCap 有值', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: true,
    monthTiers: [{ rate: '1.67', minutes: 48 * H }],
    quarterTiers: [{ rate: '1.67', minutes: 48 * H }],
  })
  assert.equal(r.status, 'ok')
  assert.equal(r.monthlyCap, MONTHLY_CAP_FLEXIBLE)
  assert.equal(r.quarterCap, QUARTER_CAP)
})

test('變形 月 55h → exceed', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: true,
    monthTiers: [{ rate: '1.67', minutes: 55 * H }],
    quarterTiers: [{ rate: '1.67', minutes: 55 * H }],
  })
  assert.equal(r.status, 'exceed')
  assert.ok(r.reasons.some((x) => x.code === 'MONTHLY_54' && x.severity === 'exceed'))
})

test('變形 三月各 50h（=150h）→ QUARTER_138 exceed，即使單月 < 54h', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: true,
    monthTiers: [{ rate: '1.67', minutes: 50 * H }],
    quarterTiers: [{ rate: '1.67', minutes: 150 * H }],
  })
  assert.equal(r.status, 'exceed')
  assert.ok(r.reasons.some((x) => x.code === 'QUARTER_138' && x.severity === 'exceed'))
})

test('變形 季投影：quarterTiers 150h + 候選 2h → 季 152h（候選只計一次）', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: true,
    monthTiers: [{ rate: '1.67', minutes: 50 * H }],
    quarterTiers: [{ rate: '1.67', minutes: 150 * H }],
    candidateMinutes: 2 * H,
  })
  assert.equal(r.quarterMinutes, 152 * H)
  assert.equal(r.status, 'exceed') // 季 152h > 138h
})

test('投影：本月 44h + 候選 3h → exceed（46h 上限）', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: false,
    monthTiers: [{ rate: '1.67', minutes: 44 * H }],
    candidateMinutes: 3 * H,
  })
  assert.equal(r.monthlyProjected, 47 * H)
  assert.equal(r.status, 'exceed')
})

test('dailyOverDates → 每筆一個 DAILY_4H warn', () => {
  const r = evaluateOvertimeCompliance({
    flexibleOvertime: false,
    monthTiers: [{ rate: '1.34', minutes: 60 }],
    dailyOverDates: [{ workDate: '2026-06-02', minutes: 5 * H }],
  })
  assert.ok(r.reasons.some((x) => x.code === 'DAILY_4H' && x.severity === 'warn'))
  assert.equal(r.status, 'warn')
})

test('無加班 → ok、total 0、reasons 空', () => {
  const r = evaluateOvertimeCompliance({ flexibleOvertime: false, monthTiers: [] })
  assert.deepEqual(
    { status: r.status, monthlyMinutes: r.monthlyMinutes, reasons: r.reasons },
    { status: 'ok', monthlyMinutes: 0, reasons: [] },
  )
})
