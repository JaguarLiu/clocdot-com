import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAttendanceDeduction } from '../src/services/attendanceDeduction.js'

const flexible = { standardDailyMinutes: 480, workHourType: 'flexible', lateDeductMode: 'per_minute' }
const fixedMin = { standardDailyMinutes: 480, workHourType: 'fixed', lateDeductMode: 'per_minute' }
const fixedHour = { standardDailyMinutes: 480, workHourType: 'fixed', lateDeductMode: 'per_hour' }
const monthlyWage = 30000 // 日薪 1000，每分鐘 1000/480 ≈ 2.0833
const rates = { personal: 1, sick: 0.5, annual: 0 }

const day = (o) => ({ workDate: '2026-05-20', isWorkday: true, leaves: [], workDuration: null, lateMinutes: 0, earlyLeaveMinutes: 0, ...o })

test('變形：做滿制定工時 → 不扣', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: 480 })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.total, 0)
})

test('變形：工時不足 60 分 → 扣 60/480×1000=125', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: 420 })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.attendanceDeduction, 125)
  assert.equal(r.days[0].reason, 'shortfall')
})

test('變形：遲到但做滿 → 不扣（不看遲到分鐘）', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: 480, lateMinutes: 30 })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.total, 0)
})

test('固定+按分鐘：遲到 30 分 → 30/480×1000=63', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: 450, lateMinutes: 30 })], company: fixedMin, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.attendanceDeduction, 63) // round(30*2.0833)=63
  assert.equal(r.days[0].reason, 'late_early')
})

test('固定+按小時進位：遲到 10 分 → 進位 60 分 → 60/480×1000=125', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: 470, lateMinutes: 10 })], company: fixedHour, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.attendanceDeduction, 125)
})

test('固定+按分鐘：遲到+早退合計 = 兩者相加', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: 400, lateMinutes: 30, earlyLeaveMinutes: 20 })], company: fixedMin, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.attendanceDeduction, Math.round(50 * (1000 / 480)))
})

test('單日封頂：固定遲退分鐘 > 480 → 最多扣一日薪', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: 1, lateMinutes: 600, earlyLeaveMinutes: 0 })], company: fixedMin, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.attendanceDeduction, 1000)
})

test('缺勤（變形）：無打卡無請假 → 扣整日薪', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: null })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.attendanceDeduction, 1000)
  assert.equal(r.days[0].reason, 'absence')
})

test('缺勤（固定）：無打卡無請假 → 走缺勤分支扣整日', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: null })], company: fixedMin, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.attendanceDeduction, 1000)
  assert.equal(r.days[0].reason, 'absence')
})

test('全日特休 (rate 0)：不扣', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: null, leaves: [{ leaveType: 'annual', minutes: 480 }] })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.total, 0)
})

test('全日事假 (rate 1)：請假側扣整日薪、工作側 0', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: null, leaves: [{ leaveType: 'personal', minutes: 480 }] })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.leaveDeduction, 1000)
  assert.equal(r.attendanceDeduction, 0)
})

test('全日病假 (rate 0.5)：請假側扣半日薪', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: null, leaves: [{ leaveType: 'sick', minutes: 480 }] })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.leaveDeduction, 500)
})

test('半日病假 + 另半日正常上班 → 請假側 240×0.5/480×1000=250', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: 240, leaves: [{ leaveType: 'sick', minutes: 240 }] })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.leaveDeduction, 250)
  assert.equal(r.attendanceDeduction, 0) // effectiveExpected=240, worked=240
})

test('半日特休 + 提早走（變形）→ 工作側扣不足、請假側 0', () => {
  // effectiveExpected=240, worked=180 → 缺 60 → 125
  const r = computeAttendanceDeduction({ days: [day({ workDuration: 180, leaves: [{ leaveType: 'annual', minutes: 240 }] })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.attendanceDeduction, 125)
  assert.equal(r.leaveDeduction, 0)
})

test('政策覆寫：病假設 0 → 不扣', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: null, leaves: [{ leaveType: 'sick', minutes: 480 }] })], company: flexible, monthlyWage, leaveDeductRates: { ...rates, sick: 0 } })
  assert.equal(r.total, 0)
})

test('同日多假別加權：半事假+半病假 → (240×1+240×0.5)/480×1000=750', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: null, leaves: [{ leaveType: 'personal', minutes: 240 }, { leaveType: 'sick', minutes: 240 }] })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.leaveDeduction, 750)
})

test('非工作日 (isWorkday=false) 一律跳過', () => {
  const r = computeAttendanceDeduction({ days: [day({ isWorkday: false, workDuration: null })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.total, 0)
})

test('跨多日加總：兩天缺勤 → 2000', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDate: '2026-05-20', workDuration: null }), day({ workDate: '2026-05-21', workDuration: null })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.attendanceDeduction, 2000)
})

test('total = attendanceDeduction + leaveDeduction', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: null, leaves: [{ leaveType: 'sick', minutes: 240 }], lateMinutes: 0 })], company: flexible, monthlyWage, leaveDeductRates: rates })
  assert.equal(r.total, r.attendanceDeduction + r.leaveDeduction)
})

test('monthlyWage 含津貼影響日薪：33000 → 日薪 1100，缺勤扣 1100', () => {
  const r = computeAttendanceDeduction({ days: [day({ workDuration: null })], company: flexible, monthlyWage: 33000, leaveDeductRates: rates })
  assert.equal(r.attendanceDeduction, 1100)
})
