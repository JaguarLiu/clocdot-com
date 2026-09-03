import { listPendingForUser, decideStepByApprover } from '../services/approvalEngine.js'
import { body, str, strOrNull, bool } from '../utils/schema.js'

export default async function approvalRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate)

  // GET /api/approvals/pending — 目前登入者待簽清單
  fastify.get('/api/approvals/pending', async (request) => {
    return listPendingForUser(fastify.prisma, request.user.id)
  })

  // POST /api/approvals/:stepId/decide — { decision:'approve'|'reject', note?, confirm? }
  fastify.post('/api/approvals/:stepId/decide', {
    schema: { body: body({ decision: str, note: strOrNull, confirm: bool }) },
  }, async (request, reply) => {
    const { stepId } = request.params
    const { decision, note, confirm } = request.body || {}
    if (!['approve', 'reject'].includes(decision)) {
      return reply.code(400).send({ error: 'decision 必須為 approve 或 reject' })
    }
    const result = await decideStepByApprover(fastify.prisma, {
      stepId, userId: request.user.id, decision, note, confirm,
    })
    if (!result.ok) return reply.code(result.code).send(result.body)
    return result.body
  })
}
