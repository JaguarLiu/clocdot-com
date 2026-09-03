/**
 * 判定某日的日別。完全不依賴 DB — holidays/exceptions 由呼叫端注入。
 *
 * @param {string} dateStr  'YYYY-MM-DD'
 * @param {{ workdayWeekdays:number[], restDayWeekdays:number[], regularLeaveWeekdays:number[] }} company
 * @param {{ holidays: Set<string>, exceptions: Record<string,string> }} ctx
 *   - holidays: 國定假日日期 Set
 *   - exceptions: { 'YYYY-MM-DD': dayType } 公司日別例外
 * @returns {'workday'|'restday'|'regular_leave'|'national_holiday'}
 *
 * 優先序：例外 > 國定假日 > 週工作日設定
 */
export function resolveDayType(dateStr, company, { holidays, exceptions }) {
  if (exceptions && exceptions[dateStr]) return exceptions[dateStr]
  if (holidays && holidays.has(dateStr)) return 'national_holiday'

  // ISO weekday：1=Mon..7=Sun。用 UTC 避免本地時區位移。
  const [y, m, d] = dateStr.split('-').map(Number)
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  const iso = jsDay === 0 ? 7 : jsDay

  if (company.restDayWeekdays?.includes(iso)) return 'restday'
  if (company.regularLeaveWeekdays?.includes(iso)) return 'regular_leave'
  return 'workday'
}
