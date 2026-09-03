import { clearLeaveFromAttendance } from '../../services/leaveApplication.js'
import { canReview, canDecideCancel } from '../../services/leaveTransitions.js'
import { toCalendarEvents } from '../../services/leaveCalendarView.js'
import {
  assertOwnedByCompany, reviewScopedByUser, reviewScopedByAttendanceUser, assertInScope,
} from '../../utils/tenant.js'
import { adminFinalize } from '../../services/approvalEngine.js'

export function registerReviewRoutes(fastify, S, { assembleOvertimeCompliance }) {
// PATCH /api/admin/correction-requests/:id
fastify.patch('/api/admin/correction-requests/:id', { preHandler: fastify.requireModule('corrections'), schema: { body: S.correctionReview } }, async (request, reply) => {
  const { id } = request.params
  const { status } = request.body

  const correction = await assertOwnedByCompany(
    (rid) => fastify.prisma.correctionRequest.findUnique({
      where: { id: rid },
      include: {
        attendance: { include: { user: { include: { company: true } } } },
      },
    }),
    id, request.companyId, reply,
    (rec) => rec.attendance?.user?.companyId,
  )
  if (!correction) return
  if (!assertInScope(request, correction.attendance.userId, reply)) return

  const decision = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : null
  if (!decision) return reply.code(400).send({ error: 'status 必須為 approved 或 rejected' })
  const result = await adminFinalize(fastify.prisma, {
    requestType: 'correction', requestId: id, decision, decidedById: request.user.id,
  })
  if (!result.ok) return reply.code(result.code).send(result.body)
  return result.body
})

// GET /api/admin/correction-requests
fastify.get('/api/admin/correction-requests', { preHandler: fastify.requireModule('corrections') }, async (request) => {
  const { status } = request.query
  return fastify.prisma.correctionRequest.findMany({
    where: reviewScopedByAttendanceUser(request, status ? { status } : {}),
    include: {
      attendance: {
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
})

// GET /api/admin/leave-requests?status=pending
fastify.get('/api/admin/leave-requests', { preHandler: fastify.requireModule('leaves') }, async (request) => {
  const { status } = request.query
  return fastify.prisma.leaveRequest.findMany({
    where: reviewScopedByUser(request, status ? { status } : {}),
    include: {
      user: { select: { id: true, email: true, name: true, empNo: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
})

// GET /api/admin/leave-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD — 全公司請假行事曆（含假別）
fastify.get('/api/admin/leave-calendar', { preHandler: fastify.requireModule('leaves') }, async (request, reply) => {
  const { from, to } = request.query
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) {
    return reply.code(400).send({ error: 'from / to 需為 YYYY-MM-DD' })
  }
  const fromD = new Date(`${from}T00:00:00Z`)
  const toD = new Date(`${to}T00:00:00Z`)
  const rows = await fastify.prisma.leaveRequest.findMany({
    where: reviewScopedByUser(request, {
      status: 'approved',
      startDate: { lte: toD },
      endDate: { gte: fromD },
    }),
    select: {
      userId: true,
      leaveType: true,
      startDate: true,
      startTime: true,
      endDate: true,
      endTime: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { startDate: 'asc' },
  })
  return toCalendarEvents(rows, 'admin')
})

// PATCH /api/admin/leave-requests/:id — 審核請假申請 / 取消決議
// body: { status?: 'approved'|'rejected', action?: 'confirm-cancel'|'reject-cancel', reviewNote?: string }
fastify.patch('/api/admin/leave-requests/:id', { preHandler: fastify.requireModule('leaves'), schema: { body: S.leaveReview } }, async (request, reply) => {
  const { id } = request.params
  const { status, action, reviewNote } = request.body ?? {}

  const isReview = ['approved', 'rejected'].includes(status)
  const isCancelDecision = ['confirm-cancel', 'reject-cancel'].includes(action)
  if (!isReview && !isCancelDecision) {
    return reply.code(400).send({ error: '需提供 status (approved/rejected) 或 action (confirm-cancel/reject-cancel)' })
  }

  const existing = await assertOwnedByCompany(
    (rid) => fastify.prisma.leaveRequest.findUnique({
      where: { id: rid },
      include: { user: { select: { companyId: true } } },
    }),
    id, request.companyId, reply,
    (rec) => rec.user?.companyId,
  )
  if (!existing) return
  if (!assertInScope(request, existing.userId, reply)) return

  const reviewMeta = {
    reviewNote: reviewNote || null,
    reviewedAt: new Date(),
    reviewerId: request.user.id,
  }

  // ── 取消決議分支 ──
  if (isCancelDecision) {
    if (!canDecideCancel(existing)) {
      return reply.code(400).send({ error: '此申請目前沒有待處理的取消請求' })
    }
    if (action === 'confirm-cancel') {
      const updated = await fastify.prisma.leaveRequest.update({
        where: { id },
        data: { status: 'cancelled', cancelRequested: false, ...reviewMeta },
      })
      // status 離開 approved ⇒ 餘額自動退還；同步清除考勤標記
      await clearLeaveFromAttendance(fastify.prisma, {
        userId: updated.userId,
        startDate: updated.startDate,
        endDate: updated.endDate,
        leaveType: updated.leaveType,
      })
      return updated
    }
    // reject-cancel：維持 approved，僅清旗標
    return fastify.prisma.leaveRequest.update({
      where: { id },
      data: { cancelRequested: false, ...reviewMeta },
    })
  }

  // ── 一般審核分支 (approve/reject) ──
  if (!canReview(existing)) {
    return reply.code(400).send({ error: '此申請已審核，無法重複審核' })
  }
  const decision = status === 'approved' ? 'approve' : 'reject'
  const result = await adminFinalize(fastify.prisma, {
    requestType: 'leave', requestId: id, decision, note: reviewNote, decidedById: request.user.id,
  })
  if (!result.ok) return reply.code(result.code).send(result.body)
  return result.body
})

// GET /api/admin/overtime-requests?status=pending
fastify.get('/api/admin/overtime-requests', { preHandler: fastify.requireModule('overtime-reviews') }, async (request) => {
  const { status } = request.query
  return fastify.prisma.overtimeRequest.findMany({
    where: reviewScopedByUser(request, status ? { status } : {}),
    include: {
      user: { select: { id: true, email: true, name: true, empNo: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
})

// GET /api/admin/compliance/overtime?month=YYYY-MM — 只回 warn / exceed 的員工
fastify.get('/api/admin/compliance/overtime', { preHandler: fastify.requireModule('overtime-reviews') }, async (request, reply) => {
  const { month } = request.query
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return reply.code(400).send({ error: 'month 需為 YYYY-MM 格式' })
  }
  const rows = await assembleOvertimeCompliance(request, month, { applyScope: true })
  return rows.filter((r) => r.status !== 'ok')
})

// PATCH /api/admin/overtime-requests/:id — 審核加班單（核准超月上限時 409 + confirm 重送）
fastify.patch('/api/admin/overtime-requests/:id', { preHandler: fastify.requireModule('overtime-reviews'), schema: { body: S.overtimeReview } }, async (request, reply) => {
  const { id } = request.params
  const { status, confirm } = request.body || {}

  if (!['approved', 'rejected'].includes(status)) {
    return reply.code(400).send({ error: 'status 必須為 approved 或 rejected' })
  }

  const existing = await assertOwnedByCompany(
    (rid) => fastify.prisma.overtimeRequest.findUnique({
      where: { id: rid },
      include: { user: { select: { companyId: true } } },
    }),
    id, request.companyId, reply,
    (rec) => rec.user?.companyId,
  )
  if (!existing) return
  if (!assertInScope(request, existing.userId, reply)) return

  if (existing.status === status) {
    return reply.code(400).send({ error: '此加班單已是該狀態，無需重複操作' })
  }

  const decision = status === 'approved' ? 'approve' : 'reject'
  const result = await adminFinalize(fastify.prisma, {
    requestType: 'overtime', requestId: id, decision, decidedById: request.user.id, confirm: confirm === true,
  })
  if (!result.ok) return reply.code(result.code).send(result.body)
  return result.body
})
}
