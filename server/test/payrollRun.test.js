import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPayrollItems, applyAdjustments, validateAdjustments } from '../src/services/payrollRun.js'

const YEAR = 2026
function profile(over = {}) {
  return { baseSalary: 48000, allowances: [], laborInsuredSalary: 45800, healthInsuredSalary: 45800, healthDependents: 0, pensionVoluntaryRate: 0, ...over }
}
function srow(userId, over = {}) {
  return { userId, empNo: 101, name: '小明', overtimeByRate: {}, ...over }
}

test('buildPayrollItems：有主檔進 items（payslip 為計算結果），無主檔進 skipped', () => {
  const rows = [srow('u1'), srow('u2', { empNo: 102, name: '小華' })]
  const { items, skipped } = buildPayrollItems({
    settlementRows: rows,
    salaryProfilesByUserId: { u1: profile() },
    month: '2026-06', year: YEAR,
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].userId, 'u1')
  assert.equal(typeof items[0].payslip.netPay, 'number')
  assert.equal(items[0].payslip.earnings.grossPay, 48000)
  assert.deepEqual(skipped, [{ userId: 'u2', empNo: 102, name: '小華' }])
})

test('buildPayrollItems：全員無主檔 → items 空、skipped 全列', () => {
  const { items, skipped } = buildPayrollItems({
    settlementRows: [srow('u1'), srow('u2')],
    salaryProfilesByUserId: {},
    month: '2026-06', year: YEAR,
  })
  assert.equal(items.length, 0)
  assert.equal(skipped.length, 2)
})

test('applyAdjustments：正負混合加總，net = payslip.netPay + 合計', () => {
  const payslip = { netPay: 40000 }
  const r = applyAdjustments(payslip, [{ label: '績效獎金', amount: 5000 }, { label: '無薪假', amount: -2000 }])
  assert.equal(r.adjustmentsTotal, 3000)
  assert.equal(r.netPay, 43000)
})

test('applyAdjustments：空陣列 → 0、net 不變', () => {
  const r = applyAdjustments({ netPay: 40000 }, [])
  assert.equal(r.adjustmentsTotal, 0)
  assert.equal(r.netPay, 40000)
})

test('validateAdjustments：合法（含負 amount）→ ok 並 trim label', () => {
  const r = validateAdjustments([{ label: ' 補發 ', amount: 1000 }, { label: '扣款', amount: -500 }])
  assert.equal(r.ok, true)
  assert.deepEqual(r.value, [{ label: '補發', amount: 1000 }, { label: '扣款', amount: -500 }])
})

test('validateAdjustments：非陣列 → 失敗', () => {
  assert.equal(validateAdjustments({}).ok, false)
})

test('validateAdjustments：label 空 → 失敗', () => {
  const r = validateAdjustments([{ label: '  ', amount: 100 }])
  assert.equal(r.ok, false)
  assert.match(r.error, /說明/)
})

test('validateAdjustments：amount 非整數 → 失敗', () => {
  assert.equal(validateAdjustments([{ label: 'x', amount: 1.5 }]).ok, false)
})

test('buildPayrollItems：cashoutByUserId 傳入會出現在 payslip.earnings.leaveCashout', () => {
  const { items } = buildPayrollItems({
    settlementRows: [srow('u1')],
    salaryProfilesByUserId: { u1: profile() },
    cashoutByUserId: { u1: { minutes: 480, days: 1, amount: 1600 } },
    month: '2026-06', year: YEAR,
  })
  assert.deepEqual(items[0].payslip.earnings.leaveCashout, { days: 1, minutes: 480, amount: 1600 })
  assert.equal(items[0].payslip.earnings.grossPay, 48000 + 1600)
})

test('buildPayrollItems：無 cashout 對應 → leaveCashout 為 null', () => {
  const { items } = buildPayrollItems({
    settlementRows: [srow('u1')],
    salaryProfilesByUserId: { u1: profile() },
    cashoutByUserId: {},
    month: '2026-06', year: YEAR,
  })
  assert.equal(items[0].payslip.earnings.leaveCashout, null)
})

// ── PT 時薪制分流 ────────────────────────────────────────────────────────────

function hourlyProfile(over = {}) {
  return { baseSalary: null, hourlyRate: 200, allowances: [], laborInsuredSalary: null, healthInsuredSalary: null, healthDependents: 0, pensionVoluntaryRate: 0, ...over }
}

test('buildPayrollItems：parttime 走時薪引擎（meta.payType=hourly）', () => {
  const rows = [srow('u1', { employmentType: 'parttime', actualMinutes: 600 })]
  const { items, skipped } = buildPayrollItems({
    settlementRows: rows,
    salaryProfilesByUserId: { u1: hourlyProfile() },
    month: '2026-06', year: YEAR,
  })
  assert.equal(skipped.length, 0)
  assert.equal(items[0].payslip.meta.payType, 'hourly')
  assert.equal(items[0].payslip.earnings.grossPay, 2000) // 10h × 200
})

test('buildPayrollItems：parttime 有主檔但 hourlyRate null → skipped', () => {
  const rows = [srow('u1', { employmentType: 'parttime', actualMinutes: 600 })]
  const { items, skipped } = buildPayrollItems({
    settlementRows: rows,
    salaryProfilesByUserId: { u1: profile() }, // 月薪主檔，hourlyRate 缺
    month: '2026-06', year: YEAR,
  })
  assert.equal(items.length, 0)
  assert.deepEqual(skipped, [{ userId: 'u1', empNo: 101, name: '小明' }])
})

test('buildPayrollItems：月薪身分但 baseSalary null（PT 舊檔）→ skipped', () => {
  const rows = [srow('u1')]
  const { items, skipped } = buildPayrollItems({
    settlementRows: rows,
    salaryProfilesByUserId: { u1: hourlyProfile() },
    month: '2026-06', year: YEAR,
  })
  assert.equal(items.length, 0)
  assert.equal(skipped.length, 1)
})

test('buildPayrollItems：parttime 忽略 cashout', () => {
  const rows = [srow('u1', { employmentType: 'parttime', actualMinutes: 600 })]
  const { items } = buildPayrollItems({
    settlementRows: rows,
    salaryProfilesByUserId: { u1: hourlyProfile() },
    cashoutByUserId: { u1: { minutes: 480, days: 1, amount: 1600 } },
    month: '2026-06', year: YEAR,
  })
  assert.equal(items[0].payslip.earnings.leaveCashout, undefined)
  assert.equal(items[0].payslip.earnings.grossPay, 2000)
})
