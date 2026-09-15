import { EMPLOYEE_VISIBLE_ACTIONS, employeeActivityActions, resolvePageLimit, toEmployeeEvent } from '../services/audit.js'
import { buildRequestProgress, PROGRESS_REQUEST_TYPES } from '../services/requestProgress.js'

// 員工端：自己的操作／被操作紀錄、申請簽核進度
export default async function activityRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate)

  async function namesFor(ids) {
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) return {}
    const users = await fastify.prisma.user.findMany({
      where: { id: { in: unique } }, select: { id: true, name: true },
    })
    return Object.fromEntries(users.map((u) => [u.id, u.name]))
  }

  // GET /api/my/activity?category&cursor&limit — 與我有關的紀錄（由新到舊）
  // category：attendance | request | account，省略為全部
  fastify.get('/api/my/activity', async (request) => {
    const limit = resolvePageLimit(request.query.limit)
    const cursor = typeof request.query.cursor === 'string' && request.query.cursor ? request.query.cursor : null
    const rows = await fastify.prisma.auditLog.findMany({
      where: { targetUserId: request.user.id, action: { in: employeeActivityActions(request.query.category) } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const namesById = await namesFor(page.map((r) => r.actorId))
    return {
      items: page.map((r) => toEmployeeEvent(r, namesById)),
      nextCursor: hasMore ? page.at(-1).id : null,
    }
  })

  // GET /api/requests/:type/:id/progress — 自己某筆申請的簽核進度 + 時間軸
  fastify.get('/api/requests/:type/:id/progress', async (request, reply) => {
    const { type, id } = request.params
    if (!PROGRESS_REQUEST_TYPES.includes(type)) return reply.code(404).send({ error: '找不到資料' })

    let row = null
    let ownerId = null
    if (type === 'leave') {
      row = await fastify.prisma.leaveRequest.findUnique({
        where: { id }, select: { userId: true, status: true, cancelRequested: true },
      })
      ownerId = row?.userId
    } else if (type === 'overtime') {
      row = await fastify.prisma.overtimeRequest.findUnique({ where: { id }, select: { userId: true, status: true } })
      ownerId = row?.userId
    } else {
      row = await fastify.prisma.correctionRequest.findUnique({
        where: { id }, select: { status: true, attendance: { select: { userId: true } } },
      })
      ownerId = row?.attendance?.userId
    }
    if (row && ownerId !== request.user.id) return reply.code(404).send({ error: '找不到資料' })

    const events = await fastify.prisma.auditLog.findMany({
      where: {
        entityType: type, entityId: id, targetUserId: request.user.id,
        action: { in: EMPLOYEE_VISIBLE_ACTIONS },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    // 申請列不存在（例如已撤回刪除）→ 只有本人留有事件才回時間軸
    if (!row && events.length === 0) return reply.code(404).send({ error: '找不到資料' })

    const steps = row
      ? await fastify.prisma.approvalStep.findMany({ where: { requestType: type, requestId: id } })
      : []
    const namesById = await namesFor([
      ...steps.flatMap((s) => [s.approverId, s.decidedById]),
      ...events.map((e) => e.actorId),
    ])
    return buildRequestProgress({ requestType: type, requestId: id, request: row, steps, events, namesById })
  })
}
