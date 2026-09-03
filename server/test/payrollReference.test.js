import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePayrollCsvs, getPayrollReference } from '../src/data/twPayroll/index.js'
import {
  findGrade, laborInsuredSalary, healthInsuredSalary, pensionWage,
  getRates, incomeTaxWithholding,
} from '../src/services/payrollReference.js'

const LABOR = 'insuredSalary\n27470\n27600\n28800\n'
const HEALTH = 'insuredSalary\n27470\n28800\n30300\n'
const PENSION = 'wage\n1500\n3000\n4500\n'
const RATES = 'key,value\nlaborOrdinaryRate,0.12\nhealthRate,0.0517\nincomeTaxThreshold,88501\nincomeTaxRate,0.05\n'

test('parsePayrollCsvs 解析四表，grade 升冪、rates 轉數字', () => {
  const r = parsePayrollCsvs({ labor: LABOR, health: HEALTH, pension: PENSION, rates: RATES })
  assert.deepEqual(r.laborInsuranceGrades, [27470, 27600, 28800])
  assert.deepEqual(r.healthInsuranceGrades, [27470, 28800, 30300])
  assert.deepEqual(r.pensionWageGrades, [1500, 3000, 4500])
  assert.equal(r.rates.laborOrdinaryRate, 0.12)
  assert.equal(r.rates.incomeTaxThreshold, 88501)
})

test('parsePayrollCsvs 未排序輸入會被排成升冪', () => {
  const r = parsePayrollCsvs({ labor: 'insuredSalary\n28800\n27470\n', health: HEALTH, pension: PENSION, rates: RATES })
  assert.deepEqual(r.laborInsuranceGrades, [27470, 28800])
})

test('parsePayrollCsvs 壞資料（非數字級距）→ throw', () => {
  assert.throws(() => parsePayrollCsvs({ labor: 'insuredSalary\nabc\n', health: HEALTH, pension: PENSION, rates: RATES }))
})

test('parsePayrollCsvs rates 非數字 value → throw', () => {
  assert.throws(() => parsePayrollCsvs({ labor: LABOR, health: HEALTH, pension: PENSION, rates: 'key,value\nlaborOrdinaryRate,foo\n' }))
})

test('getPayrollReference(2026) 回傳實際內建年度資料', () => {
  const r = getPayrollReference(2026)
  assert.equal(r.year, 2026)
  assert.ok(r.laborInsuranceGrades.length > 0)
  assert.ok(Number.isFinite(r.rates.incomeTaxRate))
})

test('getPayrollReference 未來年度 → 回退最近可用年度', () => {
  const r = getPayrollReference(2099)
  assert.equal(r.year, 2026)
})

test('getPayrollReference 早於所有資料且無可用 → throw', () => {
  assert.throws(() => getPayrollReference(2000))
})

const G = [27470, 27600, 28800, 30300]

test('findGrade 剛好等於某級 → 回該級', () => {
  assert.equal(findGrade(G, 28800), 28800)
})

test('findGrade 落在兩級之間 → 進位到較高級', () => {
  assert.equal(findGrade(G, 28000), 28800)
})

test('findGrade 低於最低級 → 回最低級', () => {
  assert.equal(findGrade(G, 10000), 27470)
})

test('findGrade 高於最高級 → 封頂回最高級', () => {
  assert.equal(findGrade(G, 999999), 30300)
})

test('findGrade 空陣列 / 非有限數 → throw', () => {
  assert.throws(() => findGrade([], 30000))
  assert.throws(() => findGrade(G, Number.NaN))
})

test('laborInsuredSalary/healthInsuredSalary/pensionWage：低於最低 → 回各表最低級', () => {
  const ref = getPayrollReference(2026)
  assert.equal(laborInsuredSalary(1, 2026), ref.laborInsuranceGrades[0])
  assert.equal(healthInsuredSalary(1, 2026), ref.healthInsuranceGrades[0])
  assert.equal(pensionWage(1, 2026), ref.pensionWageGrades[0])
})

test('getRates 回傳八個必要 key 且皆為數字', () => {
  const r = getRates(2026)
  for (const k of ['laborOrdinaryRate', 'employmentInsuranceRate', 'laborEmployeeShare',
    'healthRate', 'healthEmployeeShare', 'pensionRate', 'incomeTaxThreshold', 'incomeTaxRate']) {
    assert.ok(Number.isFinite(r[k]), `缺少或非數字：${k}`)
  }
})

test('incomeTaxWithholding：未達起扣標準 → 0；達到 → 5% 四捨五入', () => {
  const { incomeTaxThreshold, incomeTaxRate } = getRates(2026)
  assert.equal(incomeTaxWithholding(incomeTaxThreshold - 1, 2026), 0)
  assert.equal(incomeTaxWithholding(incomeTaxThreshold, 2026), Math.round(incomeTaxThreshold * incomeTaxRate))
  assert.equal(incomeTaxWithholding(incomeTaxThreshold + 10000, 2026),
    Math.round((incomeTaxThreshold + 10000) * incomeTaxRate))
})
