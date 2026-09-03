import fp from 'fastify-plugin'
import Redis from 'ioredis'

// REDIS_URL 範例：redis://redis:6379 (docker-compose) / redis://localhost:6379 (本機)
// 連線失敗 → fastify.redis = null，呼叫端需 graceful degrade
export default fp(async function redisPlugin(fastify) {
  const url = process.env.REDIS_URL
  if (!url) {
    fastify.log.warn('REDIS_URL 未設定，跳過 Redis 連線 (cache 將停用)')
    fastify.decorate('redis', null)
    return
  }

  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  })

  redis.on('error', (err) => {
    fastify.log.error({ err: err?.message }, 'Redis error')
  })

  try {
    await redis.connect()
    const pong = await redis.ping()
    if (pong !== 'PONG') throw new Error(`unexpected PING response: ${pong}`)
    fastify.log.info(`Redis connected (${url})`)
    fastify.decorate('redis', redis)
  } catch (err) {
    fastify.log.error({ err: err?.message }, 'Redis 連線失敗，cache 停用 (將以 null 取代)')
    try { redis.disconnect() } catch { /* noop */ }
    fastify.decorate('redis', null)
    return
  }

  fastify.addHook('onClose', async () => {
    try {
      await redis.quit()
    } catch {
      redis.disconnect()
    }
  })
})
