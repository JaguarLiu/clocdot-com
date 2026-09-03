import { toCSV, formatTimeInTZ, formatDateUTC } from '../../utils/csv.js'
import { scopedByUser, assertOwnedByCompany } from '../../utils/tenant.js'
import { getTodayStart } from '../../utils/timezone.js'

export function registerReportingRoutes(fastify, S, { assembleSettlement }) {
// GET /api/admin/settlement?month=YYYY-MM
fastify.get('/api/admin/settlement', { preHandler: fastify.requireModule('monthly-report') }, async (request, reply) => {
  const { month } = request.query
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return reply.code(400).send({ error: 'month 需為 YYYY-MM 格式' })
  }
  return assembleSettlement(request, month)
})

// GET /api/admin/settlement/export?month=YYYY-MM
fastify.get('/api/admin/settlement/export', { preHandler: fastify.requireModule('monthly-report') }, async (request, reply) => {
  const { month } = request.query
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return reply.code(400).send({ error: 'month 需為 YYYY-MM 格式' })
  }
  const rows = await assembleSettlement(request, month)

  // 動態收集出現過的加班 rate，組成欄位
  const rateSet = new Set()
  for (const r of rows) for (const k of Object.keys(r.overtimeByRate)) rateSet.add(k)
  const rates = [...rateSet].sort()

  const headers = [
    '員工編號', '姓名', '應出勤日', '應出勤時數(分)', '實出勤日', '實出勤時數(分)',
    '遲到次數', '早退次數', '缺勤天', '請假時數(分)', ...rates.map((r) => `加班${r}(分)`),
    '合規狀態',
  ]
  const statusLabel = { ok: '正常', warn: '接近上限', exceed: '超標' }
  const csvRows = rows.map((r) => [
    r.empNo ?? '', r.name ?? '', r.expectedWorkdays, r.expectedMinutes,
    r.actualWorkdays, r.actualMinutes, r.lateCount, r.earlyLeaveCount, r.absenceDays ?? 0, r.leaveMinutes,
    ...rates.map((rate) => r.overtimeByRate[rate] ?? 0),
    statusLabel[r.compliance?.status] ?? '正常',
  ])

  const csv = toCSV(headers, csvRows)
  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="settlement-${month}.csv"`)
    .send(csv)
})

// GET /api/admin/attendance?month=2024-02
fastify.get('/api/admin/attendance', { preHandler: fastify.requireModule('monthly-report') }, async (request) => {
  const { month } = request.query

  let year, mon
  if (month) {
    ;[year, mon] = month.split('-').map(Number)
  } else {
    // 預設當月依標準時區（getTodayStart 預設 Asia/Taipei），不依賴 server 本地時區（P2-10）
    const today = getTodayStart()
    year = today.getUTCFullYear()
    mon = today.getUTCMonth() + 1
  }

  const startDate = new Date(Date.UTC(year, mon - 1, 1))
  const endDate = new Date(Date.UTC(year, mon, 1))

  const records = await fastify.prisma.attendanceRecord.findMany({
    where: scopedByUser(request, { workDate: { gte: startDate, lt: endDate } }),
    include: {
      user: { select: { id: true, email: true, name: true, empNo: true } },
    },
  })

  // 按 user 分組統計
  const userMap = new Map()
  for (const r of records) {
    const uid = r.userId
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        user: r.user,
        totalWorkDuration: 0,
        attendanceDays: 0,
        lateDays: 0,
        earlyLeaveDays: 0,
        leaveDays: 0,
        leaveByType: {},
        officeDays: 0,
        remoteDays: 0,
      })
    }
    const stat = userMap.get(uid)
    if (r.workDuration) stat.totalWorkDuration += r.workDuration
    if (r.punchIn) stat.attendanceDays += 1
    if (r.isLate) stat.lateDays += 1
    if (r.isEarlyLeave) stat.earlyLeaveDays += 1
    if (r.leaveType) {
      stat.leaveDays += 1
      stat.leaveByType[r.leaveType] = (stat.leaveByType[r.leaveType] || 0) + 1
    }
    // 以 punchIn 那次的位置為準 (早上進辦公室視為 "到公司日")；
    // 若只有下班打卡沒上班卡則退而求其次看 punchOut
    const loc = r.punchInLocationType ?? r.punchOutLocationType
    if (loc === 'office') stat.officeDays += 1
    else if (loc === 'remote') stat.remoteDays += 1
  }

  return Array.from(userMap.values())
})

// GET /api/admin/attendance/yearly?year=YYYY — 年度出勤統計（按人按月彙總）
fastify.get('/api/admin/attendance/yearly', { preHandler: fastify.requireModule('monthly-report') }, async (request) => {
  // 預設當年依標準時區（Asia/Taipei），不依賴 server 本地時區（P2-10）
  const year = Number(request.query.year) || getTodayStart().getUTCFullYear()
  const startDate = new Date(Date.UTC(year, 0, 1))
  const endDate = new Date(Date.UTC(year + 1, 0, 1))

  const records = await fastify.prisma.attendanceRecord.findMany({
    where: scopedByUser(request, { workDate: { gte: startDate, lt: endDate } }),
    include: {
      user: { select: { id: true, email: true, name: true, empNo: true } },
    },
  })

  const emptyStat = () => ({
    attendanceDays: 0,
    totalWorkDuration: 0,
    lateDays: 0,
    earlyLeaveDays: 0,
    leaveDays: 0,
  })

  const userMap = new Map()
  for (const r of records) {
    if (!userMap.has(r.userId)) {
      userMap.set(r.userId, {
        user: r.user,
        months: Array.from({ length: 12 }, emptyStat),
        totals: emptyStat(),
      })
    }
    const stat = userMap.get(r.userId)
    const monthStat = stat.months[new Date(r.workDate).getUTCMonth()]
    for (const bucket of [monthStat, stat.totals]) {
      if (r.punchIn) bucket.attendanceDays += 1
      if (r.workDuration) bucket.totalWorkDuration += r.workDuration
      if (r.isLate) bucket.lateDays += 1
      if (r.isEarlyLeave) bucket.earlyLeaveDays += 1
      if (r.leaveType) bucket.leaveDays += 1
    }
  }

  return Array.from(userMap.values())
    .sort((a, b) => (a.user?.empNo ?? '').toString().localeCompare((b.user?.empNo ?? '').toString(), undefined, { numeric: true }))
})

// GET /api/admin/attendance/export?month=YYYY-MM — 每日明細 CSV (UTF-8 + BOM)
fastify.get('/api/admin/attendance/export', { preHandler: fastify.requireModule('monthly-report') }, async (request, reply) => {
  const { month } = request.query
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return reply.code(400).send({ error: 'month 需為 YYYY-MM 格式' })
  }
  const [year, mon] = month.split('-').map(Number)
  const startDate = new Date(Date.UTC(year, mon - 1, 1))
  const endDate = new Date(Date.UTC(year, mon, 1))

  const records = await fastify.prisma.attendanceRecord.findMany({
    where: scopedByUser(request, { workDate: { gte: startDate, lt: endDate } }),
    include: {
      user: { select: { empNo: true, name: true, email: true, timezone: true } },
    },
    orderBy: [{ user: { empNo: 'asc' } }, { workDate: 'asc' }],
  })

  // 彙整這批 record 引用的 locationId → name，以便 CSV 顯示地點名稱
  const locationIds = new Set()
  for (const r of records) {
    if (r.punchInLocationId) locationIds.add(r.punchInLocationId)
    if (r.punchOutLocationId) locationIds.add(r.punchOutLocationId)
  }
  const locations = locationIds.size === 0
    ? []
    : await fastify.prisma.companyLocation.findMany({
        where: { id: { in: [...locationIds] } },
        select: { id: true, name: true },
      })
  const locName = Object.fromEntries(locations.map((l) => [l.id, l.name]))

  const headers = [
    '員工編號', '姓名', 'Email', '日期', '上班時間', '下班時間',
    '工時(分鐘)', '遲到', '早退', '假別', '國定假日',
    '上班位置', '上班地點', '下班位置', '下班地點',
  ]
  const rows = records.map((r) => {
    const tz = r.user?.timezone || 'Asia/Taipei'
    return [
      r.user?.empNo ?? '',
      r.user?.name ?? '',
      r.user?.email ?? '',
      formatDateUTC(r.workDate),
      formatTimeInTZ(r.punchIn, tz),
      formatTimeInTZ(r.punchOut, tz),
      r.workDuration ?? '',
      r.isLate ? 'Y' : '',
      r.isEarlyLeave ? 'Y' : '',
      r.leaveType ?? '',
      r.isHoliday ? 'Y' : '',
      r.punchInLocationType ?? '',
      r.punchInLocationId ? (locName[r.punchInLocationId] ?? '') : '',
      r.punchOutLocationType ?? '',
      r.punchOutLocationId ? (locName[r.punchOutLocationId] ?? '') : '',
    ]
  })

  const csv = toCSV(headers, rows)
  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="attendance-${month}.csv"`)
    .send(csv)
})

// PATCH /api/admin/attendance/:id
fastify.patch('/api/admin/attendance/:id', { preHandler: fastify.requireModule('monthly-report'), schema: { body: S.attendancePatch } }, async (request, reply) => {
  const { id } = request.params
  const existing = await assertOwnedByCompany(
    (rid) => fastify.prisma.attendanceRecord.findUnique({
      where: { id: rid },
      include: { user: { select: { companyId: true } } },
    }),
    id, request.companyId, reply,
    (rec) => rec.user?.companyId,
  )
  if (!existing) return

  const { isLate, isEarlyLeave, leaveType, isHoliday } = request.body
  const data = {}
  if (isLate !== undefined) data.isLate = isLate
  if (isEarlyLeave !== undefined) data.isEarlyLeave = isEarlyLeave
  if (leaveType !== undefined) data.leaveType = leaveType
  if (isHoliday !== undefined) data.isHoliday = isHoliday

  return fastify.prisma.attendanceRecord.update({ where: { id }, data })
})

}
