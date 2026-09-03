export function registerIssueRoutes(fastify, S) {
// POST /api/admin/issues — 問題回報（reporterId / companyId 由後端填）
fastify.post('/api/admin/issues', { schema: { body: S.issues } }, async (request, reply) => {
  const { title, type, description } = request.body || {}

  const t = typeof title === 'string' ? title.trim() : ''
  const d = typeof description === 'string' ? description.trim() : ''
  if (!t || !d) {
    return reply.code(400).send({ error: '標題與描述為必填' })
  }
  if (type !== 'bug' && type !== 'feature') {
    return reply.code(400).send({ error: '種類只能是 bug 或 feature' })
  }

  const issue = await fastify.prisma.issue.create({
    data: {
      title: t,
      type,
      description: d,
      reporterId: request.user.id,
      companyId: request.companyId,
    },
    select: { id: true },
  })
  return { id: issue.id }
})
}
