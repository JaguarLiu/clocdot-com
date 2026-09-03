import { formatDateUTC } from '../utils/csv.js'
import { getHolidayDateSet } from '../data/twHolidays/index.js'
import { derivePendingOvertime } from '../services/overtimeDerivation.js'
import { resolveDayType } from '../services/dayType.js'
import { classifyOvertime } from '../services/overtime.js'
import { evaluateOvertimeCompliance, MONTHLY_CAP_NORMAL } from '../services/compliance.js'
import { createApprovalChain } from '../services/approvalEngine.js'
import { body, str, int, strOrNull } from '../utils/schema.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// 撈某員工某 workDate 區間的公司日別例外，整理成 { 'YYYY-MM-DD': dayType }
async function loadExceptions(fastify, companyId, startDate, endDate) {
  if (!companyId) return {}
  const rows = await fastify.prisma.companyDayException.findMany({
    where: { companyId, date: { gte: startDate, lte: endDate } },
  })
  return Object.fromEntries(rows.map((r) => [formatDateUTC(r.date), r.dayType]))
}

export default async function overtimeRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate)

  // GET /api/overtime/pending — 即時推導未送出的加班日（虛擬草稿）
  fastify.get('/api/overtime/pending', async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      include: { company: true },
    })
    if (!user?.company) return reply.code(400).send({ error: '帳號未綁定公司' })

    // 只看最近 60 天，避免無限回溯
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - 60)
    since.setUTCHours(0, 0, 0, 0)

    const records = await fastify.prisma.attendanceRecord.findMany({
      where: { userId: user.id, workDate: { gte: since }, workDuration: { not: null } },
      orderBy: { workDate: 'asc' },
    })
    if (records.length === 0) return []

    // 只排除 pending/approved；rejected 的日子要能重新出現在可申請清單供員工重送（upsert）
    const existing = await fastify.prisma.overtimeRequest.findMany({
      where: { userId: user.id, workDate: { gte: since }, status: { in: ['pending', 'approved'] } },
      select: { workDate: true },
    })
    const existingDates = new Set(existing.map((e) => formatDateUTC(e.workDate)))

    const years = new Set(records.map((r) => formatDateUTC(r.workDate).slice(0, 4)))
    const holidays = new Set()
    for (const y of years) for (const d of getHolidayDateSet(Number(y))) holidays.add(d)

    const exceptions = await loadExceptions(fastify, user.companyId, records[0].workDate, records.at(-1).workDate)

    return derivePendingOvertime({
      records: records.map((r) => ({ workDate: formatDateUTC(r.workDate), workDuration: r.workDuration })),
      company: user.company,
      holidays,
      exceptions,
      existingDates,
    })
  })

  // POST /api/overtime-requests — 送出 / rejected 後重送（upsert）
  fastify.post('/api/overtime-requests', {
    schema: { body: body({ workDate: str, requestedMinutes: int, reason: strOrNull }) },
  }, async (request, reply) => {
    const { workDate, requestedMinutes, reason } = request.body || {}
    if (!workDate || !DATE_RE.test(workDate)) {
      return reply.code(400).send({ error: 'workDate 需為 YYYY-MM-DD' })
    }
    if (!Number.isInteger(requestedMinutes) || requestedMinutes <= 0) {
      return reply.code(400).send({ error: 'requestedMinutes 需為正整數' })
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      include: { company: true },
    })
    if (!user?.company) return reply.code(400).send({ error: '帳號未綁定公司' })

    const [y, m, d] = workDate.split('-').map(Number)
    const dateObj = new Date(Date.UTC(y, m - 1, d))
    const record = await fastify.prisma.attendanceRecord.findUnique({
      where: { userId_workDate: { userId: user.id, workDate: dateObj } },
    })
    if (!record || record.workDuration == null) {
      return reply.code(400).send({ error: '該日無完成的打卡紀錄' })
    }

    // 後端重新推導 derivedMinutes，不信任前端
    const holidays = getHolidayDateSet(y)
    const exceptions = await loadExceptions(fastify, user.companyId, dateObj, dateObj)
    const dayType = resolveDayType(workDate, user.company, { holidays, exceptions })
    const { totalOvertimeMinutes, tiers } = classifyOvertime({
      dayType,
      workMinutes: record.workDuration,
      standardDailyMinutes: user.company.standardDailyMinutes,
    })
    if (totalOvertimeMinutes <= 0) {
      return reply.code(400).send({ error: '該日無加班時數' })
    }
    if (requestedMinutes > totalOvertimeMinutes) {
      return reply.code(400).send({ error: `申請時數不可超過推導值 ${totalOvertimeMinutes} 分鐘` })
    }

    // upsert：首次送出建立 pending；rejected 後重送則更新原列為 pending
    const ot = await fastify.prisma.overtimeRequest.upsert({
      where: { userId_workDate: { userId: user.id, workDate: dateObj } },
      update: {
        derivedMinutes: totalOvertimeMinutes,
        requestedMinutes,
        dayType,
        tiers,
        reason: reason || null,
        status: 'pending',
      },
      create: {
        userId: user.id,
        workDate: dateObj,
        derivedMinutes: totalOvertimeMinutes,
        requestedMinutes,
        dayType,
        tiers,
        reason: reason || null,
        status: 'pending',
      },
    })

    await createApprovalChain(fastify.prisma, {
      requestType: 'overtime', requestId: ot.id, submitterId: user.id, companyId: user.companyId,
    })
    return ot
  })

  // GET /api/overtime-requests — 員工查自己的加班單
  fastify.get('/api/overtime-requests', async (request) => {
    return fastify.prisma.overtimeRequest.findMany({
      where: { userId: request.user.id },
      orderBy: { workDate: 'desc' },
    })
  })

  // GET /api/overtime/compliance — 員工本人當月加班合規（純資訊；僅計已核准）
  fastify.get('/api/overtime/compliance', async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      include: { company: true },
    })
    // 未綁公司 → 回良性空值，避免前端摘要條壞掉
    if (!user?.company) {
      return {
        status: 'ok', monthlyMinutes: 0, monthlyCap: MONTHLY_CAP_NORMAL,
        monthlyProjected: 0, quarterMinutes: null, quarterCap: null, reasons: [],
      }
    }

    const flexibleOvertime = !!user.company.flexibleOvertime
    const now = new Date()
    const year = now.getUTCFullYear()
    const mon = now.getUTCMonth() // 0-based
    const monthStart = new Date(Date.UTC(year, mon, 1))
    const monthEnd = new Date(Date.UTC(year, mon + 1, 1))
    const quarterStart = new Date(Date.UTC(year, mon - 2, 1)) // 近 3 個月含本月

    const rows = await fastify.prisma.overtimeRequest.findMany({
      where: {
        userId: user.id,
        status: 'approved',
        workDate: { gte: quarterStart, lt: monthEnd },
      },
      select: { workDate: true, tiers: true },
    })

    const monthTiers = []
    const quarterTiers = []
    for (const row of rows) {
      const tiers = Array.isArray(row.tiers) ? row.tiers : []
      quarterTiers.push(...tiers)
      if (row.workDate >= monthStart && row.workDate < monthEnd) monthTiers.push(...tiers)
    }

    // 員工視圖為月度純資訊，刻意不帶 dailyOverDates（單日 4h 屬主管審核面向）
    return evaluateOvertimeCompliance({ flexibleOvertime, monthTiers, quarterTiers })
  })
}
