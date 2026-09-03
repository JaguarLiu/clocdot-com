// Onsite 排班判定：今天是否需到公司打卡
//
// 規則：
//   1. onsiteWeekdaysByCycle 為陣列的陣列，長度 = onsiteCycleWeeks (1..4)
//      e.g. [[1,3,5]]            = 每週固定一三五
//      e.g. [[1,3,5],[2,4,6]]    = 雙週循環，週A 一三五、週B 二四六
//      ISO weekday: 1=Mon..7=Sun
//   2. onsiteMonthDays = [1, 15, 30] = 每月這幾號
//   3. 兩者「聯集」= 需 onsite；全部空陣列 = 不限制 (回 false → 自由打卡)
//   4. cycle index 由 scheduleAnchorDate 起算；未設則以 1970-01-05 (Mon) 為錨點

import { LOCATION_TYPE } from '../utils/geofence.js'

const DEFAULT_ANCHOR_MS = Date.UTC(1970, 0, 5) // 1970-01-05 是星期一
const DAY_MS = 24 * 60 * 60 * 1000

function getISOWeekday(date) {
  // JS getUTCDay: 0=Sun..6=Sat → ISO: 1=Mon..7=Sun
  const d = date.getUTCDay()
  return d === 0 ? 7 : d
}

function getMondayUTC(date) {
  const iso = getISOWeekday(date)
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() - (iso - 1))
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

/**
 * @param {Date} workDate UTC date 代表「那一天」(@db.Date 風格)
 * @param {object} company Prisma Company row
 * @returns {boolean} 是否需 onsite
 */
export function isOnsiteRequired(workDate, company) {
  if (!company) return false

  const weekdaysByCycle = Array.isArray(company.onsiteWeekdaysByCycle)
    ? company.onsiteWeekdaysByCycle
    : []
  const monthDays = Array.isArray(company.onsiteMonthDays) ? company.onsiteMonthDays : []
  const cycleWeeks = Number(company.onsiteCycleWeeks) || 1

  const flatWeekdays = weekdaysByCycle.flat().filter(Number.isInteger)
  if (flatWeekdays.length === 0 && monthDays.length === 0) return false

  // 月份固定日 (UTC date — 與 attendance workDate 對齊)
  const dom = workDate.getUTCDate()
  if (monthDays.includes(dom)) return true

  if (weekdaysByCycle.length === 0) return false

  // 計算今天落在 cycle 的第幾週
  const anchor = company.scheduleAnchorDate
    ? getMondayUTC(new Date(company.scheduleAnchorDate))
    : new Date(DEFAULT_ANCHOR_MS)
  const todayMonday = getMondayUTC(workDate)
  const weeksDiff = Math.floor((todayMonday.getTime() - anchor.getTime()) / (7 * DAY_MS))
  const cycleIdx = ((weeksDiff % cycleWeeks) + cycleWeeks) % cycleWeeks

  const todaysList = weekdaysByCycle[cycleIdx]
  if (!Array.isArray(todaysList)) return false
  const iso = getISOWeekday(workDate)
  return todaysList.includes(iso)
}

/**
 * 是否「在任一公司地點 radius 內」(基於 resolveLocation 結果)
 */
export function isAtOffice(locationType) {
  return locationType === LOCATION_TYPE.OFFICE
}

/**
 * 驗證 admin 傳來的 onsite schedule 設定
 * @returns {string|null} error message, null 代表通過
 */
export function validateOnsiteSchedule({ onsiteCycleWeeks, onsiteWeekdaysByCycle, onsiteMonthDays }) {
  if (onsiteCycleWeeks !== undefined) {
    if (!Number.isInteger(onsiteCycleWeeks) || onsiteCycleWeeks < 1 || onsiteCycleWeeks > 4) {
      return 'onsiteCycleWeeks 需為 1~4 的整數'
    }
  }
  if (onsiteWeekdaysByCycle !== undefined) {
    if (!Array.isArray(onsiteWeekdaysByCycle)) return 'onsiteWeekdaysByCycle 需為陣列'
    if (onsiteCycleWeeks !== undefined && onsiteWeekdaysByCycle.length !== onsiteCycleWeeks) {
      return 'onsiteWeekdaysByCycle 長度需等於 onsiteCycleWeeks'
    }
    for (const row of onsiteWeekdaysByCycle) {
      if (!Array.isArray(row)) return 'onsiteWeekdaysByCycle 內每項需為陣列'
      for (const d of row) {
        if (!Number.isInteger(d) || d < 1 || d > 7) {
          return 'onsiteWeekdaysByCycle 的值需為 1~7 的整數 (1=週一, 7=週日)'
        }
      }
    }
  }
  if (onsiteMonthDays !== undefined) {
    if (!Array.isArray(onsiteMonthDays)) return 'onsiteMonthDays 需為陣列'
    for (const d of onsiteMonthDays) {
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        return 'onsiteMonthDays 的值需為 1~31 的整數'
      }
    }
  }
  return null
}
