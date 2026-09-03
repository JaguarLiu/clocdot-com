import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DIR = dirname(fileURLToPath(import.meta.url))

// 來源：行政院人事行政總處「政府行政機關辦公日曆表」開放資料 CSV。
// 更新方式與官方出處見同目錄 README.md；新增年度只要放入 <year>.csv 即可，
// 不需要改這支程式（本目錄下所有 <四位數年份>.csv 都會被讀取並依日期分年）。
// 欄位：date(YYYYMMDD),year,name,isholiday(是/否),holidaycategory,description
// 只取「公司實務上的國定假日」：放假之紀念日及節日 + 補假 + 勞動節；
// 排除一般週末（星期六、星期日）、軍人節等其他特定節日、補班日。
const HOLIDAY_CATEGORIES = new Set(['放假之紀念日及節日', '補假'])
const EXTRA_HOLIDAY_NAMES = new Set(['勞動節'])

let byYear = null

function sourceFiles() {
  try {
    return readdirSync(DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^\d{4}\.csv$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

/**
 * 純解析：辦公日曆表 CSV 原始字串 → [{date,name,year}]。無 FS，方便測試。
 */
export function parseHolidayCsv(text) {
  const out = []
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/)
  for (let i = 1; i < lines.length; i++) { // 跳過 header
    const line = lines[i].trim()
    if (!line) continue
    const [rawDate, , name, isHoliday, category] = line.split(',')
    if (isHoliday !== '是') continue
    if (!HOLIDAY_CATEGORIES.has(category) && !EXTRA_HOLIDAY_NAMES.has(name)) continue
    if (!/^\d{8}$/.test(rawDate)) continue
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
    out.push({ date, name: name || category, year: Number(rawDate.slice(0, 4)) })
  }
  return out
}

function load() {
  if (byYear) return byYear
  byYear = new Map()
  const seen = new Set() // 多份 CSV 年度重疊時以先讀到的為準
  for (const file of sourceFiles()) {
    let text
    try {
      text = readFileSync(join(DIR, file), 'utf8')
    } catch {
      continue // 單一檔案讀不到不應讓整份資料失效
    }
    for (const { date, name, year } of parseHolidayCsv(text)) {
      if (seen.has(date)) continue
      seen.add(date)
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year).push({ date, name })
    }
  }
  for (const list of byYear.values()) list.sort((a, b) => a.date.localeCompare(b.date))
  return byYear
}

/**
 * 目前內建的年度清單（升冪）。跨年度前可用來確認資料是否已更新。
 */
export function listHolidayYears() {
  return [...load().keys()].sort((a, b) => a - b)
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
