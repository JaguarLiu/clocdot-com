import { localTimeToUTC } from '../utils/timezone.js'
import { computeWorkDuration } from './workDuration.js'
import { computeAttendanceFlags } from './attendanceFlags.js'
import { getShiftForDate, isOvernightShift } from './schedule.js'
import { applyLeaveToAttendance } from './leaveApplication.js'
import {
  computeLeaveMinutes, computePolicyYearBounds, getUsedMinutes, resolveQuotaMinutes,
} from './leaveBalance.js'
import { evaluateOvertimeCompliance, sumCountedMinutes } from './compliance.js'

// 核准請假：餘額檢查 → 寫狀態 → 套用扣假/出勤
async function approveLeave(prisma, { requestId, decidedById, note }) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { user: { include: { company: true } } },
  })
  if (!leave) return { ok: false, code: 404, body: { error: '找不到申請' } }
  if (leave.status !== 'pending') return { ok: false, code: 400, body: { error: '此申請已審核' } }

  const user = leave.user
  const policy = user?.companyId && await prisma.leavePolicy.findUnique({
    where: { companyId_leaveType: { companyId: user.companyId, leaveType: leave.leaveType } },
  })
  // parttime 不套用額度制度:核准時同樣跳過餘額檢查
  if (policy && user?.company && user.employmentType !== 'parttime') {
    const bounds = computePolicyYearBounds({ policy: user.company.leavePolicyYearReset, hireDate: user.hireDate })
    const used = await getUsedMinutes(prisma, {
      userId: leave.userId, leaveType: leave.leaveType, yearStart: bounds.start, yearEnd: bounds.end,
    })
    const requestMinutes = computeLeaveMinutes({
      startDate: leave.startDate, startTime: leave.startTime, endDate: leave.endDate, endTime: leave.endTime,
    })
    if (!Number.isFinite(requestMinutes)) return { ok: false, code: 400, body: { error: '此筆請假時間格式異常，請要求員工重送' } }
    const quotaMinutes = resolveQuotaMinutes(policy, user)
    if (used + requestMinutes > quotaMinutes) {
      return { ok: false, code: 400, body: { error: `餘額不足：剩餘 ${((quotaMinutes - used) / 60).toFixed(1)} 小時，此筆需 ${(requestMinutes / 60).toFixed(1)} 小時` } }
    }
  }

  // 樂觀鎖 (P1-8)：只有仍 pending 的申請能被核准，並發時只有一方成功
  const claimed = await prisma.leaveRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: { status: 'approved', reviewerId: decidedById, reviewedAt: new Date(), reviewNote: note || null },
  })
  if (claimed.count === 0) return { ok: false, code: 400, body: { error: '此申請已審核' } }
  await applyLeaveToAttendance(prisma, {
    userId: leave.userId, startDate: leave.startDate, endDate: leave.endDate, leaveType: leave.leaveType,
  })
  return { ok: true }
}

// 核准補卡：解析 reason → 更新出勤 → 寫狀態
async function approveCorrection(prisma, { requestId }) {
  const correction = await prisma.correctionRequest.findUnique({
    where: { id: requestId },
    include: { attendance: { include: { user: { include: { company: true } } } } },
  })
  if (!correction) return { ok: false, code: 404, body: { error: '找不到申請' } }
  if (correction.status !== 'pending') return { ok: false, code: 400, body: { error: '此申請已審核' } }

  // 樂觀鎖 (P1-8)：先搶狀態再改考勤，避免並發時考勤被改兩次
  const claimed = await prisma.correctionRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: { status: 'approved' },
  })
  if (claimed.count === 0) return { ok: false, code: 400, body: { error: '此申請已審核' } }

  const match = correction.reason.match(/^\[(.+?)\]\s*(\d{1,2}:\d{2})\s*-/)
  if (match) {
    const type = match[1]
    const timeStr = match[2].padStart(5, '0') // "6:30" → "06:30"，確保字串比較正確
    const attendance = correction.attendance
    const timezone = attendance.user?.timezone || 'Asia/Taipei'
    const resolvedShift = await getShiftForDate(prisma, attendance.userId, attendance.workDate)
    const shift = resolvedShift?.shift ?? null
    // 跨日班補「下班」且時刻早於上班時間 → 寫成排班日翌日的該時刻
    const baseDate = (type === '下班' && isOvernightShift(shift) && timeStr < shift.startTime)
      ? new Date(attendance.workDate.getTime() + 24 * 60 * 60 * 1000)
      : new Date(attendance.workDate)
    const dateStr = baseDate.toISOString().split('T')[0]
    const correctedTime = localTimeToUTC(dateStr, timeStr, timezone)
    const updateData = type === '上班' ? { punchIn: correctedTime } : { punchOut: correctedTime }
    const punchIn = type === '上班' ? correctedTime : attendance.punchIn
    const punchOut = type === '下班' ? correctedTime : attendance.punchOut
    if (punchIn && punchOut) {
      const breakMinutes = shift?.breakMinutes ?? attendance.user?.company?.breakMinutes ?? 60
      updateData.workDuration = computeWorkDuration(punchIn, punchOut, breakMinutes)
    }
    Object.assign(updateData, computeAttendanceFlags({
      punchIn, punchOut, shift, workDate: attendance.workDate, timezone,
    }))
    await prisma.attendanceRecord.update({ where: { id: correction.attendanceId }, data: updateData })
  }
  return { ok: true }
}

// 核准加班：合規投影（超標 409 除非 confirm）→ 寫狀態
async function approveOvertime(prisma, { requestId, confirm }) {
  const ot = await prisma.overtimeRequest.findUnique({
    where: { id: requestId },
    include: { user: { select: { companyId: true } } },
  })
  if (!ot) return { ok: false, code: 404, body: { error: '找不到申請' } }
  if (ot.status !== 'pending') return { ok: false, code: 400, body: { error: '此申請已審核' } }

  if (confirm !== true) {
    const companyId = ot.user?.companyId
    const company = companyId && await prisma.company.findUnique({ where: { id: companyId } })
    const flexibleOvertime = !!company?.flexibleOvertime
    const d = ot.workDate
    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    const quarterStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 2, 1))
    const priorRows = await prisma.overtimeRequest.findMany({
      where: {
        status: 'approved', userId: ot.userId,
        workDate: { gte: quarterStart, lt: monthEnd }, id: { not: requestId },
        user: { is: { companyId } },
      },
      select: { workDate: true, tiers: true },
    })
    const monthTiers = []
    const quarterTiers = []
    for (const row of priorRows) {
      const tiers = Array.isArray(row.tiers) ? row.tiers : []
      quarterTiers.push(...tiers)
      if (row.workDate >= monthStart && row.workDate < monthEnd) monthTiers.push(...tiers)
    }
    const candidateMinutes = sumCountedMinutes(Array.isArray(ot.tiers) ? ot.tiers : [])
    const result = evaluateOvertimeCompliance({ flexibleOvertime, monthTiers, quarterTiers, candidateMinutes })
    if (result.status === 'exceed') return { ok: false, code: 409, body: { error: 'compliance_warning', compliance: result } }
  }
  // 樂觀鎖 (P1-8)
  const claimed = await prisma.overtimeRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: { status: 'approved' },
  })
  if (claimed.count === 0) return { ok: false, code: 400, body: { error: '此申請已審核' } }
  return { ok: true }
}

/**
 * 對某申請套用「核准」副作用並把 status 設為 approved。
 * @returns {Promise<{ok:true} | {ok:false, code:number, body:object}>}
 */
export async function applyApprovalEffects(prisma, { requestType, requestId, decidedById, note, confirm }) {
  if (requestType === 'leave') return approveLeave(prisma, { requestId, decidedById, note })
  if (requestType === 'correction') return approveCorrection(prisma, { requestId })
  if (requestType === 'overtime') return approveOvertime(prisma, { requestId, confirm })
  return { ok: false, code: 400, body: { error: '未知的申請類型' } }
}
