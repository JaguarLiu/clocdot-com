import fp from 'fastify-plugin'
import { resolveRetentionDays, retentionCutoff } from '../services/audit.js'

const DAY_MS = 24 * 60 * 60 * 1000
const LOCK_KEY = 'audit:retention:lock'
const LOCK_TTL_SECONDS = 60 * 60
const FIRST_RUN_DELAY_MS = 5 * 60 * 1000 // 開機後延遲，避開部署尖峰

// 稽核紀錄定時清理：每日刪除超過保存期限（AUDIT_LOG_RETENTION_DAYS，預設 5 年）的紀錄。
// 多個 instance 時以 Redis SET NX 搶鎖，同一時段只跑一次；Redis 不可用時各自執行（deleteMany 冪等）。
export default fp(async function auditRetentionPlugin(fastify) {
  if (process.env.AUDIT_LOG_RETENTION_DISABLED === 'true') return
  const days = resolveRetentionDays(process.env.AUDIT_LOG_RETENTION_DAYS)

  async function acquireLock() {
    if (!fastify.redis) return true
    try {
      return (await fastify.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX')) === 'OK'
    } catch {
      return true
    }
  }

  async function purge() {
    try {
      if (!(await acquireLock())) return
      const cutoff = retentionCutoff(new Date(), days)
      const { count } = await fastify.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
      fastify.log.info({ count, cutoff, retentionDays: days }, 'audit log retention purge')
    } catch (err) {
      fastify.log.error({ err }, 'audit log retention purge failed')
    }
  }

  let firstTimer = null
  let dailyTimer = null
  fastify.addHook('onReady', async () => {
    firstTimer = setTimeout(() => {
      purge()
      dailyTimer = setInterval(purge, DAY_MS)
      dailyTimer.unref()
    }, FIRST_RUN_DELAY_MS)
    firstTimer.unref()
  })
  fastify.addHook('onClose', async () => {
    clearTimeout(firstTimer)
    clearInterval(dailyTimer)
  })
})
