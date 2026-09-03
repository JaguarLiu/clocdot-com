const bodySchema = {
  type: 'object',
  required: ['companyName', 'contactName', 'email'],
  additionalProperties: false,
  properties: {
    companyName: { type: 'string', minLength: 1, maxLength: 200 },
    contactName: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string', format: 'email', maxLength: 254 },
    headcount: { type: 'integer', minimum: 1, maximum: 100000, nullable: true },
    note: { type: 'string', maxLength: 2000, nullable: true },
    // honeypot — must be empty
    website: { type: 'string', maxLength: 0, nullable: true },
  },
}

const DAILY_CAP = Number(process.env.APPLY_DAILY_CAP_PER_IP || 10)
const GLOBAL_DAILY_CAP = Number(process.env.APPLY_GLOBAL_DAILY_CAP || 80)

function ymdUTC(d = new Date()) {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function secondsUntilUTCMidnight(d = new Date()) {
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))
  return Math.max(60, Math.ceil((next.getTime() - d.getTime()) / 1000))
}

export default async function applyRoutes(fastify) {
  // Daily caps via Redis. Redis 不可用時跳過 (route 層仍有 5/min 防護)。
  async function enforceDailyCaps(request, reply) {
    if (!fastify.redis) return
    const ymd = ymdUTC()
    const ttl = secondsUntilUTCMidnight()
    const ip = (request.ip || 'unknown').replace(/[^a-zA-Z0-9:.]/g, '_')

    const ipKey = `apply:cap:ip:${ip}:${ymd}`
    const globalKey = `apply:cap:global:${ymd}`

    try {
      const [ipCount, globalCount] = await Promise.all([
        fastify.redis.incr(ipKey).then(async (n) => {
          if (n === 1) await fastify.redis.expire(ipKey, ttl)
          return n
        }),
        fastify.redis.incr(globalKey).then(async (n) => {
          if (n === 1) await fastify.redis.expire(globalKey, ttl)
          return n
        }),
      ])

      if (ipCount > DAILY_CAP) {
        request.log.warn({ ip, ipCount }, 'apply daily IP cap exceeded')
        reply.header('Retry-After', ttl)
        return reply.code(429).send({ error: 'daily limit reached' })
      }
      if (globalCount > GLOBAL_DAILY_CAP) {
        request.log.warn({ globalCount }, 'apply global daily cap exceeded')
        reply.header('Retry-After', ttl)
        return reply.code(429).send({ error: 'service busy, try again tomorrow' })
      }
    } catch (err) {
      // Redis 失敗 → 不阻塞合法使用者；route 層 rate-limit 仍會擋暴衝
      request.log.error({ err: err.message }, 'apply daily cap check failed (degrade)')
    }
  }

  fastify.post(
    '/api/apply',
    {
      config: {
        rateLimit: { max: 3, timeWindow: '1 minute' },
      },
      schema: { body: bodySchema },
      preHandler: enforceDailyCaps,
    },
    async (request, reply) => {
      const { companyName, contactName, email, headcount, note, website } = request.body

      // honeypot 命中：靜默回 ok，不告訴 bot 它被擋了
      if (website && website.length > 0) {
        request.log.info({ ip: request.ip }, 'apply honeypot triggered')
        return { ok: true }
      }

      const record = await fastify.prisma.waitingList.create({
        data: {
          companyName,
          contactName,
          email,
          headcount: headcount ?? null,
          note: note ?? null,
        },
        select: { id: true, createdAt: true },
      })

      // 寄信失敗不影響使用者：DB 已存，至多人工從 DB 撈
      try {
        const safeNote = (note || '(無)').slice(0, 1000)
        await fastify.mailer.send({
          subject: `[ClocDot] 新申請 · ${companyName}`,
          replyTo: email,
          text:
            `公司：${companyName}\n` +
            `聯絡人：${contactName}\n` +
            `Email：${email}\n` +
            `人數：${headcount ?? '(未填)'}\n` +
            `備註：${safeNote}\n` +
            `\n----\n` +
            `ID：${record.id}\n` +
            `時間：${record.createdAt.toISOString()}\n`,
        })
      } catch (err) {
        request.log.error({ err: err.message, applicationId: record.id }, 'apply notify email failed')
      }

      reply.code(201)
      return { ok: true }
    },
  )
}
