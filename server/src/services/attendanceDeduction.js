/**
 * 計算某員工某月「遲到/早退/缺勤/工時不足 + 請假」扣薪（純函式）。
 * 每日扣款 = 工作側 + 請假側，兩側互不重疊（effectiveExpected 已排除請假時段）。
 *
 * @param {Object} args
 * @param {{workDate,isWorkday,leaves,workDuration,lateMinutes,earlyLeaveMinutes}[]} args.days
 * @param {{standardDailyMinutes,workHourType,lateDeductMode}} args.company
 * @param {number} args.monthlyWage 本薪 + 常態津貼
 * @param {Record<string,number>} args.leaveDeductRates 各假別比例 0~1（已解析）
 * @returns {{total:number, attendanceDeduction:number, leaveDeduction:number, days:{workDate,workAmount,leaveAmount,reason}[]}}
 */
export function computeAttendanceDeduction({ days, company, monthlyWage, leaveDeductRates }) {
  const std = company.standardDailyMinutes || 480
  const dailyWage = monthlyWage / 30
  const minuteValue = dailyWage / std

  let attendanceDeduction = 0
  let leaveDeduction = 0
  const out = []

  for (const d of days) {
    if (!d.isWorkday) continue

    const leaves = Array.isArray(d.leaves) ? d.leaves : []
    const totalLeaveMinutes = leaves.reduce((s, l) => s + l.minutes, 0)
    const effectiveExpected = Math.max(0, std - totalLeaveMinutes)

    // ── 工作側 ──
    let workMinutes = 0
    let reason = 'none'
    if (effectiveExpected > 0) {
      if (company.workHourType === 'fixed') {
        if (d.workDuration == null) {
          workMinutes = effectiveExpected
          reason = 'absence'
        } else {
          const raw = (d.lateMinutes || 0) + (d.earlyLeaveMinutes || 0)
          workMinutes = company.lateDeductMode === 'per_hour' ? Math.ceil(raw / 60) * 60 : raw
          reason = 'late_early'
        }
      } else {
        // flexible
        const worked = d.workDuration ?? 0
        workMinutes = Math.max(0, effectiveExpected - worked)
        reason = d.workDuration == null ? 'absence' : 'shortfall'
      }
      workMinutes = Math.min(workMinutes, effectiveExpected)
    }

    // ── 請假側 ──
    let leaveMinutesWeighted = 0
    for (const l of leaves) {
      const rate = leaveDeductRates[l.leaveType] ?? 0
      leaveMinutesWeighted += l.minutes * rate
    }

    const workAmount = Math.round(workMinutes * minuteValue)
    const leaveAmount = Math.round(leaveMinutesWeighted * minuteValue)

    attendanceDeduction += workAmount
    leaveDeduction += leaveAmount
    if (workAmount > 0 || leaveAmount > 0) {
      out.push({ workDate: d.workDate, workAmount, leaveAmount, reason: workAmount > 0 ? reason : 'none' })
    }
  }

  return {
    total: attendanceDeduction + leaveDeduction,
    attendanceDeduction,
    leaveDeduction,
    days: out,
  }
}
