import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEmployeeCsv } from '../src/lib/employeeImportParser.js'

test('parses employee CSV and normalizes known headers', () => {
  const rows = parseEmployeeCsv('\uFEFF Email ,NAME,empNo,ignored\r\nalice@example.com, Alice ,1001,x')
  assert.deepEqual(rows, [{ email: 'alice@example.com', name: 'Alice', empNo: '1001' }])
})

test('parses quoted commas, escaped quotes, and line breaks', () => {
  const rows = parseEmployeeCsv('email,name\nuser@example.com,"Wang, ""Alex"""')
  assert.deepEqual(rows, [{ email: 'user@example.com', name: 'Wang, "Alex"' }])
})

test('fills missing cells and skips blank lines', () => {
  const rows = parseEmployeeCsv('email,name,role\n\nuser@example.com\n')
  assert.deepEqual(rows, [{ email: 'user@example.com', name: '', role: '' }])
})
