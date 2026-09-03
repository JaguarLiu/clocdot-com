import { geocodeAddress } from '../../utils/geocode.js'
import { validateOnsiteSchedule } from '../../services/onsiteSchedule.js'
import { isValidIpOrCidr } from '../../utils/ipMatch.js'
import { assertOwnedByCompany } from '../../utils/tenant.js'

export function registerCompanyRoutes(fastify, S) {
// GET /api/admin/company — 取得目前管理員所屬公司設定
fastify.get('/api/admin/company', async (request, reply) => {
  const company = await fastify.prisma.company.findUnique({
    where: { id: request.companyId },
  })
  if (!company) return reply.code(404).send({ error: '找不到公司' })
  return company
})

// PATCH /api/admin/company — 更新公司名稱 / 午休分鐘數 / Onsite 排班 / 彈性工時
fastify.patch('/api/admin/company', { preHandler: fastify.requireModule('settings'), schema: { body: S.companyPatch } }, async (request, reply) => {
  const {
    name, breakMinutes, leavePolicyYearReset,
    onsiteCycleWeeks, onsiteWeekdaysByCycle, onsiteMonthDays, scheduleAnchorDate,
    flexibleOvertime, approvalLevels, workHourType, lateDeductMode,
    wifiCheckinEnabled, allowedIps,
  } = request.body || {}

  const data = {}
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return reply.code(400).send({ error: '公司名稱不可為空' })
    }
    data.name = name.trim()
  }

  if (breakMinutes !== undefined) {
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 480) {
      return reply.code(400).send({ error: '午休分鐘數需為 0–480 的整數' })
    }
    data.breakMinutes = breakMinutes
  }
  if (leavePolicyYearReset !== undefined) {
    if (!['anniversary', 'calendar'].includes(leavePolicyYearReset)) {
      return reply.code(400).send({ error: 'leavePolicyYearReset 只接受 anniversary 或 calendar' })
    }
    data.leavePolicyYearReset = leavePolicyYearReset
  }
  if (flexibleOvertime !== undefined) {
    if (typeof flexibleOvertime !== 'boolean') {
      return reply.code(400).send({ error: '彈性工時設定需為布林值' })
    }
    data.flexibleOvertime = flexibleOvertime
  }
  if (approvalLevels !== undefined) {
    const n = Number(approvalLevels)
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      return reply.code(400).send({ error: '簽核層數需為 1–10 的整數' })
    }
    data.approvalLevels = n
  }
  if (workHourType !== undefined) {
    if (!['flexible', 'fixed'].includes(workHourType)) {
      return reply.code(400).send({ error: 'workHourType 只接受 flexible 或 fixed' })
    }
    data.workHourType = workHourType
  }
  if (lateDeductMode !== undefined) {
    if (!['per_minute', 'per_hour'].includes(lateDeductMode)) {
      return reply.code(400).send({ error: 'lateDeductMode 只接受 per_minute 或 per_hour' })
    }
    data.lateDeductMode = lateDeductMode
  }

  // Onsite 排班
  if (onsiteCycleWeeks !== undefined || onsiteWeekdaysByCycle !== undefined || onsiteMonthDays !== undefined) {
    const err = validateOnsiteSchedule({ onsiteCycleWeeks, onsiteWeekdaysByCycle, onsiteMonthDays })
    if (err) return reply.code(400).send({ error: err })
    if (onsiteCycleWeeks !== undefined) data.onsiteCycleWeeks = onsiteCycleWeeks
    if (onsiteWeekdaysByCycle !== undefined) {
      // 每筆內排序去重，外層保留 cycle 順序
      data.onsiteWeekdaysByCycle = onsiteWeekdaysByCycle.map(
        (row) => Array.from(new Set(row)).sort((a, b) => a - b),
      )
    }
    if (onsiteMonthDays !== undefined) {
      data.onsiteMonthDays = Array.from(new Set(onsiteMonthDays)).sort((a, b) => a - b)
    }
  }
  if (scheduleAnchorDate !== undefined) {
    if (scheduleAnchorDate === null || scheduleAnchorDate === '') {
      data.scheduleAnchorDate = null
    } else {
      const d = new Date(scheduleAnchorDate)
      if (Number.isNaN(d.getTime())) {
        return reply.code(400).send({ error: 'scheduleAnchorDate 格式錯誤' })
      }
      data.scheduleAnchorDate = d
    }
  }

  // WiFi 打卡設定
  if (wifiCheckinEnabled !== undefined || allowedIps !== undefined) {
    if (allowedIps !== undefined) {
      if (!Array.isArray(allowedIps) || allowedIps.some((s) => !isValidIpOrCidr(s))) {
        return reply.code(400).send({ error: 'allowedIps 每筆需為合法 IP 或 CIDR 網段' })
      }
      data.allowedIps = allowedIps.map((s) => s.trim())
    }
    if (wifiCheckinEnabled !== undefined) {
      if (typeof wifiCheckinEnabled !== 'boolean') {
        return reply.code(400).send({ error: 'wifiCheckinEnabled 需為布林值' })
      }
      data.wifiCheckinEnabled = wifiCheckinEnabled
    }
    // 啟用時清單不得為空（看更新後的最終值）— 避免把全公司鎖在門外
    const current = await fastify.prisma.company.findUnique({
      where: { id: request.companyId },
      select: { wifiCheckinEnabled: true, allowedIps: true },
    })
    const finalEnabled = data.wifiCheckinEnabled ?? current?.wifiCheckinEnabled ?? false
    const finalIps = data.allowedIps ?? current?.allowedIps ?? []
    if (finalEnabled && finalIps.length === 0) {
      return reply.code(400).send({ error: '啟用 WiFi 打卡前需至少設定一筆允許 IP' })
    }
  }

  return fastify.prisma.company.update({ where: { id: request.companyId }, data })
})

// GET /api/admin/my-ip — 給設定頁「使用我目前的 IP」按鈕
fastify.get('/api/admin/my-ip', { preHandler: fastify.requireModule('settings') }, async (request) => {
  return { ip: request.ip }
})

// GET /api/admin/company-locations — 列出該公司所有地點
fastify.get('/api/admin/company-locations', { preHandler: fastify.requireModule('settings') }, async (request) => {
  return fastify.prisma.companyLocation.findMany({
    where: { companyId: request.companyId },
    orderBy: { createdAt: 'asc' },
  })
})

// 每公司 30 分鐘內最多 geocode 一次，避免 Google Maps API 被反覆呼叫
// key: geocode:<companyId> ; cache 命中 → 拒絕再次 geocode
const GEOCODE_RATE_LIMIT_TTL = 30 * 60 // 30 分鐘
async function checkGeocodeRateLimit(companyId, reply) {
  const key = `geocode:${companyId}`
  if (!fastify.redis) {
    fastify.log.warn({ key }, 'geocode rate-limit: Redis 未連線，放行')
    return false
  }
  let value = null
  try {
    value = await fastify.redis.get(key)
  } catch (err) {
    fastify.log.error({ err: err?.message, key }, 'geocode rate-limit GET 失敗，放行')
    return false
  }
  fastify.log.info({ key, value }, 'geocode rate-limit GET')
  if (value !== null) {
    let ttl = GEOCODE_RATE_LIMIT_TTL
    try {
      const t = await fastify.redis.ttl(key)
      if (Number.isInteger(t) && t > 0) ttl = t
    } catch { /* noop */ }
    reply.code(429).send({
      error: '地址編輯太過頻繁，請稍後再試',
      code: 'GEOCODE_RATE_LIMIT',
      retryAfterSeconds: ttl,
    })
    return true
  }
  return false
}
async function markGeocodeUsed(companyId) {
  const key = `geocode:${companyId}`
  if (!fastify.redis) {
    fastify.log.warn({ key }, 'geocode rate-limit SET 跳過 (Redis 未連線)')
    return
  }
  try {
    const result = await fastify.redis.set(key, '1', 'EX', GEOCODE_RATE_LIMIT_TTL)
    fastify.log.info({ key, ttl: GEOCODE_RATE_LIMIT_TTL, result }, 'geocode rate-limit SET 成功')
  } catch (err) {
    fastify.log.error({ err: err?.message, key }, 'geocode rate-limit SET 失敗')
  }
}

// POST /api/admin/company-locations — 新增地點（自動 geocode）
fastify.post('/api/admin/company-locations', { preHandler: fastify.requireModule('settings'), schema: { body: S.location } }, async (request, reply) => {
  const { name, address, radius } = request.body || {}
  if (!name || !address) {
    return reply.code(400).send({ error: 'name 與 address 為必填' })
  }

  if (await checkGeocodeRateLimit(request.companyId, reply)) return

  let lat = null
  let lng = null
  try {
    const geo = await geocodeAddress(address)
    if (geo) {
      lat = geo.lat
      lng = geo.lng
    }
  } catch (err) {
    fastify.log.warn({ err }, 'geocode failed on create')
  }
  // 不論成功失敗都 mark — Google API 已被打過，要避免重試風暴
  await markGeocodeUsed(request.companyId)

  return fastify.prisma.companyLocation.create({
    data: {
      companyId: request.companyId,
      name,
      address,
      lat,
      lng,
      ...(Number.isInteger(radius) ? { radius } : {}),
    },
  })
})

// PATCH /api/admin/company-locations/:id — 編輯（地址變動才重新 geocode）
// 只要 cache 還在 → 不論改什麼欄位都拒絕（即使地址沒變/不一樣也擋）
fastify.patch('/api/admin/company-locations/:id', { preHandler: fastify.requireModule('settings'), schema: { body: S.location } }, async (request, reply) => {
  const { id } = request.params
  const existing = await assertOwnedByCompany(
    (rid) => fastify.prisma.companyLocation.findUnique({ where: { id: rid } }),
    id, request.companyId, reply,
    (rec) => rec.companyId,
  )
  if (!existing) return

  if (await checkGeocodeRateLimit(request.companyId, reply)) return

  const { name, address, radius } = request.body || {}
  const data = {}
  if (name !== undefined) data.name = name
  if (Number.isInteger(radius)) data.radius = radius

  if (address !== undefined && address !== existing.address) {
    data.address = address
    try {
      const geo = await geocodeAddress(address)
      data.lat = geo?.lat ?? null
      data.lng = geo?.lng ?? null
    } catch (err) {
      fastify.log.warn({ err }, 'geocode failed on update')
      data.lat = null
      data.lng = null
    }
  }

  const updated = await fastify.prisma.companyLocation.update({ where: { id }, data })
  // 每次編輯成功都 mark cache (不只 geocode 時)，下一次 30 分鐘內任何編輯都會被擋
  await markGeocodeUsed(request.companyId)
  return updated
})

// DELETE /api/admin/company-locations/:id
fastify.delete('/api/admin/company-locations/:id', { preHandler: fastify.requireModule('settings') }, async (request, reply) => {
  const { id } = request.params
  const existing = await assertOwnedByCompany(
    (rid) => fastify.prisma.companyLocation.findUnique({ where: { id: rid } }),
    id, request.companyId, reply,
    (rec) => rec.companyId,
  )
  if (!existing) return

  await fastify.prisma.companyLocation.delete({ where: { id } })
  return { ok: true }
})
}
