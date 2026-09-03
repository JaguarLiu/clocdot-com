import { assertOwnedByCompany } from '../../utils/tenant.js'
import { normalizeSalaryProfile } from '../../services/salaryProfile.js'
import { getRates } from '../../services/payrollReference.js'
import { buildPayrollItems, applyAdjustments, validateAdjustments } from '../../services/payrollRun.js'
import { computeCashout } from '../../services/leaveCashout.js'
import { buildBalances } from '../../services/leaveBalance.js'
import { toCSV } from '../../utils/csv.js'

export function registerPayrollRoutes(fastify, S, { assembleSettlement, loadDeductionContext }) {
// GET /api/admin/salary-profiles — 全公司薪資主檔總覽（標示未設定者）
fastify.get('/api/admin/salary-profiles', { preHandler: fastify.requireModule('payroll') }, async (request) => {
  const users = await fastify.prisma.user.findMany({
    where: { companyId: request.companyId, deletedAt: null },
    select: {
      id: true, empNo: true, name: true, email: true, employmentType: true,
      salaryProfile: { select: { baseSalary: true, hourlyRate: true, updatedAt: true } },
    },
    orderBy: [{ empNo: 'asc' }, { createdAt: 'asc' }],
  })
  return users.map((u) => ({
    userId: u.id,
    empNo: u.empNo,
    name: u.name,
    email: u.email,
    employmentType: u.employmentType,
    configured: Boolean(u.salaryProfile),
    baseSalary: u.salaryProfile?.baseSalary ?? null,
    hourlyRate: u.salaryProfile?.hourlyRate ?? null,
    updatedAt: u.salaryProfile?.updatedAt ?? null,
  }))
})

// GET /api/admin/users/:id/salary-profile — 取單人（無則 null）
fastify.get('/api/admin/users/:id/salary-profile', { preHandler: fastify.requireModule('payroll') }, async (request, reply) => {
  const { id } = request.params
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
  const profile = await fastify.prisma.salaryProfile.findUnique({ where: { userId: id } })
  return profile ?? null
})

// PUT /api/admin/users/:id/salary-profile — upsert 現值
fastify.put('/api/admin/users/:id/salary-profile', { preHandler: fastify.requireModule('payroll'), schema: { body: S.salaryProfile } }, async (request, reply) => {
  const { id } = request.params
  const target = await assertOwnedByCompany(
    (uid) => fastify.prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, companyId: true, deletedAt: true, employmentType: true },
    }),
    id, request.companyId, reply,
    (rec) => rec.companyId,
  )
  if (!target) return
  if (target.deletedAt) return reply.code(404).send({ error: '找不到資料' })

  const payType = target.employmentType === 'parttime' ? 'hourly' : 'monthly'
  const result = normalizeSalaryProfile(request.body, { payType })
  if (!result.ok) return reply.code(400).send({ error: result.error })

  const profile = await fastify.prisma.salaryProfile.upsert({
    where: { userId: id },
    create: { userId: id, ...result.value },
    update: result.value,
  })
  return profile
})

// ── Payroll Runs ──────────────────────────────────────────────────────────

// 讀取某月 run（含 items）
async function loadRun(companyId, month) {
  return fastify.prisma.payrollRun.findUnique({
    where: { companyId_month: { companyId, month } },
    include: { items: { orderBy: { empNo: 'asc' } } },
  })
}

// 載入某月全部換薪記錄 → map(userId → {minutes, days, amount})
async function loadCashoutMap(companyId, month) {
  const rows = await fastify.prisma.leaveCashout.findMany({ where: { companyId, month } })
  return Object.fromEntries(rows.map((c) => [c.userId, { minutes: c.minutes, days: Number(c.days), amount: c.amount }]))
}

// 重算某月 draft run：保留 adjustments、載入換薪 earning。回傳 { ...run, skipped }
async function rebuildRun(request, month) {
  const year = Number(month.slice(0, 4))
  const settlementRows = await assembleSettlement(request, month)
  const { company, leaveDeductRates } = await loadDeductionContext(request.companyId)
  const profiles = await fastify.prisma.salaryProfile.findMany({
    where: { user: { companyId: request.companyId, deletedAt: null } },
  })
  const salaryProfilesByUserId = Object.fromEntries(profiles.map((p) => [p.userId, p]))
  const cashoutByUserId = await loadCashoutMap(request.companyId, month)

  const { items, skipped } = buildPayrollItems({ settlementRows, salaryProfilesByUserId, company, leaveDeductRates, cashoutByUserId, month, year })
  const ratesSnapshot = getRates(year)
  const existing = await loadRun(request.companyId, month)
  const existingAdj = Object.fromEntries((existing?.items ?? []).map((i) => [i.userId, i.adjustments]))

  const run = await fastify.prisma.$transaction(async (tx) => {
    const r = await tx.payrollRun.upsert({
      where: { companyId_month: { companyId: request.companyId, month } },
      create: { companyId: request.companyId, month, status: 'draft', ratesSnapshot },
      update: { status: 'draft', ratesSnapshot },
    })
    const keepUserIds = items.map((i) => i.userId)
    await tx.payrollItem.deleteMany({
      where: { payrollRunId: r.id, userId: { notIn: keepUserIds.length ? keepUserIds : ['__none__'] } },
    })
    for (const it of items) {
      const adjustments = Array.isArray(existingAdj[it.userId]) ? existingAdj[it.userId] : []
      const { adjustmentsTotal, netPay } = applyAdjustments(it.payslip, adjustments)
      const denorm = {
        empNo: it.empNo,
        name: it.name,
        payslip: it.payslip,
        grossPay: it.payslip.earnings.grossPay,
        totalDeductions: it.payslip.deductions.total,
        adjustmentsTotal,
        netPay,
      }
      await tx.payrollItem.upsert({
        where: { payrollRunId_userId: { payrollRunId: r.id, userId: it.userId } },
        create: { payrollRunId: r.id, userId: it.userId, adjustments, ...denorm },
        update: denorm,
      })
    }
    return tx.payrollRun.findUnique({ where: { id: r.id }, include: { items: { orderBy: { empNo: 'asc' } } } })
  })

  return { ...run, skipped }
}

// GET /api/admin/payroll-runs — 各月 run 概要
fastify.get('/api/admin/payroll-runs', { preHandler: fastify.requireModule('payroll') }, async (request) => {
  const runs = await fastify.prisma.payrollRun.findMany({
    where: { companyId: request.companyId },
    include: { items: { select: { netPay: true } } },
    orderBy: { month: 'desc' },
  })
  return runs.map((r) => ({
    month: r.month,
    status: r.status,
    lockedAt: r.lockedAt,
    itemCount: r.items.length,
    netTotal: r.items.reduce((s, i) => s + i.netPay, 0),
  }))
})

// GET /api/admin/payroll-runs/:month — 單月 run + items + skipped
fastify.get('/api/admin/payroll-runs/:month', { preHandler: fastify.requireModule('payroll') }, async (request, reply) => {
  const { month } = request.params
  if (!/^\d{4}-\d{2}$/.test(month)) return reply.code(400).send({ error: 'month 需為 YYYY-MM' })
  const run = await loadRun(request.companyId, month)
  if (!run) return reply.code(404).send({ error: '尚未結算' })
  const users = await fastify.prisma.user.findMany({
    where: { companyId: request.companyId, deletedAt: null },
    select: { id: true, empNo: true, name: true },
  })
  const itemUserIds = new Set(run.items.map((i) => i.userId))
  const skipped = users.filter((u) => !itemUserIds.has(u.id)).map((u) => ({ userId: u.id, empNo: u.empNo, name: u.name }))
  return { ...run, skipped }
})

// POST /api/admin/payroll-runs — 產生/重算 draft（保留既有 adjustments）
fastify.post('/api/admin/payroll-runs', { preHandler: fastify.requireModule('payroll'), schema: { body: S.payrollRunCreate } }, async (request, reply) => {
  const { month } = request.body || {}
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return reply.code(400).send({ error: 'month 需為 YYYY-MM' })

  const existing = await loadRun(request.companyId, month)
  if (existing?.status === 'locked') return reply.code(409).send({ error: '已鎖定，請先解鎖' })

  return rebuildRun(request, month)
})

// POST /api/admin/payroll-runs/:month/cashout — 特休換薪（單選/全選），算金額並重算
fastify.post('/api/admin/payroll-runs/:month/cashout', { preHandler: fastify.requireModule('payroll'), schema: { body: S.payrollCashout } }, async (request, reply) => {
  const { month } = request.params
  if (!/^\d{4}-\d{2}$/.test(month)) return reply.code(400).send({ error: 'month 需為 YYYY-MM' })
  const year = Number(month.slice(0, 4))
  const userIds = Array.isArray(request.body?.userIds) ? request.body.userIds : null
  if (!userIds || userIds.length === 0) return reply.code(400).send({ error: 'userIds 必填' })

  const run = await loadRun(request.companyId, month)
  if (!run) return reply.code(404).send({ error: '尚未結算' })
  if (run.status !== 'draft') return reply.code(409).send({ error: '已鎖定，請先解鎖' })

  const policies = await fastify.prisma.leavePolicy.findMany({ where: { companyId: request.companyId } })
  const users = await fastify.prisma.user.findMany({
    where: { id: { in: userIds }, companyId: request.companyId, deletedAt: null },
    include: { salaryProfile: true, company: true },
  })
  const effectiveDate = new Date(Date.UTC(year, Number(month.slice(5, 7)) - 1, 1))

  for (const user of users) {
    if (!user.salaryProfile) continue
    const { balances } = await buildBalances(fastify.prisma, { user, company: user.company, policies })
    const annual = balances.find((b) => b.leaveType === 'annual')
    // 把本月既有換薪加回 → 重複按為冪等（不會越換越少）
    const existing = await fastify.prisma.leaveCashout.findUnique({
      where: { userId_month: { userId: user.id, month } },
    })
    const available = (annual?.remainingMinutes ?? 0) + (existing?.minutes ?? 0)
    const monthlyWage = user.salaryProfile.baseSalary + (user.salaryProfile.allowances ?? []).reduce((s, a) => s + a.amount, 0)
    const c = computeCashout({ remainingMinutes: available, monthlyWage })
    if (c.amount <= 0 || c.minutes <= 0) {
      if (existing) await fastify.prisma.leaveCashout.delete({ where: { id: existing.id } })
      continue
    }
    await fastify.prisma.leaveCashout.upsert({
      where: { userId_month: { userId: user.id, month } },
      create: {
        companyId: request.companyId, userId: user.id, month, effectiveDate,
        minutes: c.minutes, days: c.days, dailyWage: c.dailyWage, amount: c.amount, createdById: request.user.id,
      },
      update: { minutes: c.minutes, days: c.days, dailyWage: c.dailyWage, amount: c.amount, createdById: request.user.id },
    })
  }

  return rebuildRun(request, month)
})

// PATCH /api/admin/payroll-runs/:month/items/:userId — 設定調整項（僅 draft）
fastify.patch('/api/admin/payroll-runs/:month/items/:userId', { preHandler: fastify.requireModule('payroll'), schema: { body: S.payrollItems } }, async (request, reply) => {
  const { month, userId } = request.params
  const run = await loadRun(request.companyId, month)
  if (!run) return reply.code(404).send({ error: '尚未結算' })
  if (run.status !== 'draft') return reply.code(409).send({ error: '已鎖定，無法修改' })
  const item = run.items.find((i) => i.userId === userId)
  if (!item) return reply.code(404).send({ error: '找不到該員工薪資項' })
  const v = validateAdjustments(request.body?.adjustments)
  if (!v.ok) return reply.code(400).send({ error: v.error })
  const { adjustmentsTotal, netPay } = applyAdjustments(item.payslip, v.value)
  return fastify.prisma.payrollItem.update({
    where: { id: item.id },
    data: { adjustments: v.value, adjustmentsTotal, netPay },
  })
})

// POST /api/admin/payroll-runs/:month/lock
fastify.post('/api/admin/payroll-runs/:month/lock', { preHandler: fastify.requireModule('payroll') }, async (request, reply) => {
  const { month } = request.params
  const run = await loadRun(request.companyId, month)
  if (!run) return reply.code(404).send({ error: '尚未結算' })
  if (run.status === 'locked') return reply.code(409).send({ error: '已是鎖定狀態' })
  await fastify.prisma.payrollRun.update({
    where: { id: run.id },
    data: { status: 'locked', lockedAt: new Date(), lockedById: request.user.id },
  })
  return { ok: true }
})

// POST /api/admin/payroll-runs/:month/unlock
fastify.post('/api/admin/payroll-runs/:month/unlock', { preHandler: fastify.requireModule('payroll') }, async (request, reply) => {
  const { month } = request.params
  const run = await loadRun(request.companyId, month)
  if (!run) return reply.code(404).send({ error: '尚未結算' })
  if (run.status !== 'locked') return reply.code(409).send({ error: '目前非鎖定狀態' })
  await fastify.prisma.payrollRun.update({
    where: { id: run.id },
    data: { status: 'draft', lockedAt: null, lockedById: null },
  })
  return { ok: true }
})

// GET /api/admin/payroll-runs/:month/export — CSV
fastify.get('/api/admin/payroll-runs/:month/export', { preHandler: fastify.requireModule('payroll') }, async (request, reply) => {
  const { month } = request.params
  const run = await loadRun(request.companyId, month)
  if (!run) return reply.code(404).send({ error: '尚未結算' })
  const headers = ['員工編號', '姓名', '本薪', '加給合計', '加班費', '特休換薪', '應發毛額',
    '勞保自付', '健保自付', '勞退自提', '所得稅', '遲到早退缺勤扣款', '請假扣款', '調整合計', '實發淨額']
  const csvRows = run.items.map((i) => {
    const p = i.payslip
    const allowanceTotal = (p.earnings.allowances ?? []).reduce((s, a) => s + a.amount, 0)
    return [i.empNo ?? '', i.name ?? '', p.earnings.baseSalary, allowanceTotal, p.earnings.overtime.total,
      p.earnings.leaveCashout?.amount ?? 0,
      p.earnings.grossPay, p.deductions.laborInsurance, p.deductions.healthInsurance,
      p.deductions.pensionVoluntary, p.deductions.incomeTax,
      p.deductions.attendanceDeduction ?? 0, p.deductions.leaveDeduction ?? 0,
      i.adjustmentsTotal, i.netPay]
  })
  const csv = toCSV(headers, csvRows)
  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="payroll-${month}.csv"`)
    .send(csv)
})
}
