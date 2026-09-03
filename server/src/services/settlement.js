import { resolveDayType } from './dayType.js'

/**
 * 回傳該月所有 workday 的 'YYYY-MM-DD' 陣列。
 */
export function listWorkdays(month, company, { holidays, exceptions }) {
  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  const out = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (resolveDayType(dateStr, company, { holidays, exceptions }) === 'workday') out.push(dateStr)
  }
  return out
}

/**
 * 計算某月份所有日期，並依日別計數工作日。
 * @returns {number} 該月 workday 數
 */
export function countWorkdays(month, company, ctx) {
  return listWorkdays(month, company, ctx).length
}

/**
 * 彙整月結算報表（即時計算，不鎖定）。所有資料由呼叫端注入，純函式。
 *
 * @param {Object} args
 * @param {string} args.month 'YYYY-MM'
 * @param {Object} args.company
 * @param {Set<string>} args.holidays
 * @param {Record<string,string>} args.exceptions
 * @param {{id,empNo,name,employmentType}[]} args.users
 * @param {{userId,workDate,workDuration,isLate,isEarlyLeave}[]} args.attendance
 * @param {{userId,tiers:{rate,minutes}[]}[]} args.approvedOvertime
 * @param {Record<string,number>} args.approvedLeaveMinutesByUser
 * @returns {Object[]} 每員工一列
 */
export function buildSettlement({ month, company, holidays, exceptions, users, attendance, approvedOvertime, approvedLeaveMinutesByUser, leaveDaysByUser = {} }) {
  const workdays = listWorkdays(month, company, { holidays, exceptions })
  const expectedWorkdays = workdays.length
  const expectedFullMinutes = expectedWorkdays * company.standardDailyMinutes

  // 依員工分組
  const attByUser = groupBy(attendance, 'userId')
  const otByUser = groupBy(approvedOvertime, 'userId')

  return users.map((u) => {
    const att = attByUser[u.id] ?? []
    const completed = att.filter((a) => a.workDuration != null)
    const leaveMinutes = approvedLeaveMinutesByUser?.[u.id] ?? 0
    const attByDate = Object.fromEntries(att.map((a) => [a.workDate, a]))
    const userLeaveDays = leaveDaysByUser[u.id] ?? {}

    const overtimeByRate = {}
    for (const ot of otByUser[u.id] ?? []) {
      for (const t of ot.tiers ?? []) {
        overtimeByRate[t.rate] = (overtimeByRate[t.rate] ?? 0) + t.minutes
      }
    }

    const attendanceDays = workdays.map((date) => {
      const a = attByDate[date]
      return {
        workDate: date,
        isWorkday: true,
        leaves: userLeaveDays[date] ?? [],
        workDuration: a?.workDuration ?? null,
        lateMinutes: a?.lateMinutes ?? 0,
        earlyLeaveMinutes: a?.earlyLeaveMinutes ?? 0,
      }
    })
    // 完全缺勤天數：工作日當天無出勤紀錄且無任何請假
    const absenceDays = attendanceDays.filter(
      (d) => d.workDuration == null && d.leaves.reduce((s, l) => s + l.minutes, 0) === 0,
    ).length

    return {
      userId: u.id,
      empNo: u.empNo,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      employmentType: u.employmentType,
      expectedWorkdays,
      expectedMinutes: expectedFullMinutes - leaveMinutes,
      actualWorkdays: completed.length,
      actualMinutes: completed.reduce((s, a) => s + a.workDuration, 0),
      lateCount: att.filter((a) => a.isLate).length,
      earlyLeaveCount: att.filter((a) => a.isEarlyLeave).length,
      absenceDays,
      leaveMinutes,
      overtimeByRate,
      attendanceDays,
    }
  })
}

function groupBy(arr, key) {
  const out = {}
  for (const item of arr) {
    (out[item[key]] ??= []).push(item)
  }
  return out
}
