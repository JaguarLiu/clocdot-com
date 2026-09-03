import bcrypt from 'bcryptjs'
import { assertOwnedByCompany } from '../../utils/tenant.js'
import { buildBalances } from '../../services/leaveBalance.js'

const PASSWORD_MIN_LENGTH = 8
const BCRYPT_ROUNDS = 10

export function registerEmployeeAccessRoutes(fastify, S) {
// GET /api/admin/users/:id/leave-balances — 某員工的各假別餘額
fastify.get('/api/admin/users/:id/leave-balances', { preHandler: fastify.requireModule('employees') }, async (request, reply) => {
  const { id } = request.params
  const target = await assertOwnedByCompany(
    (uid) => fastify.prisma.user.findUnique({
      where: { id: uid },
      include: { company: true },
    }),
    id, request.companyId, reply,
    (rec) => rec.companyId,
  )
  if (!target) return

  const policies = await fastify.prisma.leavePolicy.findMany({
    where: { companyId: request.companyId },
  })

  return buildBalances(fastify.prisma, { user: target, company: target.company, policies })
})

// POST /api/admin/users/:id/unlock — 解鎖帳號並重置失敗計數
fastify.post('/api/admin/users/:id/unlock', { preHandler: fastify.requireModule('employees') }, async (request, reply) => {
  const { id } = request.params
  const target = await assertOwnedByCompany(
    (uid) => fastify.prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, companyId: true },
    }),
    id, request.companyId, reply,
    (rec) => rec.companyId,
  )
  if (!target) return

  return fastify.prisma.user.update({
    where: { id },
    data: { failedLoginCount: 0, lockedAt: null },
    select: { id: true, email: true, failedLoginCount: true, lockedAt: true },
  })
})

// PUT /api/admin/users/:id/password — 管理員設/重設使用者密碼
fastify.put('/api/admin/users/:id/password', { preHandler: fastify.requireModule('employees'), schema: { body: S.passwordSet } }, async (request, reply) => {
  const { id } = request.params
  const { password } = request.body || {}

  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return reply.code(400).send({ error: `密碼長度至少 ${PASSWORD_MIN_LENGTH} 碼` })
  }

  const target = await assertOwnedByCompany(
    (uid) => fastify.prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, companyId: true },
    }),
    id, request.companyId, reply,
    (rec) => rec.companyId,
  )
  if (!target) return

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  await fastify.prisma.user.update({
    where: { id },
    data: { password: hash, failedLoginCount: 0, lockedAt: null },
  })
  return { ok: true }
})

}
