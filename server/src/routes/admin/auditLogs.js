import { buildAdminAuditWhere, resolvePageLimit } from '../../services/audit.js'

export function registerAuditLogRoutes(fastify) {
// GET /api/admin/audit-logs?from&to&actorId&targetUserId&action&entityType&entityId&cursor&limit
// 由新到舊；cursor 為上一頁最後一筆的 id
fastify.get('/api/admin/audit-logs', { preHandler: fastify.requireModule('audit-log') }, async (request, reply) => {
  const built = buildAdminAuditWhere(
    { companyId: request.companyId, scopeUserIds: request.scopeUserIds },
    request.query,
  )
  if (!built.ok) return reply.code(400).send({ error: built.error })

  const limit = resolvePageLimit(request.query.limit)
  const cursor = typeof request.query.cursor === 'string' && request.query.cursor ? request.query.cursor : null
  const rows = await fastify.prisma.auditLog.findMany({
    where: built.where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const userIds = [...new Set(page.flatMap((r) => [r.actorId, r.targetUserId]).filter(Boolean))]
  const users = userIds.length === 0 ? [] : await fastify.prisma.user.findMany({
    where: { id: { in: userIds }, companyId: request.companyId },
    select: { id: true, name: true, empNo: true, email: true },
  })
  const userById = Object.fromEntries(users.map((u) => [u.id, u]))

  return {
    items: page.map((r) => ({
      ...r,
      actor: r.actorId ? (userById[r.actorId] ?? { id: r.actorId }) : null,
      target: r.targetUserId ? (userById[r.targetUserId] ?? { id: r.targetUserId }) : null,
    })),
    nextCursor: hasMore ? page.at(-1).id : null,
  }
})
}
