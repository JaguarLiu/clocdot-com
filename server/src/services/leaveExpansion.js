const DAY_MS = 24 * 60 * 60 * 1000
const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const dateStr = (d) => new Date(d).toISOString().slice(0, 10)
const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY_MS)

/**
 * 將單筆請假展開為每日 { date, leaveType, minutes }。
 * 與 admin.js leaveMinutes() 的近似一致：跨日中間日以 standardDailyMinutes 計。
 *
 * @param {{ leaveType:string, startDate:Date, startTime:string, endDate:Date, endTime:string }} leave
 * @param {number} [standardDailyMinutes=480]
 * @returns {{ date:string, leaveType:string, minutes:number }[]}
 */
export function expandLeaveToDays(leave, standardDailyMinutes = 480) {
  const startMin = toMin(leave.startTime)
  const endMin = toMin(leave.endTime)
  const start = dateStr(leave.startDate)
  const end = dateStr(leave.endDate)

  if (start === end) {
    return [{ date: start, leaveType: leave.leaveType, minutes: Math.max(0, endMin - startMin) }]
  }

  const days = Math.round((new Date(end) - new Date(start)) / DAY_MS)
  const out = []
  for (let i = 0; i <= days; i++) {
    const date = dateStr(addDays(leave.startDate, i))
    let minutes
    if (i === 0) minutes = Math.max(0, standardDailyMinutes - startMin)
    else if (i === days) minutes = Math.max(0, endMin)
    else minutes = standardDailyMinutes
    out.push({ date, leaveType: leave.leaveType, minutes })
  }
  return out
}
