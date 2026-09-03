import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { assertOwnedByCompany } from '../../utils/tenant.js'
import { validateImportRows, IMPORT_MAX_ROWS } from '../../services/userImport.js'
import { normalizeDepartmentName } from '../../services/orgChart.js'
import { parseRoleId } from '../../services/rbac.js'
import { p2002HasField } from '../../utils/prismaError.js'

const PASSWORD_MIN_LENGTH = 8
const BCRYPT_ROUNDS = 10
const EMPLOYMENT_TYPES = ['regular', 'operation', 'parttime']

export function registerEmployeeRoutes(fastify, S) {
// GET /api/admin/users — 列出本公司員工 (排除軟刪除)
fastify.get('/api/admin/users', { preHandler: fastify.requireModule('employees') }, async (request) => {
  const rows = await fastify.prisma.user.findMany({
    where: { companyId: request.companyId, deletedAt: null },
    omit: { password: false }, // opt-in 為了判斷 hasPassword，下方不外洩 hash
    include: {
      department: { select: { name: true } },
      rbacRole: { select: { name: true, isAdmin: true } },
      defaultShift: { select: { id: true, name: true } },
    },
    orderBy: [{ empNo: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    empNo: u.empNo,
    avatar: u.avatar,
    timezone: u.timezone,
    lockedAt: u.lockedAt,
    failedLoginCount: u.failedLoginCount,
    hireDate: u.hireDate,
    createdAt: u.createdAt,
    hasPassword: Boolean(u.password),
    departmentId: u.departmentId,
    departmentName: u.department?.name ?? null,
    roleId: u.roleId,
    roleName: u.rbacRole?.name ?? null,
    isAdmin: u.rbacRole?.isAdmin === true,
    defaultShiftId: u.defaultShiftId,
    defaultShiftName: u.defaultShift?.name ?? null,
    employmentType: u.employmentType,
  }))
})

// POST /api/admin/users — 建立員工
fastify.post('/api/admin/users', { preHandler: fastify.requireModule('employees'), schema: { body: S.userCreate } }, async (request, reply) => {
  const { email, name, empNo, timezone, password, hireDate, departmentId, roleId, employmentType } = request.body || {}

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply.code(400).send({ error: 'email 格式錯誤' })
  }
  if (employmentType !== undefined && !EMPLOYMENT_TYPES.includes(employmentType)) {
    return reply.code(400).send({ error: 'employmentType 只接受 regular / operation / parttime' })
  }
  if (empNo !== undefined && empNo !== null && !Number.isInteger(empNo)) {
    return reply.code(400).send({ error: 'empNo 必須為整數' })
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return reply.code(400).send({ error: `密碼為必填，長度至少 ${PASSWORD_MIN_LENGTH} 碼` })
  }
  if (departmentId && !(await deptBelongs(departmentId, request.companyId))) {
    return reply.code(400).send({ error: '部門不存在' })
  }
  let resolvedRoleId
  if (roleId !== undefined && roleId !== null && roleId !== '') {
    if (!request.isAdmin) return reply.code(403).send({ error: '只有管理員可指派角色' })
    resolvedRoleId = parseRoleId(roleId)
    if (resolvedRoleId === undefined) return reply.code(400).send({ error: '角色 id 不正確' })
    const r = await fastify.prisma.role.findFirst({
      where: { id: resolvedRoleId, companyId: request.companyId },
      select: { id: true, isAdmin: true, departmentId: true },
    })
    if (!r) return reply.code(400).send({ error: '角色不存在' })
    if (!r.isAdmin && departmentId && r.departmentId !== departmentId) {
      return reply.code(400).send({ error: '角色與部門不符' })
    }
  }

  const companyDefaultShift = await fastify.prisma.shift.findFirst({
    where: { companyId: request.companyId, isDefault: true, deletedAt: null },
    select: { id: true },
  })

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  try {
    const user = await fastify.prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        empNo: empNo ?? null,
        companyId: request.companyId,
        ...(departmentId ? { departmentId } : {}),
        ...(resolvedRoleId ? { roleId: resolvedRoleId } : {}),
        ...(timezone ? { timezone } : {}),
        ...(companyDefaultShift ? { defaultShiftId: companyDefaultShift.id } : {}),
        ...(employmentType ? { employmentType } : {}),
        password: hash,
        ...(hireDate ? { hireDate: new Date(hireDate) } : {}),
      },
      select: {
        id: true, email: true, name: true, empNo: true, avatar: true,
        timezone: true, lockedAt: true, failedLoginCount: true,
        createdAt: true,
      },
    })
    return { ...user, hasPassword: Boolean(hash) }
  } catch (err) {
    if (err?.code === 'P2002') {
      return reply.code(409).send({ error: p2002HasField(err, 'empNo') ? '員工編號已被使用' : 'email 已被使用' })
    }
    throw err
  }
})

// 產生 12 碼安全亂數初始密碼（url-safe）
function genInitialPassword() {
  return crypto.randomBytes(9).toString('base64url')
}

// 查詢 rows 內的 email / empNo 在 DB 是否已存在（email/empNo 為全域唯一）
async function fetchImportConflicts(rows) {
  const emails = [...new Set(
    rows.map((r) => (typeof r?.email === 'string' ? r.email.trim().toLowerCase() : null)).filter(Boolean),
  )]
  const empNos = [...new Set(
    rows.map((r) => {
      const s = r?.empNo
      if (typeof s === 'number') return Number.isInteger(s) ? s : null
      if (typeof s === 'string' && /^\d+$/.test(s.trim())) return Number(s.trim())
      return null
    }).filter((n) => n !== null),
  )]
  const [byEmail, byEmpNo] = await Promise.all([
    emails.length ? fastify.prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } }) : [],
    empNos.length ? fastify.prisma.user.findMany({ where: { empNo: { in: empNos } }, select: { empNo: true } }) : [],
  ])
  return {
    existingEmails: new Set(byEmail.map((u) => u.email)),
    existingEmpNos: new Set(byEmpNo.map((u) => u.empNo)),
  }
}

function validateImportBody(rows, reply) {
  if (!Array.isArray(rows)) { reply.code(400).send({ error: 'rows 必須為陣列' }); return false }
  if (rows.length === 0) { reply.code(400).send({ error: '沒有可匯入的資料列' }); return false }
  if (rows.length > IMPORT_MAX_ROWS) { reply.code(400).send({ error: `一次最多匯入 ${IMPORT_MAX_ROWS} 列` }); return false }
  return true
}

// POST /api/admin/users/import/preview — 驗證但不寫入
fastify.post('/api/admin/users/import/preview', { preHandler: fastify.requireModule('employees'), schema: { body: S.userImport } }, async (request, reply) => {
  const rows = request.body?.rows
  if (!validateImportBody(rows, reply)) return
  const conflicts = await fetchImportConflicts(rows)
  return validateImportRows(rows, conflicts)
})

// POST /api/admin/users/import — 全有或全無建立
fastify.post('/api/admin/users/import', { preHandler: fastify.requireModule('employees'), schema: { body: S.userImport } }, async (request, reply) => {
  const rows = request.body?.rows
  if (!validateImportBody(rows, reply)) return
  const conflicts = await fetchImportConflicts(rows)
  const { valid, errors } = validateImportRows(rows, conflicts)
  if (errors.length > 0) return reply.code(400).send({ errors })

  const companyDefaultShift = await fastify.prisma.shift.findFirst({
    where: { companyId: request.companyId, isDefault: true, deletedAt: null },
    select: { id: true },
  })

  const prepared = await Promise.all(valid.map(async (v) => {
    const password = genInitialPassword()
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    return { ...v, password, hash }
  }))

  try {
    const created = await fastify.prisma.$transaction(
      prepared.map((v) => fastify.prisma.user.create({
        data: {
          email: v.email,
          name: v.name,
          empNo: v.empNo,
          companyId: request.companyId,
          password: v.hash,
          ...(companyDefaultShift ? { defaultShiftId: companyDefaultShift.id } : {}),
          ...(v.hireDate ? { hireDate: new Date(v.hireDate) } : {}),
          ...(v.salaryProfile ? { salaryProfile: { create: v.salaryProfile } } : {}),
        },
        select: { id: true, email: true, name: true, empNo: true },
      })),
    )
    return { created: created.map((u, i) => ({ ...u, password: prepared[i].password })) }
  } catch (err) {
    if (err?.code === 'P2002') {
      return reply.code(409).send({ error: p2002HasField(err, 'empNo') ? '員工編號已被使用' : 'email 已被使用' })
    }
    throw err
  }
})

// PATCH /api/admin/users/:id — 修改員工 (禁止改自己的 role)
fastify.patch('/api/admin/users/:id', { preHandler: fastify.requireModule('employees'), schema: { body: S.userPatch } }, async (request, reply) => {
  const { id } = request.params
  const target = await assertOwnedByCompany(
    (uid) => fastify.prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, companyId: true, deletedAt: true, departmentId: true },
    }),
    id, request.companyId, reply,
    (rec) => rec.companyId,
  )
  if (!target) return
  if (target.deletedAt) return reply.code(404).send({ error: '找不到資料' })

  const { name, empNo, timezone, hireDate, departmentId, roleId, defaultShiftId, employmentType } = request.body || {}
  const data = {}

  if (name !== undefined) data.name = name?.trim() || null
  if (empNo !== undefined) {
    if (empNo !== null && !Number.isInteger(empNo)) {
      return reply.code(400).send({ error: 'empNo 必須為整數' })
    }
    data.empNo = empNo
  }
  if (timezone !== undefined) data.timezone = timezone
  if (hireDate !== undefined) {
    data.hireDate = hireDate ? new Date(hireDate) : null
  }
  if (departmentId !== undefined) {
    if (departmentId && !(await deptBelongs(departmentId, request.companyId))) {
      return reply.code(400).send({ error: '部門不存在' })
    }
    data.departmentId = departmentId || null
  }
  if (roleId !== undefined) {
    if (!request.isAdmin) return reply.code(403).send({ error: '只有管理員可指派角色' })
    if (id === request.user.id) return reply.code(403).send({ error: '不能修改自己的角色' })
    const parsed = parseRoleId(roleId)
    if (parsed === undefined) return reply.code(400).send({ error: '角色 id 不正確' })
    if (parsed !== null) {
      const targetDept = data.departmentId !== undefined ? data.departmentId : target.departmentId
      const r = await fastify.prisma.role.findFirst({
        where: { id: parsed, companyId: request.companyId },
        select: { id: true, isAdmin: true, departmentId: true },
      })
      if (!r) return reply.code(400).send({ error: '角色不存在' })
      if (!r.isAdmin && targetDept && r.departmentId !== targetDept) {
        return reply.code(400).send({ error: '角色與部門不符' })
      }
    }
    data.roleId = parsed
  }
  if (defaultShiftId !== undefined) {
    if (defaultShiftId) {
      const s = await fastify.prisma.shift.findFirst({
        where: { id: defaultShiftId, companyId: request.companyId, deletedAt: null },
        select: { id: true },
      })
      if (!s) return reply.code(400).send({ error: '班別不存在' })
    }
    data.defaultShiftId = defaultShiftId || null
  }
  if (employmentType !== undefined) {
    if (!EMPLOYMENT_TYPES.includes(employmentType)) {
      return reply.code(400).send({ error: 'employmentType 只接受 regular / operation / parttime' })
    }
    data.employmentType = employmentType
  }

  try {
    const updated = await fastify.prisma.$transaction(async (tx) => {
      // 改為正常班 → 清除今天以後的排班指派（殘留指派會蓋過預設班判定）；過去指派保留
      if (data.employmentType === 'regular') {
        await tx.shiftAssignment.deleteMany({
          where: { userId: id, date: { gte: getTodayStart() } },
        })
      }
      return tx.user.update({
        where: { id },
        data,
        select: {
          id: true, email: true, name: true, empNo: true, avatar: true,
          timezone: true, lockedAt: true, failedLoginCount: true,
          createdAt: true,
        },
      })
    })
    return updated
  } catch (err) {
    if (err?.code === 'P2002' && p2002HasField(err, 'empNo')) {
      return reply.code(409).send({ error: '員工編號已被使用' })
    }
    throw err
  }
})

// 驗證某 user / department 屬於本公司（null 視為通過 = 清空）
async function deptUserBelongs(userId, companyId) {
  if (!userId) return true
  const u = await fastify.prisma.user.findFirst({
    where: { id: userId, companyId, deletedAt: null }, select: { id: true },
  })
  return Boolean(u)
}
async function deptBelongs(deptId, companyId) {
  if (!deptId) return true
  const d = await fastify.prisma.department.findFirst({
    where: { id: deptId, companyId }, select: { id: true },
  })
  return Boolean(d)
}

async function companyAdminRoleId(companyId) {
  const r = await fastify.prisma.role.findFirst({ where: { companyId, isAdmin: true }, select: { id: true } })
  return r?.id ?? null
}

function serializeDept(d) {
  return {
    id: d.id, name: d.name, parentId: d.parentId,
    managerId: d.managerId, managerName: d.manager?.name ?? null,
    memberCount: d._count?.members ?? 0,
  }
}
const DEPT_INCLUDE = {
  manager: { select: { id: true, name: true } },
  _count: { select: { members: true } },
}

  return { deptUserBelongs, deptBelongs, companyAdminRoleId, serializeDept, DEPT_INCLUDE }
}
