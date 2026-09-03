import { DEFAULT_WORKDAY_MINUTES } from './leaveTypes.js'

/**
 * 特休換薪金額計算（純函式）。
 * @param {Object} args
 * @param {number} args.remainingMinutes 剩餘特休分鐘數
 * @param {number} args.monthlyWage 本薪 + 全部 allowances 合計
 * @returns {{minutes:number, days:number, dailyWage:number, amount:number}}
 */
export function computeCashout({ remainingMinutes, monthlyWage }) {
  if (!Number.isFinite(remainingMinutes) || remainingMinutes <= 0) {
    return { minutes: 0, days: 0, dailyWage: 0, amount: 0 }
  }
  const dailyWage = Math.round(monthlyWage / 30)
  const days = remainingMinutes / DEFAULT_WORKDAY_MINUTES
  const amount = Math.round(days * dailyWage)
  return { minutes: remainingMinutes, days, dailyWage, amount }
}
