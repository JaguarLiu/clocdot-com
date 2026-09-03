import { scopedByUser, reviewScopedByUser } from '../utils/tenant.js'
import { LEAVE_TYPES, resolveLeaveDeductRate } from '../services/leaveTypes.js'
import { lateEarlyMinutes } from '../services/attendanceFlags.js'
import { loadScheduleBundle, shiftFor } from '../services/schedule.js'
import { expandLeaveToDays } from '../services/leaveExpansion.js'
import { buildSettlement } from '../services/settlement.js'
import { evaluateOvertimeCompliance, sumCountedMinutes, DAILY_OT_CAP } from '../services/compliance.js'
import { getHolidayDateSet } from '../data/twHolidays/index.js'
import { registerLeavePolicyRoutes } from './admin/leavePolicies.js'
import { registerEmployeeAccessRoutes } from './admin/employeeAccess.js'
import { registerIssueRoutes } from './admin/issues.js'
import { registerReviewRoutes } from './admin/reviews.js'
import { registerCompanyRoutes } from './admin/company.js'
import { registerOrganizationRoutes } from './admin/organization.js'
import { registerReportingRoutes } from './admin/reporting.js'
import { registerPayrollRoutes } from './admin/payroll.js'
import { registerEmployeeRoutes } from './admin/employees.js'
import { adminSchemas as S } from './admin/schemas.js'

export default async function adminRoutes(fastify) {
  fastify.addHook('onRequest', fastify.requirePanel)

  // GET /api/admin/me — 後台目前使用者（任何後台使用者）
  fastify.get('/api/admin/me', async (request) => {
    const u = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, name: true },
    })
    const adminRoleId = await employeeSupport.companyAdminRoleId(request.companyId)
    return { id: u.id, name: u.name, isAdmin: request.isAdmin, permissions: request.permissions, adminRoleId }
  })

  // 組裝某月結算所需的所有資料（共用於 JSON 報表與 CSV 匯出）
  // 載入計薪扣款所需的公司設定與各假別扣薪比例（共用於月結算與薪資結算）
  async function loadDeductionContext(companyId) {
    const company = await fastify.prisma.company.findUnique({ where: { id: companyId } })
    const leavePolicies = await fastify.prisma.leavePolicy.findMany({ where: { companyId } })
    const policyRateByType = Object.fromEntries(leavePolicies.map((p) => [p.leaveType, p.deductRate]))
    const leaveDeductRates = Object.fromEntries(
      LEAVE_TYPES.map((t) => [t.value, resolveLeaveDeductRate(t.value, policyRateByType[t.value])]),
    )
    return { company, leaveDeductRates }
  }

  async function assembleSettlement(request, month) {
    const [year, mon] = month.split('-').map(Number)
    const startDate = new Date(Date.UTC(year, mon - 1, 1))
    const endDate = new Date(Date.UTC(year, mon, 1))

    const { company } = await loadDeductionContext(request.companyId)

    const users = await fastify.prisma.user.findMany({
      where: { companyId: request.companyId, deletedAt: null },
      select: { id: true, empNo: true, name: true, email: true, avatar: true, employmentType: true },
      orderBy: { empNo: 'asc' },
    })

    const attendance = await fastify.prisma.attendanceRecord.findMany({
      where: scopedByUser(request, { workDate: { gte: startDate, lt: endDate } }),
      select: { userId: true, workDate: true, workDuration: true, isLate: true, isEarlyLeave: true, punchIn: true, punchOut: true },
    })

    const scheduleBundle = await loadScheduleBundle(fastify.prisma, {
      userIds: users.map((u) => u.id), startDate, endDate,
    })

    const overtimeRows = await fastify.prisma.overtimeRequest.findMany({
      where: scopedByUser(request, { status: 'approved', workDate: { gte: startDate, lt: endDate } }),
      select: { userId: true, tiers: true },
    })

    // 核准請假時數（落在當月的部分，簡化為整段時數歸入該月；精準跨月切分留待後續）
    const leaves = await fastify.prisma.leaveRequest.findMany({
      where: scopedByUser(request, { status: 'approved', startDate: { gte: startDate, lt: endDate } }),
      select: { userId: true, leaveType: true, startDate: true, startTime: true, endDate: true, endTime: true },
    })
    const approvedLeaveMinutesByUser = {}
    const leaveDaysByUser = {}
    for (const lv of leaves) {
      const mins = leaveMinutes(lv)
      approvedLeaveMinutesByUser[lv.userId] = (approvedLeaveMinutesByUser[lv.userId] ?? 0) + mins
      const byDate = (leaveDaysByUser[lv.userId] ??= {})
      for (const e of expandLeaveToDays(lv, company.standardDailyMinutes)) {
        (byDate[e.date] ??= []).push({ leaveType: e.leaveType, minutes: e.minutes })
      }
    }

    const holidays = getHolidayDateSet(year)
    const exceptionRows = await fastify.prisma.companyDayException.findMany({
      where: { companyId: request.companyId, date: { gte: startDate, lt: endDate } },
    })
    const exceptions = Object.fromEntries(
      exceptionRows.map((r) => [r.date.toISOString().slice(0, 10), r.dayType]),
    )

    const settlementRows = buildSettlement({
      month,
      company,
      holidays,
      exceptions,
      users,
      attendance: attendance.map((a) => {
        const dateStr = a.workDate.toISOString().slice(0, 10)
        const resolved = shiftFor(scheduleBundle, a.userId, dateStr)
        const { lateMinutes, earlyLeaveMinutes } = lateEarlyMinutes({
          punchIn: a.punchIn, punchOut: a.punchOut, shift: resolved?.shift ?? null,
          workDate: a.workDate, timezone: 'Asia/Taipei',
        })
        return { ...a, workDate: dateStr, lateMinutes, earlyLeaveMinutes }
      }),
      approvedOvertime: overtimeRows,
      approvedLeaveMinutesByUser,
      leaveDaysByUser,
    })

    const compliance = await assembleOvertimeCompliance(request, month)
    const complianceByUser = Object.fromEntries(compliance.map((c) => [c.userId, c]))
    return settlementRows.map((row) => {
      const c = complianceByUser[row.userId]
      return {
        ...row,
        compliance: c
          ? { status: c.status, monthlyMinutes: c.monthlyMinutes, monthlyCap: c.monthlyCap,
              quarterMinutes: c.quarterMinutes, quarterCap: c.quarterCap, reasons: c.reasons }
          : { status: 'ok', monthlyMinutes: 0, monthlyCap: null, quarterMinutes: null, quarterCap: null, reasons: [] },
      }
    })
  }

  // 組裝某月所有員工的加班合規評估（共用於合規儀表板與月結算標記）
  async function assembleOvertimeCompliance(request, month, { applyScope = false } = {}) {
    const [year, mon] = month.split('-').map(Number)
    const monthStart = new Date(Date.UTC(year, mon - 1, 1))
    const monthEnd = new Date(Date.UTC(year, mon, 1))
    // 近 3 個月（含本月）：本月起算往前推 2 個月的 1 號
    const quarterStart = new Date(Date.UTC(year, mon - 3, 1))

    const company = await fastify.prisma.company.findUnique({ where: { id: request.companyId } })
    const flexibleOvertime = !!company?.flexibleOvertime

    const users = await fastify.prisma.user.findMany({
      where: {
        companyId: request.companyId, deletedAt: null,
        ...(applyScope && request.scopeUserIds ? { id: { in: request.scopeUserIds } } : {}),
      },
      select: { id: true, empNo: true, name: true, avatar: true },
      orderBy: { empNo: 'asc' },
    })

    // 季窗一次撈足，本月 = 季窗中 workDate 落在本月者
    const quarterRows = await fastify.prisma.overtimeRequest.findMany({
      where: (applyScope ? reviewScopedByUser : scopedByUser)(request, {
        status: 'approved',
        workDate: { gte: quarterStart, lt: monthEnd },
      }),
      select: { userId: true, workDate: true, dayType: true, tiers: true },
    })

    const monthTiersByUser = {}
    const quarterTiersByUser = {}
    const dailyOverByUser = {}
    for (const row of quarterRows) {
      const tiers = Array.isArray(row.tiers) ? row.tiers : []
      ;(quarterTiersByUser[row.userId] ??= []).push(...tiers)
      if (row.workDate >= monthStart && row.workDate < monthEnd) {
        ;(monthTiersByUser[row.userId] ??= []).push(...tiers)
        // 單日 4h：僅平日，計入分鐘 > 240 視為超單日上限
        const countedMinutes = sumCountedMinutes(tiers)
        if (row.dayType === 'workday' && countedMinutes > DAILY_OT_CAP) {
          ;(dailyOverByUser[row.userId] ??= []).push({
            workDate: row.workDate.toISOString().slice(0, 10),
            minutes: countedMinutes,
          })
        }
      }
    }

    return users.map((u) => ({
      userId: u.id,
      empNo: u.empNo,
      name: u.name,
      avatar: u.avatar,
      ...evaluateOvertimeCompliance({
        flexibleOvertime,
        monthTiers: monthTiersByUser[u.id] ?? [],
        quarterTiers: quarterTiersByUser[u.id] ?? [],
        dailyOverDates: dailyOverByUser[u.id] ?? [],
      }),
    }))
  }

  // 計算單筆請假分鐘數（同日精算；跨日以日數×8h 近似，足供報表彙整）
  function leaveMinutes(lv) {
    const start = lv.startDate.toISOString().slice(0, 10)
    const end = lv.endDate.toISOString().slice(0, 10)
    const [sh, sm] = lv.startTime.split(':').map(Number)
    const [eh, em] = lv.endTime.split(':').map(Number)
    if (start === end) return (eh * 60 + em) - (sh * 60 + sm)
    const dayMs = 24 * 60 * 60 * 1000
    const days = Math.round((lv.endDate - lv.startDate) / dayMs)
    return (days - 1) * 480 + (480 - (sh * 60 + sm)) + (eh * 60 + em)
  }

  registerReportingRoutes(fastify, S, { assembleSettlement })
  registerReviewRoutes(fastify, S, { assembleOvertimeCompliance })
  registerCompanyRoutes(fastify, S)

  const employeeSupport = registerEmployeeRoutes(fastify, S)

  registerOrganizationRoutes(fastify, S, {
    ...employeeSupport,
  })
  registerPayrollRoutes(fastify, S, { assembleSettlement, loadDeductionContext })

  registerLeavePolicyRoutes(fastify, S)
  registerEmployeeAccessRoutes(fastify, S)
  registerIssueRoutes(fastify, S)
}
