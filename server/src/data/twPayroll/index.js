import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DIR = dirname(fileURLToPath(import.meta.url))

// 解析單欄數字 CSV（header 在第一列）→ 升冪 number[]
function parseGradeCsv(text, label) {
  const out = []
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const n = Number(line)
    if (!Number.isFinite(n)) throw new Error(`twPayroll ${label} 第 ${i + 1} 列非數字：「${line}」`)
    out.push(n)
  }
  return out.sort((a, b) => a - b)
}

// 解析 key,value CSV → { key: number }
function parseRatesCsv(text) {
  const rates = {}
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const [key, raw] = line.split(',')
    const n = Number(raw)
    if (!key || !Number.isFinite(n)) throw new Error(`twPayroll rates 第 ${i + 1} 列無效：「${line}」`)
    rates[key.trim()] = n
  }
  return rates
}

/**
 * 純解析：四個 CSV 原始字串 → 結構化參照資料。無 FS。
 */
export function parsePayrollCsvs({ labor, health, pension, rates }) {
  return {
    laborInsuranceGrades: parseGradeCsv(labor, 'labor'),
    healthInsuranceGrades: parseGradeCsv(health, 'health'),
    pensionWageGrades: parseGradeCsv(pension, 'pension'),
    rates: parseRatesCsv(rates),
  }
}

let availableYears = null
function listYears() {
  if (availableYears) return availableYears
  availableYears = readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
    .map((d) => Number(d.name))
    .sort((a, b) => a - b)
  return availableYears
}

function resolveYear(year) {
  const y = Number(year)
  const years = listYears()
  let resolved = null
  for (const candidate of years) {
    if (candidate <= y) resolved = candidate
  }
  if (resolved == null) throw new Error(`twPayroll 無 ${y} 年（含以前）的法定參照資料`)
  return resolved
}

const cache = new Map()

/**
 * 取得某年度法定參照資料（含年度回退與快取）。
 */
export function getPayrollReference(year) {
  const resolved = resolveYear(year)
  if (cache.has(resolved)) return cache.get(resolved)
  const dir = join(DIR, String(resolved))
  const read = (name) => readFileSync(join(dir, name), 'utf8')
  const parsed = parsePayrollCsvs({
    labor: read('labor.csv'),
    health: read('health.csv'),
    pension: read('pension.csv'),
    rates: read('rates.csv'),
  })
  const result = { year: resolved, ...parsed }
  cache.set(resolved, result)
  return result
}
