// 加班工時上限合規評估 — 依《勞動基準法》§32。純函式，不做 I/O。
// 月/季延長工時上限只加總「延長工時」性質的 tier（平日/休息日 1.34/1.67/2.67）；
// 國定假日(holiday)、例假(regular_leave) 屬 §39 另計，不納入 §32 月上限。
const H = 60
export const MONTHLY_CAP_NORMAL = 46 * H
export const MONTHLY_CAP_FLEXIBLE = 54 * H
export const QUARTER_CAP = 138 * H // 僅 flexibleOvertime 生效
export const DAILY_OT_CAP = 4 * H // 與 services/overtime.js WORKDAY_DAILY_CAP 同源
export const WARN_RATIO = 0.9 // 投影達上限 90% 起進入 warn

const COUNTED_RATES = new Set(['1.34', '1.67', '2.67'])
const fmtH = (min) => (min / 60).toFixed(1)

export function sumCountedMinutes(tiers) {
  if (!Array.isArray(tiers)) return 0
  return tiers
    .filter((t) => COUNTED_RATES.has(t.rate))
    .reduce((sum, t) => sum + Math.max(0, t.minutes || 0), 0)
}

/**
 * @param {Object} a
 * @param {boolean} a.flexibleOvertime
 * @param {{rate:string,minutes:number}[]} a.monthTiers   本月已核准加班 tiers
 * @param {{rate:string,minutes:number}[]} [a.quarterTiers] 近 3 個月「已核准」tiers（時間窗含本月，但不含正在審核的候選單；候選單請走 candidateMinutes）
 * @param {number} [a.candidateMinutes] 審核中這張單的「計入」分鐘數（投影用）
 * @param {{workDate:string,minutes:number}[]} [a.dailyOverDates] 單日延長 > 4h 的日子
 * @returns {{status:'ok'|'warn'|'exceed',monthlyMinutes:number,monthlyCap:number,
 *   monthlyProjected:number,quarterMinutes:number|null,quarterCap:number|null,
 *   reasons:{code:string,severity:'warn'|'exceed',detail:string}[]}}
 */
export function evaluateOvertimeCompliance({
  flexibleOvertime = false,
  monthTiers = [],
  quarterTiers = [],
  candidateMinutes = 0,
  dailyOverDates = [],
}) {
  const monthlyCap = flexibleOvertime ? MONTHLY_CAP_FLEXIBLE : MONTHLY_CAP_NORMAL
  const monthlyMinutes = sumCountedMinutes(monthTiers)
  const monthlyProjected = monthlyMinutes + candidateMinutes

  const quarterCap = flexibleOvertime ? QUARTER_CAP : null
  const quarterMinutes = flexibleOvertime
    ? sumCountedMinutes(quarterTiers) + candidateMinutes
    : null

  const reasons = []

  const monthCode = flexibleOvertime ? 'MONTHLY_54' : 'MONTHLY_46'
  if (monthlyProjected > monthlyCap) {
    reasons.push({ code: monthCode, severity: 'exceed',
      detail: `本月延長工時將達 ${fmtH(monthlyProjected)}h，超過 ${fmtH(monthlyCap)}h 上限` })
  } else if (monthlyProjected >= monthlyCap * WARN_RATIO) {
    reasons.push({ code: monthCode, severity: 'warn',
      detail: `本月延長工時已達 ${fmtH(monthlyProjected)}h，接近 ${fmtH(monthlyCap)}h 上限` })
  }

  if (flexibleOvertime) {
    if (quarterMinutes > quarterCap) {
      reasons.push({ code: 'QUARTER_138', severity: 'exceed',
        detail: `近 3 個月延長工時將達 ${fmtH(quarterMinutes)}h，超過 ${fmtH(quarterCap)}h 上限` })
    } else if (quarterMinutes >= quarterCap * WARN_RATIO) {
      reasons.push({ code: 'QUARTER_138', severity: 'warn',
        detail: `近 3 個月延長工時已達 ${fmtH(quarterMinutes)}h，接近 ${fmtH(quarterCap)}h 上限` })
    }
  }

  for (const d of dailyOverDates) {
    reasons.push({ code: 'DAILY_4H', severity: 'warn',
      detail: `${d.workDate} 單日延長工時 ${fmtH(d.minutes)}h，超過 4h 上限` })
  }

  const status = reasons.some((r) => r.severity === 'exceed')
    ? 'exceed'
    : reasons.some((r) => r.severity === 'warn')
      ? 'warn'
      : 'ok'

  return { status, monthlyMinutes, monthlyCap, monthlyProjected, quarterMinutes, quarterCap, reasons }
}
