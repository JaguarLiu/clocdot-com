// 加班時數分級 — 依《勞動基準法》§24（延長工時/休息日）、§39（國定假日/例假）。
// 本模組只輸出「分級時數」，不計算金額；倍率字串供 HR/會計自行套率。
const H = 60
const WORKDAY_DAILY_CAP = 4 * H // 平日單日加班上限 4 小時

/**
 * @param {{ dayType:string, workMinutes:number, standardDailyMinutes:number }} args
 * @returns {{ tiers:{rate:string,minutes:number}[], totalOvertimeMinutes:number, exceedsDailyCap?:boolean }}
 */
export function classifyOvertime({ dayType, workMinutes, standardDailyMinutes }) {
  if (!workMinutes || workMinutes <= 0) return { tiers: [], totalOvertimeMinutes: 0 }

  if (dayType === 'national_holiday') {
    return { tiers: [{ rate: 'holiday', minutes: workMinutes }], totalOvertimeMinutes: workMinutes }
  }
  if (dayType === 'regular_leave') {
    return { tiers: [{ rate: 'regular_leave', minutes: workMinutes }], totalOvertimeMinutes: workMinutes }
  }

  if (dayType === 'restday') {
    // 休息日：前 2h ×1.34、第 3–8h ×1.67、逾 8h ×2.67
    const tiers = splitTiers(workMinutes, [
      { rate: '1.34', cap: 2 * H },
      { rate: '1.67', cap: 6 * H },
      { rate: '2.67', cap: Infinity },
    ])
    return { tiers, totalOvertimeMinutes: workMinutes }
  }

  // workday：超過標準工時的部分才算加班，前 2h ×1.34、其後 ×1.67
  const ot = Math.max(0, workMinutes - standardDailyMinutes)
  if (ot === 0) return { tiers: [], totalOvertimeMinutes: 0 }
  const tiers = splitTiers(ot, [
    { rate: '1.34', cap: 2 * H },
    { rate: '1.67', cap: Infinity },
  ])
  const result = { tiers, totalOvertimeMinutes: ot }
  if (ot > WORKDAY_DAILY_CAP) result.exceedsDailyCap = true
  return result
}

// 把總分鐘數依序填入各級（cap 為該級可容納的分鐘上限），回傳非零的級。
function splitTiers(total, levels) {
  const tiers = []
  let remaining = total
  for (const { rate, cap } of levels) {
    if (remaining <= 0) break
    const minutes = Math.min(remaining, cap)
    tiers.push({ rate, minutes })
    remaining -= minutes
  }
  return tiers
}
