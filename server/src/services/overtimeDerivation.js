import { resolveDayType } from './dayType.js'
import { classifyOvertime } from './overtime.js'

/**
 * 從打卡紀錄推導「待送加班」清單（虛擬草稿）。
 *
 * @param {Object} args
 * @param {{workDate:string, workDuration:number|null}[]} args.records  workDate 為 'YYYY-MM-DD'
 * @param {Object} args.company  含 standardDailyMinutes 與三組 weekday 陣列
 * @param {Set<string>} args.holidays
 * @param {Record<string,string>} args.exceptions
 * @param {Set<string>} args.existingDates  已有加班單的 workDate（排除）
 * @returns {{workDate, dayType, derivedMinutes, tiers}[]}
 */
export function derivePendingOvertime({ records, company, holidays, exceptions, existingDates }) {
  const out = []
  for (const rec of records) {
    if (rec.workDuration == null) continue
    if (existingDates.has(rec.workDate)) continue
    const dayType = resolveDayType(rec.workDate, company, { holidays, exceptions })
    const { tiers, totalOvertimeMinutes } = classifyOvertime({
      dayType,
      workMinutes: rec.workDuration,
      standardDailyMinutes: company.standardDailyMinutes,
    })
    if (totalOvertimeMinutes <= 0) continue
    out.push({ workDate: rec.workDate, dayType, derivedMinutes: totalOvertimeMinutes, tiers })
  }
  return out
}
