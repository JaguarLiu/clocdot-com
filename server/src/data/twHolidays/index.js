import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DIR = dirname(fileURLToPath(import.meta.url))

// 來源：政府行政機關辦公日曆表 CSV（內含多年度）。
// 欄位：date(YYYYMMDD),year,name,isholiday(是/否),holidaycategory,description
// 只取「公司實務上的國定假日」：放假之紀念日及節日 + 補假 + 勞動節；
// 排除一般週末（星期六、星期日）、軍人節等其他特定節日、補班日。
const SOURCE_CSV = '2026.csv'
const HOLIDAY_CATEGORIES = new Set(['放假之紀念日及節日', '補假'])
const EXTRA_HOLIDAY_NAMES = new Set(['勞動節'])

let byYear = null

function load() {
  if (byYear) return byYear
  byYear = new Map()
  let text
  try {
    text = readFileSync(join(DIR, SOURCE_CSV), 'utf8')
  } catch {
    return byYear // 找不到來源檔 → 視為無假日
  }
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  for (let i = 1; i < lines.length; i++) { // 跳過 header
    const line = lines[i].trim()
    if (!line) continue
    const [rawDate, , name, isHoliday, category] = line.split(',')
    if (isHoliday !== '是') continue
    if (!HOLIDAY_CATEGORIES.has(category) && !EXTRA_HOLIDAY_NAMES.has(name)) continue
    if (!/^\d{8}$/.test(rawDate)) continue
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
    const year = Number(rawDate.slice(0, 4))
    if (!byYear.has(year)) byYear.set(year, [])
    byYear.get(year).push({ date, name: name || category })
  }
  return byYear
}

/**
 * 取得某年度的國定假日陣列（[{date,name}]）。未內建的年度回空陣列。
 */
export function getHolidays(year) {
  return load().get(Number(year)) ?? []
}

/**
 * 取得某年度國定假日的日期 Set（'YYYY-MM-DD'），供快速判定。
 */
export function getHolidayDateSet(year) {
  return new Set(getHolidays(year).map((h) => h.date))
}
