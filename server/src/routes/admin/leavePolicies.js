import { isValidLeaveType, LEAVE_TYPES } from '../../services/leaveTypes.js'

export function registerLeavePolicyRoutes(fastify, S) {
// GET /api/admin/leave-policies — 列出本公司假別政策
//   回傳格式：enum 全部 10 種，缺設政策的會顯示 annualQuotaMinutes=null (代表未設)
fastify.get('/api/admin/leave-policies', { preHandler: fastify.requireModule('settings') }, async (request) => {
  const rows = await fastify.prisma.leavePolicy.findMany({
    where: { companyId: request.companyId },
  })
  const byType = Object.fromEntries(rows.map((r) => [r.leaveType, r]))
  return LEAVE_TYPES.map((t) => ({
    leaveType: t.value,
    label: t.label,
    annualQuotaMinutes: byType[t.value]?.annualQuotaMinutes ?? null,
    deductRate: byType[t.value]?.deductRate ?? null,
    defaultDays: t.defaultDays,
  }))
})

// PUT /api/admin/leave-policies — 批次更新/新增
//   body: { policies: [{ leaveType, annualQuotaMinutes }, ...] }
//   annualQuotaMinutes=null → 刪除該假別政策 (等同無限額)
//   特休 (annual) 一律由 server 在查詢餘額時自動依到職比例給予，不需要任何 flag
fastify.put('/api/admin/leave-policies', { preHandler: fastify.requireModule('settings'), schema: { body: S.leavePolicies } }, async (request, reply) => {
  const { policies } = request.body || {}
  if (!Array.isArray(policies)) {
    return reply.code(400).send({ error: 'policies 需為陣列' })
  }
  for (const p of policies) {
    if (!isValidLeaveType(p?.leaveType)) {
      return reply.code(400).send({ error: `不支援的假別: ${p?.leaveType}` })
    }
    if (p.annualQuotaMinutes !== null && (!Number.isInteger(p.annualQuotaMinutes) || p.annualQuotaMinutes < 0)) {
      return reply.code(400).send({ error: `${p.leaveType} 的 annualQuotaMinutes 需為 ≥0 整數或 null` })
    }
    if (p.deductRate !== undefined && p.deductRate !== null) {
      if (typeof p.deductRate !== 'number' || p.deductRate < 0 || p.deductRate > 1) {
        return reply.code(400).send({ error: `${p.leaveType} 的 deductRate 需為 0~1 或 null` })
      }
    }
  }

  const ops = policies.map((p) => {
    if (p.annualQuotaMinutes === null) {
      return fastify.prisma.leavePolicy.deleteMany({
        where: { companyId: request.companyId, leaveType: p.leaveType },
      })
    }
    return fastify.prisma.leavePolicy.upsert({
      where: { companyId_leaveType: { companyId: request.companyId, leaveType: p.leaveType } },
      create: {
        companyId: request.companyId,
        leaveType: p.leaveType,
        annualQuotaMinutes: p.annualQuotaMinutes,
        deductRate: p.deductRate ?? null,
      },
      update: { annualQuotaMinutes: p.annualQuotaMinutes, deductRate: p.deductRate ?? null },
    })
  })
  await fastify.prisma.$transaction(ops)
  return { ok: true }
})

}
