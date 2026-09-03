import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import prismaPlugin from './plugins/prisma.js'
import redisPlugin from './plugins/redis.js'
import authPlugin from './plugins/auth.js'
import i18nPlugin from './plugins/i18n.js'
import authRoutes from './routes/auth.js'
import attendanceRoutes from './routes/attendance.js'
import correctionRoutes from './routes/correction.js'
import adminRoutes from './routes/admin.js'
import leaveRoutes from './routes/leave.js'
import overtimeRoutes from './routes/overtime.js'
import holidayRoutes from './routes/holidays.js'
import payrollRoutes from './routes/payroll.js'
import approvalRoutes from './routes/approvals.js'
import shiftRoutes from './routes/shifts.js'
import { parseTrustProxy } from './utils/trustProxy.js'

// 反向代理後面才信任 X-Forwarded-For，request.ip 才會是真實 client IP (WiFi 打卡驗證用)。
// 預設不信任；部署在 proxy 後面時用 TRUST_PROXY 指定跳數或 proxy 位址（見 utils/trustProxy.js）。
const fastify = Fastify({ logger: true, trustProxy: parseTrustProxy(process.env.TRUST_PROXY) })

// Plugins
// CORS 允許多個來源 (員工端 client + 管理後台 admin)
// 用 CORS_ORIGINS 逗號分隔，例如:
//   CORS_ORIGINS=https://app.example.com,https://admin.example.com
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

await fastify.register(cors, {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
})
await fastify.register(helmet)
await fastify.register(rateLimit, {
  global: false,
  max: 100,
  timeWindow: '1 minute',
})

// i18n 需早於 routes 註冊：onSend hook 會在出口翻譯訊息欄位
await fastify.register(i18nPlugin)

// 全域 error handler：4xx（validation / rate limit 等已知錯誤）照常回訊息；
// 5xx 一律回 generic 訊息，完整錯誤（含 Prisma schema 細節）只進 log
fastify.setErrorHandler((err, request, reply) => {
  const status = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500
    ? err.statusCode
    : 500
  if (status < 500) {
    return reply.code(status).send({ error: err.message })
  }
  request.log.error({ err }, 'unhandled server error')
  return reply.code(500).send({ error: '伺服器發生錯誤，請稍後再試' })
})
await fastify.register(prismaPlugin)
await fastify.register(redisPlugin)
await fastify.register(authPlugin)

// Routes
await fastify.register(authRoutes)
await fastify.register(attendanceRoutes)
await fastify.register(correctionRoutes)
await fastify.register(adminRoutes)
await fastify.register(leaveRoutes)
await fastify.register(overtimeRoutes)
await fastify.register(holidayRoutes)
await fastify.register(payrollRoutes)
await fastify.register(approvalRoutes)
await fastify.register(shiftRoutes)

// Health check
fastify.get('/api/health', async () => ({ status: 'ok' }))

// Start
const PORT = process.env.PORT || 3000

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
