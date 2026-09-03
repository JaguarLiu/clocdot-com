export default async function payrollRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate)

  // GET /api/payroll/me — 本人「已鎖定」月份清單（新到舊）
  fastify.get('/api/payroll/me', async (request) => {
    const items = await fastify.prisma.payrollItem.findMany({
      where: { userId: request.user.id, run: { status: 'locked' } },
      include: { run: { select: { month: true, lockedAt: true } } },
    })
    return items
      .map((i) => ({ month: i.run.month, netPay: i.netPay, lockedAt: i.run.lockedAt }))
      .sort((a, b) => (a.month < b.month ? 1 : -1))
  })

  // GET /api/payroll/me/:month — 本人單月薪資單（僅 locked）
  fastify.get('/api/payroll/me/:month', async (request, reply) => {
    const { month } = request.params
    if (!/^\d{4}-\d{2}$/.test(month)) return reply.code(400).send({ error: 'month 需為 YYYY-MM' })
    const item = await fastify.prisma.payrollItem.findFirst({
      where: { userId: request.user.id, run: { status: 'locked', month } },
      include: { run: { select: { month: true, lockedAt: true } } },
    })
    if (!item) return reply.code(404).send({ error: '查無已發放薪資單' })
    return {
      month: item.run.month,
      lockedAt: item.run.lockedAt,
      payslip: item.payslip,
      adjustments: item.adjustments,
      grossPay: item.grossPay,
      totalDeductions: item.totalDeductions,
      adjustmentsTotal: item.adjustmentsTotal,
      netPay: item.netPay,
    }
  })
}
