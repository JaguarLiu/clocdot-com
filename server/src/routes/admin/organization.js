import { wouldCreateCycle, normalizeDepartmentName } from '../../services/orgChart.js'
import { normalizePermissions } from '../../services/rbac.js'
import { assertOwnedByCompany } from '../../utils/tenant.js'

export function registerOrganizationRoutes(fastify, S, {
  deptUserBelongs,
  deptBelongs,
  companyAdminRoleId,
  serializeDept,
  DEPT_INCLUDE,
}) {
// GET /api/admin/departments — 扁平列（client 自行組樹）
fastify.get('/api/admin/departments', async (request) => {
  const rows = await fastify.prisma.department.findMany({
    where: { companyId: request.companyId },
    include: DEPT_INCLUDE,
    orderBy: { name: 'asc' },
  })
  return rows.map(serializeDept)
})

// POST /api/admin/departments
fastify.post('/api/admin/departments', { preHandler: fastify.requireModule('settings'), schema: { body: S.department } }, async (request, reply) => {
  const { name, parentId, managerId } = request.body || {}
  const nameRes = normalizeDepartmentName(name)
  if (!nameRes.ok) return reply.code(400).send({ error: nameRes.error })
  if (parentId && !(await deptBelongs(parentId, request.companyId))) {
    return reply.code(400).send({ error: '上層部門不存在' })
  }
  if (managerId && !(await deptUserBelongs(managerId, request.companyId))) {
    return reply.code(400).send({ error: '主管不存在' })
  }
  const d = await fastify.prisma.department.create({
    data: {
      name: nameRes.value,
      companyId: request.companyId,
      parentId: parentId || null,
      managerId: managerId || null,
    },
    include: DEPT_INCLUDE,
  })
  return serializeDept(d)
})

// PATCH /api/admin/departments/:id
fastify.patch('/api/admin/departments/:id', { preHandler: fastify.requireModule('settings'), schema: { body: S.department } }, async (request, reply) => {
  const { id } = request.params
  const target = await assertOwnedByCompany(
    (did) => fastify.prisma.department.findUnique({ where: { id: did }, select: { id: true, companyId: true } }),
    id, request.companyId, reply, (rec) => rec.companyId,
  )
  if (!target) return
  const { name, parentId, managerId } = request.body || {}
  const data = {}
  if (name !== undefined) {
    const nameRes = normalizeDepartmentName(name)
    if (!nameRes.ok) return reply.code(400).send({ error: nameRes.error })
    data.name = nameRes.value
  }
  if (parentId !== undefined) {
    if (parentId) {
      if (!(await deptBelongs(parentId, request.companyId))) {
        return reply.code(400).send({ error: '上層部門不存在' })
      }
      const all = await fastify.prisma.department.findMany({
        where: { companyId: request.companyId }, select: { id: true, parentId: true },
      })
      if (wouldCreateCycle(all, id, parentId)) {
        return reply.code(400).send({ error: '不可將部門設為自己或子部門的下層' })
      }
    }
    data.parentId = parentId || null
  }
  if (managerId !== undefined) {
    if (managerId && !(await deptUserBelongs(managerId, request.companyId))) {
      return reply.code(400).send({ error: '主管不存在' })
    }
    data.managerId = managerId || null
  }
  const d = await fastify.prisma.department.update({ where: { id }, data, include: DEPT_INCLUDE })
  return serializeDept(d)
})

// DELETE /api/admin/departments/:id — 有子部門或成員則擋下
fastify.delete('/api/admin/departments/:id', { preHandler: fastify.requireModule('settings') }, async (request, reply) => {
  const { id } = request.params
  const target = await assertOwnedByCompany(
    (did) => fastify.prisma.department.findUnique({ where: { id: did }, select: { id: true, companyId: true } }),
    id, request.companyId, reply, (rec) => rec.companyId,
  )
  if (!target) return
  const [childCount, memberCount] = await Promise.all([
    fastify.prisma.department.count({ where: { parentId: id } }),
    fastify.prisma.user.count({ where: { departmentId: id } }),
  ])
  if (childCount > 0 || memberCount > 0) {
    return reply.code(400).send({ error: '請先移動子部門與成員後再刪除' })
  }
  await fastify.prisma.department.delete({ where: { id } })
  return { ok: true }
})

// GET 某部門的角色（settings = admin 專屬）
fastify.get('/api/admin/departments/:deptId/roles', { preHandler: fastify.requireModule('settings') }, async (request, reply) => {
  const { deptId } = request.params
  const dept = await assertOwnedByCompany(
    (did) => fastify.prisma.department.findUnique({ where: { id: did }, select: { id: true, companyId: true } }),
    deptId, request.companyId, reply, (r) => r.companyId,
  )
  if (!dept) return
  const rows = await fastify.prisma.role.findMany({
    where: { departmentId: deptId },
    include: { _count: { select: { members: true } } },
    orderBy: { name: 'asc' },
  })
  return rows.map((r) => ({ id: r.id, name: r.name, permissions: r.permissions, departmentId: r.departmentId, memberCount: r._count.members }))
})

// POST 建立角色
fastify.post('/api/admin/departments/:deptId/roles', { preHandler: fastify.requireModule('settings'), schema: { body: S.roleCreate } }, async (request, reply) => {
  const { deptId } = request.params
  const dept = await assertOwnedByCompany(
    (did) => fastify.prisma.department.findUnique({ where: { id: did }, select: { id: true, companyId: true } }),
    deptId, request.companyId, reply, (r) => r.companyId,
  )
  if (!dept) return
  if (request.body?.isAdmin) return reply.code(400).send({ error: '不可透過此端點建立管理員角色' })
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
  if (!name) return reply.code(400).send({ error: '角色名稱不可為空' })
  const permissions = normalizePermissions(request.body?.permissions)
  try {
    const r = await fastify.prisma.role.create({
      data: { companyId: request.companyId, departmentId: deptId, name, permissions },
    })
    return { id: r.id, name: r.name, permissions: r.permissions, departmentId: r.departmentId, memberCount: 0 }
  } catch (err) {
    if (err?.code === 'P2002') return reply.code(409).send({ error: '此部門已有同名角色' })
    throw err
  }
})

// PATCH 角色
fastify.patch('/api/admin/roles/:id', { preHandler: fastify.requireModule('settings'), schema: { body: S.rolePatch } }, async (request, reply) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id)) return reply.code(400).send({ error: '角色 id 不正確' })
  const role = await assertOwnedByCompany(
    (rid) => fastify.prisma.role.findUnique({ where: { id: rid }, select: { id: true, companyId: true, isAdmin: true } }),
    id, request.companyId, reply, (r) => r.companyId,
  )
  if (!role) return
  if (role.isAdmin) return reply.code(400).send({ error: 'Admin 角色不可修改' })
  const data = {}
  if (request.body?.name !== undefined) {
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
    if (!name) return reply.code(400).send({ error: '角色名稱不可為空' })
    data.name = name
  }
  if (request.body?.permissions !== undefined) data.permissions = normalizePermissions(request.body.permissions)
  try {
    const r = await fastify.prisma.role.update({ where: { id }, data })
    return { id: r.id, name: r.name, permissions: r.permissions, departmentId: r.departmentId }
  } catch (err) {
    if (err?.code === 'P2002') return reply.code(409).send({ error: '此部門已有同名角色' })
    throw err
  }
})

// DELETE 角色（有成員擋下）
fastify.delete('/api/admin/roles/:id', { preHandler: fastify.requireModule('settings') }, async (request, reply) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id)) return reply.code(400).send({ error: '角色 id 不正確' })
  const role = await assertOwnedByCompany(
    (rid) => fastify.prisma.role.findUnique({ where: { id: rid }, select: { id: true, companyId: true, isAdmin: true } }),
    id, request.companyId, reply, (r) => r.companyId,
  )
  if (!role) return
  if (role.isAdmin) return reply.code(400).send({ error: 'Admin 角色不可刪除' })
  const memberCount = await fastify.prisma.user.count({ where: { roleId: id } })
  if (memberCount > 0) return reply.code(400).send({ error: '此角色仍有成員，請先移除指派' })
  await fastify.prisma.role.delete({ where: { id } })
  return { ok: true }
})

// DELETE /api/admin/users/:id — 軟刪除 (保留歷史紀錄)
fastify.delete('/api/admin/users/:id', { preHandler: fastify.requireModule('employees') }, async (request, reply) => {
  const { id } = request.params
  if (id === request.user.id) {
    return reply.code(403).send({ error: '不能刪除自己的帳號' })
  }

  const target = await assertOwnedByCompany(
    (uid) => fastify.prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, companyId: true, deletedAt: true },
    }),
    id, request.companyId, reply,
    (rec) => rec.companyId,
  )
  if (!target || target.deletedAt) {
    if (target?.deletedAt) reply.code(404).send({ error: '找不到資料' })
    return
  }

  await fastify.prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
  // 清 active cache，讓該員工既有 token 立即失效（P1-3）
  await fastify.revokeUserStatus(id)
  return { ok: true }
})

}
