import { validateShiftPayload } from '../services/schedule.js'
import { evaluateScheduleCompliance, dayIndex } from '../services/scheduleCompliance.js'
import { getTodayStart, dateStrToDate } from '../utils/timezone.js'
import { body, str, int, bool, anyArray } from '../utils/schema.js'

const shiftBodySchema = body({
  name: str, startTime: str, endTime: str, breakMinutes: int, isDefault: bool,
})

const SHIFT_SELECT = { id: true, name: true, startTime: true, endTime: true, breakMinutes: true, isDefault: true }

// 存排班前組裝資料並跑法規檢核（七休一 / 輪班間隔）。
// 「工作日」＝該日有明確 ShiftAssignment（不計 defaultShift）；只回報牽涉本次變更日的違規。
const COMPLIANCE_WINDOW_DAYS = 7 // 往前後各撈 7 天，確保能看見跨越變更日的完整連續區段
const DAY_MS = 24 * 60 * 60 * 1000

async function evaluateScheduleChanges(prisma, { changes, okUsers, shiftTimeById }) {
  const nameById = new Map(okUsers.map((u) => [u.id, u.name || u.empNo || '員工']))
  const pendingByUser = new Map()
  for (const c of changes) {
    if (!pendingByUser.has(c.userId)) pendingByUser.set(c.userId, new Map())
    pendingByUser.get(c.userId).set(c.date, c.shiftId) // shiftId | null
  }

  const allIdx = changes.map((c) => dayIndex(c.date))
  const windowStart = new Date((Math.min(...allIdx) - COMPLIANCE_WINDOW_DAYS) * DAY_MS)
  const windowEnd = new Date((Math.max(...allIdx) + COMPLIANCE_WINDOW_DAYS + 1) * DAY_MS)

  const userIds = [...pendingByUser.keys()]
  const existing = await prisma.shiftAssignment.findMany({
    where: { userId: { in: userIds }, date: { gte: windowStart, lt: windowEnd } },
    select: { userId: true, date: true, shift: { select: { startTime: true, endTime: true } } },
  })
  const existingByUser = new Map()
  for (const a of existing) {
    if (!existingByUser.has(a.userId)) existingByUser.set(a.userId, new Map())
    existingByUser.get(a.userId).set(dayIndex(a.date.toISOString().slice(0, 10)), a.shift)
  }

  const userSchedules = userIds.map((userId) => {
    const worked = new Map(existingByUser.get(userId) ?? []) // idx → {startTime,endTime}
    const changed = new Set()
    for (const [dateStr, shiftId] of pendingByUser.get(userId)) {
      const idx = dayIndex(dateStr)
      if (shiftId === null) { worked.delete(idx); continue }
      worked.set(idx, shiftTimeById.get(shiftId))
      changed.add(idx)
    }
    return { userId, userName: nameById.get(userId), worked, changed }
  })
  return evaluateScheduleCompliance(userSchedules)
}

export default async function shiftRoutes(fastify) {
  fastify.addHook('onRequest', fastify.requirePanel)
  const requireSchedule = fastify.requireModule('schedule')

  // GET /api/admin/shifts — 班別列表（不含已停用）
  // 不掛模組守門：員工管理設定預設班別也需要讀（比照 GET /api/admin/departments）
  fastify.get('/api/admin/shifts', async (request) => {
    return fastify.prisma.shift.findMany({
      where: { companyId: request.companyId, deletedAt: null },
      select: SHIFT_SELECT,
      orderBy: [{ isDefault: 'desc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    })
  })

  // POST /api/admin/shifts — 建立班別；isDefault=true 時取消其他班別的預設
  fastify.post('/api/admin/shifts', { preHandler: requireSchedule, schema: { body: shiftBodySchema } }, async (request, reply) => {
    const { name, startTime, endTime, breakMinutes = 60, isDefault = false } = request.body || {}
    const err = validateShiftPayload({ name, startTime, endTime, breakMinutes })
    if (err) return reply.code(400).send({ error: err })
    try {
      return await fastify.prisma.$transaction(async (tx) => {
        if (isDefault === true) {
          await tx.shift.updateMany({
            where: { companyId: request.companyId, isDefault: true },
            data: { isDefault: false },
          })
        }
        return tx.shift.create({
          data: {
            companyId: request.companyId,
            name: name.trim(), startTime, endTime, breakMinutes,
            isDefault: isDefault === true,
          },
          select: SHIFT_SELECT,
        })
      })
    } catch (e) {
      if (e?.code === 'P2002') return reply.code(409).send({ error: '班別名稱已存在' })
      throw e
    }
  })

  // PATCH /api/admin/shifts/:id
  fastify.patch('/api/admin/shifts/:id', { preHandler: requireSchedule, schema: { body: shiftBodySchema } }, async (request, reply) => {
    const { id } = request.params
    const existing = await fastify.prisma.shift.findFirst({
      where: { id, companyId: request.companyId, deletedAt: null },
    })
    if (!existing) return reply.code(404).send({ error: '找不到班別' })

    const {
      name = existing.name, startTime = existing.startTime, endTime = existing.endTime,
      breakMinutes = existing.breakMinutes, isDefault = existing.isDefault,
    } = request.body || {}
    const err = validateShiftPayload({ name, startTime, endTime, breakMinutes })
    if (err) return reply.code(400).send({ error: err })
    // 預設班只能被「另一個班別設為預設」取代，避免公司短暫沒有預設班
    if (existing.isDefault && isDefault === false) {
      return reply.code(400).send({ error: '不可直接取消預設班，請將其他班別設為預設' })
    }
    try {
      return await fastify.prisma.$transaction(async (tx) => {
        if (isDefault === true && !existing.isDefault) {
          await tx.shift.updateMany({
            where: { companyId: request.companyId, isDefault: true },
            data: { isDefault: false },
          })
        }
        return tx.shift.update({
          where: { id },
          data: { name: name.trim(), startTime, endTime, breakMinutes, isDefault: isDefault === true },
          select: SHIFT_SELECT,
        })
      })
    } catch (e) {
      if (e?.code === 'P2002') return reply.code(409).send({ error: '班別名稱已存在' })
      throw e
    }
  })

  // DELETE /api/admin/shifts/:id — soft delete；被引用（預設班 / 未來指派）則擋下。
  // 停用時重新命名以釋出名稱（@@unique(companyId, name) 含已停用列）。
  fastify.delete('/api/admin/shifts/:id', { preHandler: requireSchedule }, async (request, reply) => {
    const { id } = request.params
    const shift = await fastify.prisma.shift.findFirst({
      where: { id, companyId: request.companyId, deletedAt: null },
    })
    if (!shift) return reply.code(404).send({ error: '找不到班別' })
    if (shift.isDefault) {
      return reply.code(400).send({ error: '預設班別不可刪除，請先將其他班別設為預設' })
    }
    const defaultCount = await fastify.prisma.user.count({
      where: { defaultShiftId: id, deletedAt: null },
    })
    if (defaultCount > 0) {
      return reply.code(400).send({ error: `仍有 ${defaultCount} 位員工以此為預設班別，請先變更` })
    }
    const futureCount = await fastify.prisma.shiftAssignment.count({
      where: { shiftId: id, date: { gte: getTodayStart() } },
    })
    if (futureCount > 0) {
      return reply.code(400).send({ error: `仍有 ${futureCount} 筆今天以後的排班使用此班別，請先改排` })
    }
    return fastify.prisma.shift.update({
      where: { id },
      data: { deletedAt: new Date(), name: `${shift.name}（已停用 ${Date.now()}）` },
      select: SHIFT_SELECT,
    })
  })

  // GET /api/admin/schedule?month=YYYY-MM&departmentId= — 員工 × 當月指派（前端組矩陣）
  // 非 admin 依部門角色範圍（scopeUserIds）限縮可見員工
  fastify.get('/api/admin/schedule', { preHandler: requireSchedule }, async (request, reply) => {
    const { month, departmentId } = request.query
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return reply.code(400).send({ error: 'month 需為 YYYY-MM 格式' })
    }
    const [year, mon] = month.split('-').map(Number)
    const startDate = new Date(Date.UTC(year, mon - 1, 1))
    const endDate = new Date(Date.UTC(year, mon, 1))

    const users = await fastify.prisma.user.findMany({
      where: {
        companyId: request.companyId, deletedAt: null,
        employmentType: { in: ['operation', 'parttime'] }, // regular 走預設班,不進排班
        ...(request.scopeUserIds ? { id: { in: request.scopeUserIds } } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true, name: true, empNo: true, avatar: true, departmentId: true,
        defaultShift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
      orderBy: [{ empNo: 'asc' }, { createdAt: 'asc' }],
    })

    const assignments = users.length === 0 ? [] : await fastify.prisma.shiftAssignment.findMany({
      where: { userId: { in: users.map((u) => u.id) }, date: { gte: startDate, lt: endDate } },
      select: { userId: true, date: true, shiftId: true },
    })

    return {
      users,
      assignments: assignments.map((a) => ({
        userId: a.userId, date: a.date.toISOString().slice(0, 10), shiftId: a.shiftId,
      })),
    }
  })

  // PUT /api/admin/schedule/assignments — bulk upsert；shiftId=null 清除指派（回預設班）
  // 全部驗證通過才寫入（transaction 全有或全無）
  const MAX_SCHEDULE_CHANGES = 500
  fastify.put('/api/admin/schedule/assignments', {
    preHandler: requireSchedule,
    schema: { body: body({ changes: anyArray, confirm: bool }) },
  }, async (request, reply) => {
    const changes = request.body?.changes
    if (!Array.isArray(changes) || changes.length === 0) {
      return reply.code(400).send({ error: 'changes 必須為非空陣列' })
    }
    if (changes.length > MAX_SCHEDULE_CHANGES) {
      return reply.code(400).send({ error: `一次最多 ${MAX_SCHEDULE_CHANGES} 筆變更` })
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    for (const c of changes) {
      if (!c || typeof c.userId !== 'string' || !datePattern.test(c.date ?? '')) {
        return reply.code(400).send({ error: '每筆變更需含 userId 與 YYYY-MM-DD 格式的 date' })
      }
      if (dateStrToDate(c.date).toISOString().slice(0, 10) !== c.date) {
        return reply.code(400).send({ error: '包含無效的日期' })
      }
      if (c.shiftId !== null && typeof c.shiftId !== 'string') {
        return reply.code(400).send({ error: 'shiftId 需為班別 id 或 null' })
      }
    }

    // 員工必須屬於本公司且在自己的部門範圍內
    const userIds = [...new Set(changes.map((c) => c.userId))]
    const visibleIds = request.scopeUserIds
      ? userIds.filter((uid) => request.scopeUserIds.includes(uid))
      : userIds
    const okUsers = visibleIds.length === 0 ? [] : await fastify.prisma.user.findMany({
      where: { id: { in: visibleIds }, companyId: request.companyId, deletedAt: null },
      select: { id: true, name: true, empNo: true, employmentType: true },
    })
    if (okUsers.length !== userIds.length) {
      return reply.code(400).send({ error: '包含無效或無權限操作的員工' })
    }
    if (okUsers.some((u) => u.employmentType === 'regular')) {
      return reply.code(400).send({ error: '正常班員工不可排班' })
    }

    // 班別必須屬於本公司且未停用；一併取回上下班時間供法規檢核
    const shiftIds = [...new Set(changes.map((c) => c.shiftId).filter(Boolean))]
    const shiftTimeById = new Map()
    if (shiftIds.length > 0) {
      const okShifts = await fastify.prisma.shift.findMany({
        where: { id: { in: shiftIds }, companyId: request.companyId, deletedAt: null },
        select: { id: true, startTime: true, endTime: true },
      })
      if (okShifts.length !== shiftIds.length) {
        return reply.code(400).send({ error: '包含無效的班別' })
      }
      for (const s of okShifts) shiftTimeById.set(s.id, { startTime: s.startTime, endTime: s.endTime })
    }

    // 排班法規檢核（七休一 / 輪班間隔 11h）— 有違規且未帶 confirm 則 409 讓前端警示可覆寫
    const violations = await evaluateScheduleChanges(fastify.prisma, { changes, okUsers, shiftTimeById })
    if (violations.length > 0 && request.body?.confirm !== true) {
      return reply.code(409).send({ error: 'schedule_compliance_warning', violations })
    }

    await fastify.prisma.$transaction(changes.map((c) => {
      const date = dateStrToDate(c.date)
      if (c.shiftId === null) {
        return fastify.prisma.shiftAssignment.deleteMany({ where: { userId: c.userId, date } })
      }
      return fastify.prisma.shiftAssignment.upsert({
        where: { userId_date: { userId: c.userId, date } },
        update: { shiftId: c.shiftId },
        create: { userId: c.userId, date, shiftId: c.shiftId },
      })
    }))
    return { updated: changes.length }
  })
}
