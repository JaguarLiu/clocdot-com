import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePayslip, computeHourlyPayslip } from '../src/services/payroll.js'
import {
  laborInsuredSalary as deriveLabor,
  healthInsuredSalary as deriveHealth,
  pensionWage,
  getRates,
  incomeTaxWithholding,
} from '../src/services/payrollReference.js'

const YEAR = 2026

function profile(over = {}) {
  return {
    baseSalary: 48000,
    allowances: [],
    laborInsuredSalary: 45800,
    healthInsuredSalary: 45800,
    healthDependents: 0,
    pensionVoluntaryRate: 0,
    ...over,
  }
}
function row(overtimeByRate = {}) {
  return { userId: 'u1', empNo: 101, name: '小明', overtimeByRate }
}

test('數值 tier 倍率與 240 基數：1.67 一小時', () => {
  const p = computePayslip({ settlementRow: row({ '1.67': 60 }), salaryProfile: profile(), month: '2026-06', year: YEAR })
  assert.equal(p.meta.overtimeHourly, 200)
  assert.equal(p.earnings.overtime.tiers[0].amount, 334)
  assert.equal(p.earnings.overtime.total, 334)
})

test('holiday / regular_leave tier 倍率 = 1.0', () => {
  const p = computePayslip({ settlementRow: row({ holiday: 120, regular_leave: 60 }), salaryProfile: profile(), month: '2026-06', year: YEAR })
  const byRate = Object.fromEntries(p.earnings.overtime.tiers.map((t) => [t.rate, t]))
  assert.equal(byRate.holiday.multiplier, 1.0)
  assert.equal(byRate.holiday.amount, Math.round((120 / 60) * 200 * 1.0))
  assert.equal(byRate.regular_leave.amount, Math.round((60 / 60) * 200 * 1.0))
})

test('insured 加給計入加班時薪，非 insured 不計入', () => {
  const p = computePayslip({
    settlementRow: row({ '1.34': 60 }),
    salaryProfile: profile({ allowances: [
      { name: '職務加給', amount: 12000, insured: true, taxable: true },
      { name: '伙食費', amount: 2400, insured: false, taxable: false },
    ] }),
    month: '2026-06', year: YEAR,
  })
  assert.equal(p.meta.overtimeHourly, 250)
  assert.equal(p.earnings.overtime.tiers[0].amount, Math.round(1 * 250 * 1.34))
})

test('未知 rate key → throw', () => {
  assert.throws(() => computePayslip({ settlementRow: row({ foo: 60 }), salaryProfile: profile(), month: '2026-06', year: YEAR }))
})

test('A 手動投保薪資優先，insuredSalaryAutoDerived=false', () => {
  const p = computePayslip({ settlementRow: row(), salaryProfile: profile({ laborInsuredSalary: 45800, healthInsuredSalary: 45800 }), month: '2026-06', year: YEAR })
  assert.equal(p.meta.laborInsuredSalary, 45800)
  assert.equal(p.meta.healthInsuredSalary, 45800)
  assert.equal(p.meta.insuredSalaryAutoDerived, false)
})

test('投保薪資為 null → 由 B 自動帶級距，insuredSalaryAutoDerived=true', () => {
  const p = computePayslip({
    settlementRow: row(),
    salaryProfile: profile({ laborInsuredSalary: null, healthInsuredSalary: null, allowances: [{ name: '加給', amount: 12000, insured: true, taxable: true }] }),
    month: '2026-06', year: YEAR,
  })
  const wage = 48000 + 12000
  assert.equal(p.meta.laborInsuredSalary, deriveLabor(wage, YEAR))
  assert.equal(p.meta.healthInsuredSalary, deriveHealth(wage, YEAR))
  assert.equal(p.meta.insuredSalaryAutoDerived, true)
})

test('勞保自付公式', () => {
  const r = getRates(YEAR)
  const p = computePayslip({ settlementRow: row(), salaryProfile: profile({ laborInsuredSalary: 45800 }), month: '2026-06', year: YEAR })
  assert.equal(p.deductions.laborInsurance, Math.round(45800 * (r.laborOrdinaryRate + r.employmentInsuranceRate) * r.laborEmployeeShare))
})

test('健保自付公式 + 眷口 0', () => {
  const r = getRates(YEAR)
  const p = computePayslip({ settlementRow: row(), salaryProfile: profile({ healthInsuredSalary: 45800, healthDependents: 0 }), month: '2026-06', year: YEAR })
  assert.equal(p.deductions.healthInsurance, Math.round(45800 * r.healthRate * r.healthEmployeeShare * (1 + 0)))
})

test('健保眷口 >3 封頂為 1+3', () => {
  const r = getRates(YEAR)
  const p = computePayslip({ settlementRow: row(), salaryProfile: profile({ healthInsuredSalary: 45800, healthDependents: 5 }), month: '2026-06', year: YEAR })
  assert.equal(p.deductions.healthInsurance, Math.round(45800 * r.healthRate * r.healthEmployeeShare * (1 + 3)))
})

test('勞退自願提繳：pensionWage × 自提率', () => {
  const p = computePayslip({ settlementRow: row(), salaryProfile: profile({ pensionVoluntaryRate: 0.06 }), month: '2026-06', year: YEAR })
  assert.equal(p.deductions.pensionVoluntary, Math.round(pensionWage(48000, YEAR) * 0.06))
  assert.equal(p.meta.pensionWage, pensionWage(48000, YEAR))
})

test('pensionVoluntaryRate 為字串/Decimal 也能算（Number 轉換）', () => {
  const p = computePayslip({ settlementRow: row(), salaryProfile: profile({ pensionVoluntaryRate: '0.06' }), month: '2026-06', year: YEAR })
  assert.equal(p.deductions.pensionVoluntary, Math.round(pensionWage(48000, YEAR) * 0.06))
})

test('未達起扣標準 → 所得稅 0', () => {
  const p = computePayslip({ settlementRow: row(), salaryProfile: profile({ baseSalary: 40000 }), month: '2026-06', year: YEAR })
  assert.equal(p.deductions.incomeTax, 0)
})

test('達起扣標準 → 5% 四捨五入；taxableTotal = 本薪 + taxable 加給 + 加班', () => {
  const r = getRates(YEAR)
  const base = r.incomeTaxThreshold + 5000
  const p = computePayslip({ settlementRow: row(), salaryProfile: profile({ baseSalary: base }), month: '2026-06', year: YEAR })
  assert.equal(p.meta.taxableTotal, base)
  assert.equal(p.deductions.incomeTax, Math.round(base * r.incomeTaxRate))
})

test('taxableTotal 排除非 taxable 加給、含加班', () => {
  const p = computePayslip({
    settlementRow: row({ '1.67': 60 }),
    salaryProfile: profile({ baseSalary: 48000, allowances: [
      { name: '職務加給', amount: 5000, insured: true, taxable: true },
      { name: '伙食費', amount: 2400, insured: false, taxable: false },
    ] }),
    month: '2026-06', year: YEAR,
  })
  assert.equal(p.meta.taxableTotal, 48000 + 5000 + p.earnings.overtime.total)
})

test('grossPay 與 netPay 加總正確', () => {
  const p = computePayslip({
    settlementRow: row({ '1.67': 120 }),
    salaryProfile: profile({ baseSalary: 48000, allowances: [{ name: '加給', amount: 5000, insured: true, taxable: true }] }),
    month: '2026-06', year: YEAR,
  })
  assert.equal(p.earnings.grossPay, 48000 + 5000 + p.earnings.overtime.total)
  const d = p.deductions
  assert.equal(d.total, d.laborInsurance + d.healthInsurance + d.pensionVoluntary + d.incomeTax)
  assert.equal(p.netPay, p.earnings.grossPay - d.total)
})

test('salaryProfile null → throw', () => {
  assert.throws(() => computePayslip({ settlementRow: row(), salaryProfile: null, month: '2026-06', year: YEAR }))
})

test('baseSalary 非數 → throw', () => {
  assert.throws(() => computePayslip({ settlementRow: row(), salaryProfile: profile({ baseSalary: undefined }), month: '2026-06', year: YEAR }))
})

test('輸出帶入 userId/empNo/name/month/year', () => {
  const p = computePayslip({ settlementRow: row(), salaryProfile: profile(), month: '2026-06', year: YEAR })
  assert.equal(p.userId, 'u1')
  assert.equal(p.empNo, 101)
  assert.equal(p.name, '小明')
  assert.equal(p.month, '2026-06')
  assert.equal(p.year, YEAR)
})

test('遲到扣款併入 deductions 且不影響稅與投保', () => {
  const company = { standardDailyMinutes: 480, workHourType: 'fixed', lateDeductMode: 'per_minute' }
  const settlementRow = {
    userId: 'u1', empNo: 1, name: '小明', overtimeByRate: {},
    attendanceDays: [
      { workDate: '2026-05-20', isWorkday: true, leaves: [], workDuration: 450, lateMinutes: 30, earlyLeaveMinutes: 0 },
    ],
  }
  const salaryProfile = { baseSalary: 30000, allowances: [] }
  const slip = computePayslip({ settlementRow, salaryProfile, company, leaveDeductRates: { personal: 1, sick: 0.5 }, month: '2026-05', year: YEAR })
  assert.equal(slip.deductions.attendanceDeduction, Math.round(30 * (1000 / 480)))
  assert.equal(slip.deductions.leaveDeduction, 0)
  assert.equal(
    slip.deductions.total,
    slip.deductions.laborInsurance + slip.deductions.healthInsurance + slip.deductions.pensionVoluntary + slip.deductions.incomeTax + slip.deductions.attendanceDeduction + slip.deductions.leaveDeduction,
  )
  // 應稅總額不因扣款改變（= baseSalary，因無加班無應稅津貼）
  assert.equal(slip.meta.taxableTotal, 30000)
})

test('無 attendanceDays 時扣款為 0（向後相容）', () => {
  const company = { standardDailyMinutes: 480, workHourType: 'flexible', lateDeductMode: 'per_minute' }
  const settlementRow = { userId: 'u1', empNo: 1, name: '小明', overtimeByRate: {} }
  const slip = computePayslip({ settlementRow, salaryProfile: { baseSalary: 30000, allowances: [] }, company, leaveDeductRates: {}, month: '2026-05', year: YEAR })
  assert.equal(slip.deductions.attendanceDeduction, 0)
  assert.equal(slip.deductions.leaveDeduction, 0)
})

test('整月零出勤且無請假 → 不計薪(實發 0)', () => {
  const company = { standardDailyMinutes: 480, workHourType: 'flexible', lateDeductMode: 'per_minute' }
  const attendanceDays = ['2026-06-01', '2026-06-02', '2026-06-03'].map((d) => ({
    workDate: d, isWorkday: true, leaves: [], workDuration: null, lateMinutes: 0, earlyLeaveMinutes: 0,
  }))
  const settlementRow = { userId: 'u1', empNo: 1, name: '王小明', overtimeByRate: {}, actualMinutes: 0, leaveMinutes: 0, attendanceDays }
  const slip = computePayslip({ settlementRow, salaryProfile: { baseSalary: 36000, allowances: [] }, company, leaveDeductRates: {}, month: '2026-06', year: YEAR })
  assert.equal(slip.earnings.grossPay, 0)
  assert.equal(slip.deductions.total, 0)
  assert.equal(slip.netPay, 0)
  assert.equal(slip.meta.unpaidAbsentMonth, true)
})

test('有出勤幾天(零星缺勤)→ 維持正常計算,不觸發不計薪', () => {
  const company = { standardDailyMinutes: 480, workHourType: 'flexible', lateDeductMode: 'per_minute' }
  const attendanceDays = [
    { workDate: '2026-06-01', isWorkday: true, leaves: [], workDuration: 480, lateMinutes: 0, earlyLeaveMinutes: 0 },
    { workDate: '2026-06-02', isWorkday: true, leaves: [], workDuration: null, lateMinutes: 0, earlyLeaveMinutes: 0 },
  ]
  const settlementRow = { userId: 'u1', empNo: 1, name: '王小明', overtimeByRate: {}, actualMinutes: 480, leaveMinutes: 0, attendanceDays }
  const slip = computePayslip({ settlementRow, salaryProfile: { baseSalary: 36000, allowances: [] }, company, leaveDeductRates: {}, month: '2026-06', year: YEAR })
  assert.equal(slip.earnings.grossPay, 36000)
  assert.ok(slip.deductions.attendanceDeduction > 0)
  assert.notEqual(slip.meta.unpaidAbsentMonth, true)
})

test('特休換薪：併入 grossPay 與 taxableTotal、課稅、不動投保', () => {
  const base = computePayslip({ settlementRow: row(), salaryProfile: profile(), month: '2026-06', year: YEAR })
  const withCashout = computePayslip({
    settlementRow: row(), salaryProfile: profile(),
    cashout: { minutes: 5 * 480, days: 5, amount: 8000 },
    month: '2026-06', year: YEAR,
  })
  // earning 出現
  assert.deepEqual(withCashout.earnings.leaveCashout, { days: 5, minutes: 2400, amount: 8000 })
  // gross 增加 8000
  assert.equal(withCashout.earnings.grossPay, base.earnings.grossPay + 8000)
  // 課稅基數增加 8000
  assert.equal(withCashout.meta.taxableTotal, base.meta.taxableTotal + 8000)
  // 投保自付不變
  assert.equal(withCashout.deductions.laborInsurance, base.deductions.laborInsurance)
  assert.equal(withCashout.deductions.healthInsurance, base.deductions.healthInsurance)
  assert.equal(withCashout.deductions.pensionVoluntary, base.deductions.pensionVoluntary)
})

test('無換薪：leaveCashout 為 null', () => {
  const p = computePayslip({ settlementRow: row(), salaryProfile: profile(), month: '2026-06', year: YEAR })
  assert.equal(p.earnings.leaveCashout, null)
})

test('整月零出勤但有換薪：仍發放並課稅', () => {
  const r = { userId: 'u1', empNo: 101, name: '小明', overtimeByRate: {}, actualMinutes: 0, leaveMinutes: 0, attendanceDays: [{ workDate: '2026-06-02' }] }
  const p = computePayslip({
    settlementRow: r, salaryProfile: profile(), company: { latePenaltyMode: 'none' },
    cashout: { minutes: 480, days: 1, amount: 1600 },
    month: '2026-06', year: YEAR,
  })
  assert.equal(p.meta.unpaidAbsentMonth, true)
  assert.equal(p.earnings.grossPay, 1600)
  assert.deepEqual(p.earnings.leaveCashout, { days: 1, minutes: 480, amount: 1600 })
  assert.ok(p.deductions.incomeTax >= 0)
  assert.equal(p.netPay, 1600 - p.deductions.incomeTax)
})

// ── PT 時薪制 computeHourlyPayslip ──────────────────────────────────────────

function hProfile(over = {}) {
  return {
    hourlyRate: 200,
    baseSalary: null,
    allowances: [],
    laborInsuredSalary: null,
    healthInsuredSalary: null,
    healthDependents: 0,
    pensionVoluntaryRate: 0,
    ...over,
  }
}
function hRow(over = {}) {
  return { userId: 'u1', empNo: 201, name: '小兼', actualMinutes: 0, overtimeByRate: {}, ...over }
}

test('hourly：一般月（無加班）= round(分鐘/60 × 時薪)', () => {
  const p = computeHourlyPayslip({ settlementRow: hRow({ actualMinutes: 4950 }), salaryProfile: hProfile(), month: '2026-06', year: YEAR })
  assert.equal(p.meta.payType, 'hourly')
  assert.equal(p.earnings.hourlyRate, 200)
  assert.equal(p.earnings.regularMinutes, 4950)
  assert.equal(p.earnings.regularPay, 16500) // 82.5h × 200
  assert.equal(p.earnings.grossPay, 16500)
})

test('hourly：加班分鐘從一般分鐘扣除，數值倍率照算不重複計', () => {
  const p = computeHourlyPayslip({
    settlementRow: hRow({ actualMinutes: 600, overtimeByRate: { '1.34': 60 } }),
    salaryProfile: hProfile(), month: '2026-06', year: YEAR,
  })
  assert.equal(p.earnings.regularMinutes, 540)
  assert.equal(p.earnings.regularPay, 1800) // 9h × 200
  assert.equal(p.earnings.overtime.tiers[0].amount, 268) // 1h × 200 × 1.34
  assert.equal(p.earnings.grossPay, 2068)
})

test('hourly：holiday / regular_leave 倍率 = 2.0', () => {
  const p = computeHourlyPayslip({
    settlementRow: hRow({ actualMinutes: 180, overtimeByRate: { holiday: 120, regular_leave: 60 } }),
    salaryProfile: hProfile(), month: '2026-06', year: YEAR,
  })
  const byRate = Object.fromEntries(p.earnings.overtime.tiers.map((t) => [t.rate, t]))
  assert.equal(byRate.holiday.multiplier, 2.0)
  assert.equal(byRate.holiday.amount, 800) // 2h × 200 × 2
  assert.equal(byRate.regular_leave.amount, 400)
  assert.equal(p.earnings.regularMinutes, 0) // 180 − 180
})

test('hourly：核准加班分鐘 > 打卡分鐘 → regularMinutes clamp 0', () => {
  const p = computeHourlyPayslip({
    settlementRow: hRow({ actualMinutes: 30, overtimeByRate: { '1.34': 60 } }),
    salaryProfile: hProfile(), month: '2026-06', year: YEAR,
  })
  assert.equal(p.earnings.regularMinutes, 0)
  assert.equal(p.earnings.grossPay, p.earnings.overtime.total)
})

test('hourly：未知 rate → throw', () => {
  assert.throws(() => computeHourlyPayslip({
    settlementRow: hRow({ actualMinutes: 60, overtimeByRate: { foo: 60 } }),
    salaryProfile: hProfile(), month: '2026-06', year: YEAR,
  }))
})

test('hourly：零工時月 → 全 0 + unpaidAbsentMonth，不扣勞健保', () => {
  const p = computeHourlyPayslip({ settlementRow: hRow(), salaryProfile: hProfile(), month: '2026-06', year: YEAR })
  assert.equal(p.earnings.grossPay, 0)
  assert.equal(p.deductions.total, 0)
  assert.equal(p.netPay, 0)
  assert.equal(p.meta.unpaidAbsentMonth, true)
})

test('hourly：投保薪資未填 → 以當月毛額自動帶級距', () => {
  const p = computeHourlyPayslip({ settlementRow: hRow({ actualMinutes: 4950 }), salaryProfile: hProfile(), month: '2026-06', year: YEAR })
  const gross = 16500
  const rates = getRates(YEAR)
  const laborBase = deriveLabor(gross, YEAR)
  const healthBase = deriveHealth(gross, YEAR)
  assert.equal(p.meta.laborInsuredSalary, laborBase)
  assert.equal(p.meta.insuredSalaryAutoDerived, true)
  assert.equal(p.deductions.laborInsurance,
    Math.round(laborBase * (rates.laborOrdinaryRate + rates.employmentInsuranceRate) * rates.laborEmployeeShare))
  assert.equal(p.deductions.healthInsurance,
    Math.round(healthBase * rates.healthRate * rates.healthEmployeeShare))
  assert.equal(p.deductions.incomeTax, incomeTaxWithholding(gross, YEAR))
  assert.equal(p.netPay, gross - p.deductions.total)
})

test('hourly：手填投保薪資 override 優先，autoDerived=false', () => {
  const p = computeHourlyPayslip({
    settlementRow: hRow({ actualMinutes: 4950 }),
    salaryProfile: hProfile({ laborInsuredSalary: 27470, healthInsuredSalary: 27470 }),
    month: '2026-06', year: YEAR,
  })
  assert.equal(p.meta.laborInsuredSalary, 27470)
  assert.equal(p.meta.healthInsuredSalary, 27470)
  assert.equal(p.meta.insuredSalaryAutoDerived, false)
})

test('hourly：眷口數與勞退自提率', () => {
  const p = computeHourlyPayslip({
    settlementRow: hRow({ actualMinutes: 4950 }),
    salaryProfile: hProfile({ healthDependents: 2, pensionVoluntaryRate: 0.06 }),
    month: '2026-06', year: YEAR,
  })
  const rates = getRates(YEAR)
  const healthBase = deriveHealth(16500, YEAR)
  assert.equal(p.deductions.healthInsurance,
    Math.round(healthBase * rates.healthRate * rates.healthEmployeeShare * 3)) // 1 + 2 眷口
  assert.equal(p.deductions.pensionVoluntary, Math.round(pensionWage(16500, YEAR) * 0.06))
})

test('hourly：deductions 保留 attendanceDeduction/leaveDeduction = 0', () => {
  const p = computeHourlyPayslip({ settlementRow: hRow({ actualMinutes: 4950 }), salaryProfile: hProfile(), month: '2026-06', year: YEAR })
  assert.equal(p.deductions.attendanceDeduction, 0)
  assert.equal(p.deductions.leaveDeduction, 0)
})

test('monthly：meta.payType = monthly（含零出勤路徑）', () => {
  const normal = computePayslip({ settlementRow: row(), salaryProfile: profile(), month: '2026-06', year: YEAR })
  assert.equal(normal.meta.payType, 'monthly')
  const absent = computePayslip({
    settlementRow: { ...row(), actualMinutes: 0, leaveMinutes: 0, attendanceDays: [{ workDate: '2026-06-01', isWorkday: true, leaves: [], workDuration: null, lateMinutes: 0, earlyLeaveMinutes: 0 }] },
    salaryProfile: profile(), month: '2026-06', year: YEAR,
  })
  assert.equal(absent.meta.payType, 'monthly')
})
