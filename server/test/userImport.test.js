import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateImportRows, IMPORT_MAX_ROWS } from '../src/services/userImport.js'

test('最小合法列：只有 email，無薪資', () => {
  const r = validateImportRows([{ email: 'A@Example.com' }])
  assert.equal(r.summary.validCount, 1)
  assert.equal(r.summary.errorCount, 0)
  assert.deepEqual(r.valid[0], {
    email: 'a@example.com', name: null, empNo: null,
    hireDate: null, salaryProfile: null,
  })
})

test('email 缺漏與格式錯誤', () => {
  const r = validateImportRows([{ email: '' }, { email: 'bad' }])
  assert.equal(r.summary.validCount, 0)
  assert.equal(r.errors.length, 2)
  assert.equal(r.errors[0].row, 1)
  assert.equal(r.errors[1].row, 2)
  assert.equal(r.errors[1].field, 'email')
})

test('empNo 非整數 → 錯誤；數字字串 → 轉整數', () => {
  const bad = validateImportRows([{ email: 'a@b.co', empNo: '1.5' }])
  assert.equal(bad.errors[0].field, 'empNo')
  const ok = validateImportRows([{ email: 'a@b.co', empNo: '1001' }])
  assert.equal(ok.valid[0].empNo, 1001)
})

test('hireDate 須為 YYYY-MM-DD', () => {
  const bad = validateImportRows([{ email: 'a@b.co', hireDate: '2026/01/01' }])
  assert.equal(bad.errors[0].field, 'hireDate')
  const ok = validateImportRows([{ email: 'a@b.co', hireDate: '2026-01-01' }])
  assert.equal(ok.valid[0].hireDate, '2026-01-01')
})

test('檔案內 email / empNo 重複 → 錯誤帶第一次列號', () => {
  const r = validateImportRows([
    { email: 'dup@b.co', empNo: '1' },
    { email: 'dup@b.co', empNo: '1' },
  ])
  assert.equal(r.summary.validCount, 1)
  const dup = r.errors.find((e) => e.field === 'email')
  assert.match(dup.message, /第 1 列/)
})

test('對 DB 既有 email / empNo 衝突', () => {
  const r = validateImportRows(
    [{ email: 'taken@b.co' }, { email: 'new@b.co', empNo: '5' }],
    { existingEmails: new Set(['taken@b.co']), existingEmpNos: new Set([5]) },
  )
  assert.equal(r.summary.validCount, 0)
  assert.equal(r.errors.length, 2)
})

test('薪資：兩欄皆空 → 不建薪資', () => {
  const r = validateImportRows([{ email: 'a@b.co' }])
  assert.equal(r.valid[0].salaryProfile, null)
})

test('薪資：有 baseSalary → 建立並帶 bankAccount，其餘預設', () => {
  const r = validateImportRows([{ email: 'a@b.co', baseSalary: '36000', bankAccount: ' 700-123 ' }])
  assert.equal(r.valid[0].salaryProfile.baseSalary, 36000)
  assert.equal(r.valid[0].salaryProfile.bankAccount, '700-123')
  assert.deepEqual(r.valid[0].salaryProfile.allowances, [])
})

test('薪資：只填 bankAccount 缺 baseSalary → 錯誤', () => {
  const r = validateImportRows([{ email: 'a@b.co', bankAccount: '700-123' }])
  assert.equal(r.summary.validCount, 0)
  assert.equal(r.errors[0].field, 'baseSalary')
})

test('薪資：baseSalary 負數 → 錯誤', () => {
  const r = validateImportRows([{ email: 'a@b.co', baseSalary: '-5' }])
  assert.equal(r.errors[0].field, 'baseSalary')
})

test('IMPORT_MAX_ROWS 為正整數', () => {
  assert.ok(Number.isInteger(IMPORT_MAX_ROWS) && IMPORT_MAX_ROWS > 0)
})
