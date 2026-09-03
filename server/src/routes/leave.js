import { dateStrToDate } from '../utils/timezone.js'
import { isValidLeaveType } from '../services/leaveTypes.js'
import {
  computeLeaveMinutes, computePolicyYearBounds, getUsedMinutes, buildBalances, resolveQuotaMinutes,
} from '../services/leaveBalance.js'
import { canRequestCancel } from '../services/leaveTransitions.js'
import { findOverlaps } from '../services/leaveOverlap.js'
import { toCalendarEvents } from '../services/leaveCalendarView.js'
import { createApprovalChain } from '../services/approvalEngine.js'
import { body, str, strOrNull } from '../utils/schema.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export default async function leaveRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate)

  // POST /api/leave-requests — 送出請假申請 (先驗假別、再驗餘額)
  fastify.post('/api/leave-requests', {
    schema: { body: body({
      leaveType: str, startDate: str, startTime: str, endDate: str, endTime: str, reason: strOrNull,
    }) },
  }, async (request, reply) => {
    const { leaveType, startDate, startTime, endDate, endTime, reason } = request.body

    if (!leaveType || !startDate || !startTime || !endDate || !endTime) {
      return reply.code(400).send({ error: '請填寫所有必填欄位' })
    }
    if (!isValidLeaveType(leaveType)) {
      return reply.code(400).send({ error: '不支援的假別' })
    }
    // 嚴格格式驗證 — 避免非法輸入導致後續 NaN 污染餘額計算
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      return reply.code(400).send({ error: '日期格式需為 YYYY-MM-DD' })
    }
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return reply.code(400).send({ error: '時間格式需為 HH:MM' })
    }
    if (startDate > endDate || (startDate === endDate && startTime >= endTime)) {
      return reply.code(400).send({ error: '結束時間必須晚於開始時間' })
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      include: { company: true },
    })
    if (!user || !user.company) {
      return reply.code(400).send({ error: '帳號未綁定公司' })
    }

    // 查該公司此假別政策；沒設就允許 (等同無上限) — 避免未設政策時員工動不了
    const policy = await fastify.prisma.leavePolicy.findUnique({
      where: { companyId_leaveType: { companyId: user.companyId, leaveType } },
    })

    const s = dateStrToDate(startDate)
    const e = dateStrToDate(endDate)
    const requestMinutes = computeLeaveMinutes({
      startDate: s, startTime, endDate: e, endTime,
    })
    if (!Number.isFinite(requestMinutes)) {
      return reply.code(400).send({ error: '請假時間計算失敗，請檢查日期/時間格式' })
    }

    // parttime 不套用額度制度:照常申請與審核,但不驗餘額
    if (policy && user.employmentType !== 'parttime') {
      const bounds = computePolicyYearBounds({
        policy: user.company.leavePolicyYearReset,
        hireDate: user.hireDate,
      })
      const used = await getUsedMinutes(fastify.prisma, {
        userId: user.id,
        leaveType,
        yearStart: bounds.start,
        yearEnd: bounds.end,
      })
      const quotaMinutes = resolveQuotaMinutes(policy, user)
      const remaining = quotaMinutes - used
      if (requestMinutes > remaining) {
        return reply.code(400).send({
          error: `餘額不足：此假別剩餘 ${(remaining / 60).toFixed(1)} 小時，本次申請 ${(requestMinutes / 60).toFixed(1)} 小時`,
          remainingMinutes: remaining,
          requestMinutes,
        })
      }
    }

    const leave = await fastify.prisma.leaveRequest.create({
      data: {
        userId: request.user.id,
        leaveType,
        startDate: s,
        startTime,
        endDate: e,
        endTime,
        reason: reason || null,
        status: 'pending',
      },
    })

    await createApprovalChain(fastify.prisma, {
      requestType: 'leave', requestId: leave.id, submitterId: user.id, companyId: user.companyId,
    })

    // 撞期偵測（非阻擋）：同公司其他人在此區間已核准的假
    const companyApproved = await fastify.prisma.leaveRequest.findMany({
      where: {
        status: 'approved',
        user: { companyId: user.companyId },
        startDate: { lte: e },
        endDate: { gte: s },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
        user: { select: { name: true } },
      },
    })
    const overlaps = findOverlaps(
      companyApproved.map((r) => ({ userId: r.userId, name: r.user?.name ?? null, startDate: r.startDate, endDate: r.endDate })),
      { startDate: s, endDate: e, excludeUserId: user.id },
    )

    return { ...leave, overlaps }
  })

  // GET /api/leave-requests
  fastify.get('/api/leave-requests', async (request) => {
    return fastify.prisma.leaveRequest.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
    })
  })

  // GET /api/leave-balances — 自己的各假別餘額
  fastify.get('/api/leave-balances', async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      include: { company: true },
    })
    if (!user?.company) return reply.code(400).send({ error: '帳號未綁定公司' })

    const policies = await fastify.prisma.leavePolicy.findMany({
      where: { companyId: user.companyId },
    })

    return buildBalances(fastify.prisma, { user, company: user.company, policies })
  })

  // DELETE /api/leave-requests/:id — 僅允許撤回自己仍在 pending 的申請
  fastify.delete('/api/leave-requests/:id', async (request, reply) => {
    const { id } = request.params

    const existing = await fastify.prisma.leaveRequest.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: '找不到該申請' })
    if (existing.userId !== request.user.id) return reply.code(403).send({ error: '無權撤回此申請' })
    if (existing.status !== 'pending') return reply.code(400).send({ error: '已審核的申請無法撤回' })

    await fastify.prisma.leaveRequest.delete({ where: { id } })
    return { success: true }
  })

  // POST /api/leave-requests/:id/cancel-request — 員工對已核准的假申請取消（待 admin 審核）
  fastify.post('/api/leave-requests/:id/cancel-request', {
    schema: { body: body({ cancelReason: strOrNull }) },
  }, async (request, reply) => {
    const { id } = request.params
    const { cancelReason } = request.body ?? {}

    const existing = await fastify.prisma.leaveRequest.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: '找不到該申請' })
    if (existing.userId !== request.user.id) return reply.code(403).send({ error: '無權操作此申請' })
    if (!canRequestCancel(existing)) {
      return reply.code(400).send({ error: '此申請目前無法申請取消' })
    }

    return fastify.prisma.leaveRequest.update({
      where: { id },
      data: {
        cancelRequested: true,
        cancelReason: cancelReason || null,
        cancelRequestedAt: new Date(),
      },
    })
  })

  // GET /api/leave-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD — 員工視角團隊行事曆（不含假別/理由）
  fastify.get('/api/leave-calendar', async (request, reply) => {
    const { from, to } = request.query
    if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
      return reply.code(400).send({ error: 'from / to 需為 YYYY-MM-DD' })
    }
    const fromD = dateStrToDate(from)
    const toD = dateStrToDate(to)
    // 區間上限 3 個月，避免大查詢
    if ((toD.getTime() - fromD.getTime()) > 1000 * 60 * 60 * 24 * 93) {
      return reply.code(400).send({ error: '查詢區間不可超過 3 個月' })
    }

    const user = await fastify.prisma.user.findUnique({ where: { id: request.user.id } })
    if (!user?.companyId) return reply.code(400).send({ error: '帳號未綁定公司' })

    const rows = await fastify.prisma.leaveRequest.findMany({
      where: {
        status: 'approved',
        user: { companyId: user.companyId },
        startDate: { lte: toD },
        endDate: { gte: fromD },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
        user: { select: { id: true, name: true } },
      },
    })
    return toCalendarEvents(rows, 'employee')
  })
}
