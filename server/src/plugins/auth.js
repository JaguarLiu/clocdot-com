import fp from 'fastify-plugin'
import { canAccessModule, GRANTABLE_MODULES } from '../services/rbac.js'
import { descendantDeptIds } from '../services/orgScope.js'

export default fp(async function authPlugin(fastify) {
  // fail-fast：JWT_SECRET 未設定（或仍是 repo 內曾公開的預設字串）時拒絕啟動，
  // 避免生產環境漏設變數後以可偽造的 secret 對外服務
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret || jwtSecret === 'dev-secret-change-in-production') {
    fastify.log.fatal('JWT_SECRET 未設定或使用預設值，拒絕啟動。請在環境變數提供隨機 secret。')
    process.exit(1)
  }

  fastify.register(import('@fastify/jwt'), {
    secret: jwtSecret,
    sign: { expiresIn: '1d' },
  })

  // JWT 驗證 — 只有這段放 try/catch，其他 DB / 業務錯誤往外丟交給 fastify error handler (→500)
  async function verifyJwt(request, reply) {
    try {
      await request.jwtVerify()
      return true
    } catch {
      reply.code(401).send({ error: 'Unauthorized' })
      return false
    }
  }

  const USER_STATUS_TTL_SECONDS = 60
  const userStatusKey = (id) => `user:active:${id}`

  // 帳號狀態檢查 — 停用（deletedAt）帳號的 token 立即失效，不等 JWT 過期。
  // Redis cache 60s 頂 QPS；Redis 不可用時 graceful degrade 成每請求查一次 DB（PK 查詢）
  async function ensureActiveUser(request, reply) {
    const id = request.user.id
    const key = userStatusKey(id)
    if (fastify.redis) {
      try {
        if ((await fastify.redis.get(key)) === '1') return true
      } catch { /* degrade → DB */ }
    }
    const u = await fastify.prisma.user.findUnique({
      where: { id },
      select: { deletedAt: true },
    })
    if (!u || u.deletedAt) {
      reply.code(401).send({ error: '帳號已停用' })
      return false
    }
    if (fastify.redis) {
      try { await fastify.redis.set(key, '1', 'EX', USER_STATUS_TTL_SECONDS) } catch { /* noop */ }
    }
    return true
  }

  fastify.decorate('authenticate', async function (request, reply) {
    if (!(await verifyJwt(request, reply))) return
    await ensureActiveUser(request, reply)
  })

  // 停用帳號當下呼叫，清掉 active cache → 該使用者的 token 下一個請求即失效
  fastify.decorate('revokeUserStatus', async function (userId) {
    if (!fastify.redis) return
    try { await fastify.redis.del(userStatusKey(userId)) } catch { /* noop */ }
  })

  // 後台存取：admin 或「有指派部門角色」者
  fastify.decorate('requirePanel', async function (request, reply) {
    if (!(await verifyJwt(request, reply))) return

    const u = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        companyId: true, deletedAt: true, roleId: true, departmentId: true,
        rbacRole: { select: { isAdmin: true, permissions: true } },
      },
    })
    if (!u || u.deletedAt) return reply.code(401).send({ error: '帳號已停用' })
    if (!u.companyId) return reply.code(400).send({ error: '帳號未綁定公司' })

    const isAdmin = u.rbacRole?.isAdmin === true
    if (!isAdmin && !u.roleId) return reply.code(403).send({ error: 'Forbidden' })

    request.companyId = u.companyId
    request.isAdmin = isAdmin
    request.permissions = isAdmin ? [...GRANTABLE_MODULES] : (u.rbacRole?.permissions ?? [])

    if (!isAdmin) {
      const depts = await fastify.prisma.department.findMany({
        where: { companyId: u.companyId }, select: { id: true, parentId: true },
      })
      const deptIds = descendantDeptIds(depts, u.departmentId ?? null)
      const members = deptIds.size
        ? await fastify.prisma.user.findMany({
          where: { companyId: u.companyId, departmentId: { in: [...deptIds] } },
          select: { id: true },
        })
        : []
      const ids = new Set(members.map((m) => m.id))
      ids.add(request.user.id) // 一定含本人
      request.scopeUserIds = [...ids]
    }
    // admin：request.scopeUserIds 維持 undefined（不限）
  })

  // 路由模組守門 factory（須在 requirePanel 之後執行）
  fastify.decorate('requireModule', function (key) {
    return async function (request, reply) {
      if (canAccessModule({ isAdmin: request.isAdmin, permissions: request.permissions }, key)) return
      return reply.code(403).send({ error: 'Forbidden' })
    }
  })
})
