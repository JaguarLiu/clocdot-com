import { getTodayStart, dateStrToDate, getDateStrInTZ } from '../utils/timezone.js'
import { computeWorkDuration } from '../services/workDuration.js'
import { computeAttendanceFlags } from '../services/attendanceFlags.js'
import { resolveLocation } from '../utils/geofence.js'
import { isOnsiteRequired } from '../services/onsiteSchedule.js'
import { buildOnsiteCheck } from '../services/onsiteCheck.js'
import { getShiftForDate, loadScheduleBundle, shiftFor, shouldFallbackToYesterday } from '../services/schedule.js'
import { body } from '../utils/schema.js'

// 打卡 body：座標數字（遠端可省略/null）、clientTime 為 ISO 字串
const punchBodySchema = body({
  lat: { type: ['number', 'null'] },
  lng: { type: ['number', 'null'] },
  clientTime: { type: ['string', 'null'] },
})

// 共用：拿該員工所屬公司的所有地點，供 geofence 比對
async function getCompanyLocations(fastify, companyId) {
  if (!companyId) return []
  return fastify.prisma.companyLocation.findMany({
    where: { companyId },
    select: { id: true, name: true, lat: true, lng: true, radius: true },
  })
}

// 解析 client 送來的 clientTime (離線打卡用)
//   - 不接受未來時間 (允許 5 分鐘 clock skew)
//   - 不接受 24 小時以前 (避免無限期 backfill)
//   - 回傳對應的 Date 與該時間在使用者時區下的 workDate (UTC date)
//   - 失敗回 { error }
function resolveClientTime(clientTime, timezone) {
  if (clientTime == null) return null
  const t = new Date(clientTime)
  if (Number.isNaN(t.getTime())) return { error: 'clientTime 格式錯誤' }
  const now = Date.now()
  const skewMs = 5 * 60 * 1000
  if (t.getTime() > now + skewMs) return { error: 'clientTime 不可為未來時間' }
  if (t.getTime() < now - 24 * 60 * 60 * 1000) return { error: 'clientTime 超過 24 小時，請重新打卡' }
  const dateStr = getDateStrInTZ(t, timezone)
  const workDate = dateStrToDate(dateStr)
  return { time: t, workDate }
}

export default async function attendanceRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate)

  // GET /api/attendance/today
  fastify.get('/api/attendance/today', async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      include: { company: true },
    })
    const today = getTodayStart(user?.company?.timezone)

    const record = await fastify.prisma.attendanceRecord.findUnique({
      where: {
        userId_workDate: {
          userId: request.user.id,
          workDate: today,
        },
      },
    })

    return record
  })

  // POST /api/punch-in
  fastify.post('/api/punch-in', { schema: { body: punchBodySchema } }, async (request, reply) => {
    const { lat, lng, clientTime } = request.body || {}

    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      include: { company: true },
    })

    const timezone = user?.company?.timezone
    const resolved = resolveClientTime(clientTime, timezone)
    if (resolved?.error) return reply.code(400).send({ error: resolved.error })
    const now = resolved?.time ?? new Date()
    const today = resolved?.workDate ?? getTodayStart(timezone)

    const existing = await fastify.prisma.attendanceRecord.findUnique({
      where: { userId_workDate: { userId: request.user.id, workDate: today } },
    })

    if (existing?.punchIn) {
      return reply.code(400).send({ error: '今日已打過上班卡' })
    }

    const resolvedShift = await getShiftForDate(fastify.prisma, request.user.id, today)
    const shift = resolvedShift?.shift ?? null
    const { isLate } = computeAttendanceFlags({
      punchIn: now,
      shift,
      workDate: today,
      timezone,
    })

    const locations = await getCompanyLocations(fastify, user?.companyId)
    const { locationId, locationType } = resolveLocation(locations, lat, lng)

    const check = buildOnsiteCheck({
      company: user?.company,
      todayRecord: existing ?? { workDate: today },
      locationType,
      clientIp: request.ip,
    })
    if (!check.ok) {
      return reply.code(403).send({ error: check.message, code: check.code })
    }

    const record = await fastify.prisma.attendanceRecord.upsert({
      where: { userId_workDate: { userId: request.user.id, workDate: today } },
      update: {
        punchIn: now, isLate,
        punchInLat: typeof lat === 'number' ? lat : null,
        punchInLng: typeof lng === 'number' ? lng : null,
        punchInLocationId: locationId,
        punchInLocationType: locationType,
        punchInIp: request.ip,
      },
      create: {
        userId: request.user.id,
        workDate: today,
        punchIn: now,
        isLate,
        punchInLat: typeof lat === 'number' ? lat : null,
        punchInLng: typeof lng === 'number' ? lng : null,
        punchInLocationId: locationId,
        punchInLocationType: locationType,
        punchInIp: request.ip,
      },
    })

    return record
  })

  // POST /api/punch-out
  fastify.post('/api/punch-out', { schema: { body: punchBodySchema } }, async (request, reply) => {
    const { lat, lng, clientTime } = request.body || {}

    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      include: { company: true },
    })

    const timezone = user?.company?.timezone
    const resolved = resolveClientTime(clientTime, timezone)
    if (resolved?.error) return reply.code(400).send({ error: resolved.error })
    const now = resolved?.time ?? new Date()
    const today = resolved?.workDate ?? getTodayStart(timezone)

    // 先找今天的紀錄；今天無可下班的紀錄時，回溯昨天的跨日班（凌晨下班歸排班日）
    let workDate = today
    let record = await fastify.prisma.attendanceRecord.findUnique({
      where: { userId_workDate: { userId: request.user.id, workDate: today } },
    })
    let resolvedShift = null
    if (record?.punchIn) {
      resolvedShift = await getShiftForDate(fastify.prisma, request.user.id, workDate)
    } else {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const yesterdayRecord = await fastify.prisma.attendanceRecord.findUnique({
        where: { userId_workDate: { userId: request.user.id, workDate: yesterday } },
      })
      const yesterdayResolved = await getShiftForDate(fastify.prisma, request.user.id, yesterday)
      if (shouldFallbackToYesterday({
        todayRecord: record,
        yesterdayRecord,
        yesterdayShift: yesterdayResolved?.shift ?? null,
      })) {
        workDate = yesterday
        record = yesterdayRecord
        resolvedShift = yesterdayResolved
      }
    }

    if (!record?.punchIn) {
      return reply.code(400).send({ error: '尚未打上班卡' })
    }

    if (record.punchOut && now <= record.punchOut) {
      return record
    }

    const punchOut = now
    const shift = resolvedShift?.shift ?? null
    const workDuration = computeWorkDuration(
      record.punchIn, punchOut, shift?.breakMinutes ?? user?.company?.breakMinutes,
    )

    // isLate / isEarlyLeave 一律從「打卡時間 vs 班別時間」重新計算，
    // 不依賴既有欄位值，避免多次打下班卡覆蓋時語意被洗掉
    const company = user?.company
    const { isLate, isEarlyLeave } = computeAttendanceFlags({
      punchIn: record.punchIn,
      punchOut,
      shift,
      workDate,
      timezone,
    })

    const locations = await getCompanyLocations(fastify, user?.companyId)
    const { locationId, locationType } = resolveLocation(locations, lat, lng)

    const check = buildOnsiteCheck({
      company,
      todayRecord: record,
      locationType,
      clientIp: request.ip,
    })
    if (!check.ok) {
      return reply.code(403).send({ error: check.message, code: check.code })
    }

    const updated = await fastify.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        punchOut, workDuration, isLate, isEarlyLeave,
        punchOutLat: typeof lat === 'number' ? lat : null,
        punchOutLng: typeof lng === 'number' ? lng : null,
        punchOutLocationId: locationId,
        punchOutLocationType: locationType,
        punchOutIp: request.ip,
      },
    })

    return updated
  })

  // GET /api/attendance/today-required — client 預先知道今天要不要 onsite
  fastify.get('/api/attendance/today-required', async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      include: { company: true },
    })
    const today = getTodayStart(user?.company?.timezone)
    const required = isOnsiteRequired(today, user?.company)
    const locations = required
      ? await fastify.prisma.companyLocation.findMany({
          where: { companyId: user?.companyId ?? '' },
          select: { id: true, name: true, lat: true, lng: true, radius: true },
        })
      : []
    return {
      onsiteRequired: required,
      locations,
      wifiCheckinEnabled: Boolean(user?.company?.wifiCheckinEnabled),
    }
  })

  // GET /api/attendance?month=2026-02
  fastify.get('/api/attendance', async (request) => {
    const { month } = request.query
    let where = { userId: request.user.id }

    if (month) {
      const [year, m] = month.split('-').map(Number)
      // workDate 為 UTC @db.Date；範圍邊界一律用 Date.UTC 顯式建構，
      // 不依賴 server 本地時區（P2-10）
      const start = new Date(Date.UTC(year, m - 1, 1))
      const end = new Date(Date.UTC(year, m, 1))
      where.workDate = { gte: start, lt: end }
    }

    const records = await fastify.prisma.attendanceRecord.findMany({
      where,
      orderBy: { workDate: 'desc' },
    })

    return records
  })

  // GET /api/attendance/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD — 自己的班表（from/to 皆含）
  fastify.get('/api/attendance/schedule', async (request, reply) => {
    const { from, to } = request.query
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (!datePattern.test(from ?? '') || !datePattern.test(to ?? '')) {
      return reply.code(400).send({ error: 'from / to 需為 YYYY-MM-DD 格式' })
    }
    if (dateStrToDate(from).toISOString().slice(0, 10) !== from || dateStrToDate(to).toISOString().slice(0, 10) !== to) {
      return reply.code(400).send({ error: 'from / to 含無效的日期' })
    }
    const DAY_MS = 24 * 60 * 60 * 1000
    const startDate = dateStrToDate(from)
    const endExclusive = new Date(dateStrToDate(to).getTime() + DAY_MS)
    const days = Math.round((endExclusive - startDate) / DAY_MS)
    if (days <= 0 || days > 62) {
      return reply.code(400).send({ error: '查詢區間需為 1–62 天' })
    }

    const bundle = await loadScheduleBundle(fastify.prisma, {
      userIds: [request.user.id], startDate, endDate: endExclusive,
    })
    const out = []
    for (let i = 0; i < days; i++) {
      const dateStr = new Date(startDate.getTime() + i * DAY_MS).toISOString().slice(0, 10)
      const resolved = shiftFor(bundle, request.user.id, dateStr)
      out.push({
        date: dateStr,
        shift: resolved
          ? {
              id: resolved.shift.id, name: resolved.shift.name,
              startTime: resolved.shift.startTime, endTime: resolved.shift.endTime,
            }
          : null,
        source: resolved?.source ?? null,
      })
    }
    return out
  })
}
