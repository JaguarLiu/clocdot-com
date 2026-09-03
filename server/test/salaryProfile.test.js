import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSalaryProfile } from '../src/services/salaryProfile.js'

test('合法最小輸入：只有 baseSalary，其餘帶預設', () => {
  const r = normalizeSalaryProfile({ baseSalary: 36000 })
  assert.equal(r.ok, true)
  assert.deepEqual(r.value, {
    baseSalary: 36000,
    hourlyRate: null,
    allowances: [],
    laborInsuredSalary: null,
    healthInsuredSalary: null,
    healthDependents: 0,
    pensionVoluntaryRate: 0,
    taxDependents: 0,
    bankAccount: null,
    note: null,
  })
})

test('完整合法輸入：allowances 正規化（trim name、布林強制）', () => {
  const r = normalizeSalaryProfile({
    baseSalary: 40000,
    allowances: [
      { name: '  伙食費 ', amount: 2500, insured: false, taxable: false },
      { name: '職務加給', amount: 5000, insured: 1, taxable: 'yes' },
    ],
    laborInsuredSalary: 42000,
    healthInsuredSalary: 42000,
    healthDependents: 2,
    pensionVoluntaryRate: 0.06,
    taxDependents: 1,
    bankAccount: ' 700-1234567 ',
    note: ' 備註 ',
  })
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.allowances, [
    { name: '伙食費', amount: 2500, insured: false, taxable: false },
    { name: '職務加給', amount: 5000, insured: true, taxable: true },
  ])
  assert.equal(r.value.laborInsuredSalary, 42000)
  assert.equal(r.value.healthDependents, 2)
  assert.equal(r.value.pensionVoluntaryRate, 0.06)
  assert.equal(r.value.bankAccount, '700-1234567')
  assert.equal(r.value.note, '備註')
})

test('baseSalary 缺少 → 失敗', () => {
  const r = normalizeSalaryProfile({})
  assert.equal(r.ok, false)
  assert.match(r.error, /本薪/)
})

test('baseSalary 負數 → 失敗', () => {
  assert.equal(normalizeSalaryProfile({ baseSalary: -1 }).ok, false)
})

test('baseSalary 非整數 → 失敗', () => {
  assert.equal(normalizeSalaryProfile({ baseSalary: 100.5 }).ok, false)
})

test('pensionVoluntaryRate 超過 0.06 → 失敗', () => {
  const r = normalizeSalaryProfile({ baseSalary: 30000, pensionVoluntaryRate: 0.07 })
  assert.equal(r.ok, false)
  assert.match(r.error, /提繳率/)
})

test('pensionVoluntaryRate 負數 → 失敗', () => {
  assert.equal(normalizeSalaryProfile({ baseSalary: 30000, pensionVoluntaryRate: -0.01 }).ok, false)
})

test('allowances 非陣列 → 失敗', () => {
  assert.equal(normalizeSalaryProfile({ baseSalary: 30000, allowances: {} }).ok, false)
})

test('allowance name 空字串 → 失敗', () => {
  const r = normalizeSalaryProfile({
    baseSalary: 30000,
    allowances: [{ name: '   ', amount: 100 }],
  })
  assert.equal(r.ok, false)
  assert.match(r.error, /名稱/)
})

test('allowance amount 負數 → 失敗', () => {
  const r = normalizeSalaryProfile({
    baseSalary: 30000,
    allowances: [{ name: '加給', amount: -5 }],
  })
  assert.equal(r.ok, false)
})

test('laborInsuredSalary 非整數 → 失敗', () => {
  assert.equal(
    normalizeSalaryProfile({ baseSalary: 30000, laborInsuredSalary: 1.5 }).ok,
    false,
  )
})

test('healthDependents 負數 → 失敗', () => {
  assert.equal(
    normalizeSalaryProfile({ baseSalary: 30000, healthDependents: -1 }).ok,
    false,
  )
})

test('空 bankAccount / note 正規化為 null', () => {
  const r = normalizeSalaryProfile({ baseSalary: 30000, bankAccount: '  ', note: '' })
  assert.equal(r.ok, true)
  assert.equal(r.value.bankAccount, null)
  assert.equal(r.value.note, null)
})

test('hourly：時薪必填正整數，0 或缺值擋下', () => {
  assert.equal(normalizeSalaryProfile({ hourlyRate: 0 }, { payType: 'hourly' }).ok, false)
  assert.equal(normalizeSalaryProfile({}, { payType: 'hourly' }).ok, false)
  assert.equal(normalizeSalaryProfile({ hourlyRate: 190.5 }, { payType: 'hourly' }).ok, false)
  const r = normalizeSalaryProfile({ hourlyRate: 190 }, { payType: 'hourly' })
  assert.equal(r.ok, true)
  assert.equal(r.value.hourlyRate, 190)
  assert.equal(r.value.baseSalary, null)
})

test('hourly：allowances 強制空陣列、輸入的 baseSalary 被忽略', () => {
  const r = normalizeSalaryProfile(
    { hourlyRate: 200, baseSalary: 48000, allowances: [{ name: '職務加給', amount: 1000, insured: true, taxable: true }] },
    { payType: 'hourly' },
  )
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.allowances, [])
  assert.equal(r.value.baseSalary, null)
})

test('hourly：共同欄位照常驗證（眷口數負數擋下）', () => {
  const r = normalizeSalaryProfile({ hourlyRate: 200, healthDependents: -1 }, { payType: 'hourly' })
  assert.equal(r.ok, false)
})

test('monthly（回歸）：不帶 options 同現行行為，hourlyRate 輸出 null', () => {
  const r = normalizeSalaryProfile({ baseSalary: 48000 })
  assert.equal(r.ok, true)
  assert.equal(r.value.baseSalary, 48000)
  assert.equal(r.value.hourlyRate, null)
})
