import bcrypt from 'bcryptjs'
import { toUserDto } from '../utils/user.js'
import { shouldLock, remainingLockMs, remainingAttempts, lockDurationMs } from '../services/loginLockout.js'
import { body, str } from '../utils/schema.js'

const GENERIC_AUTH_ERROR = '帳號或密碼錯誤'

export default async function authRoutes(fastify) {
  // POST /api/auth/login — email + password 登入
  // IP-based rate limit：擋暴力嘗試與「故意打錯鎖別人帳號」的濫用
  fastify.post('/api/auth/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
    schema: { body: body({ email: str, password: str }) },
  }, async (request, reply) => {
    const { email, password } = request.body || {}
    if (!email || !password) {
      return reply.code(400).send({ error: '請輸入 email 與密碼' })
    }

    // 顯式 opt-in 讀取 password (預設被 global omit 擋掉)
    const user = await fastify.prisma.user.findUnique({
      where: { email },
      omit: { password: false },
    })

    // 統一錯誤訊息避免洩漏帳號是否存在 / 是否已離職
    if (!user || !user.password || user.deletedAt) {
      return reply.code(401).send({ error: GENERIC_AUTH_ERROR })
    }

    // 時間性鎖定：期滿自動放行（計數不歸零，再錯會鎖更久一輪）
    const lockMs = remainingLockMs(user)
    if (lockMs > 0) {
      const waitMin = Math.ceil(lockMs / 60000)
      return reply.code(423).send({
        error: `密碼錯誤次數過多，帳號暫時鎖定，請於 ${waitMin} 分鐘後再試`,
        retryAfterMinutes: waitMin,
      })
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      const nextCount = user.failedLoginCount + 1
      const lockNow = shouldLock(nextCount)
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: nextCount,
          ...(lockNow ? { lockedAt: new Date() } : {}),
        },
      })
      if (lockNow) {
        const waitMin = Math.ceil(lockDurationMs(nextCount) / 60000)
        return reply.code(423).send({
          error: `密碼錯誤次數過多，帳號暫時鎖定，請於 ${waitMin} 分鐘後再試`,
          retryAfterMinutes: waitMin,
        })
      }
      const remaining = remainingAttempts(nextCount)
      return reply.code(401).send({
        error: `${GENERIC_AUTH_ERROR}，剩餘嘗試次數 ${remaining}`,
        remainingAttempts: remaining,
      })
    }

    // 成功 → 計數與鎖定一併歸零
    if (user.failedLoginCount !== 0 || user.lockedAt) {
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedAt: null },
      })
    }

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
    })

    return { token, user: toUserDto(user) }
  })

  // POST /api/auth/change-password
  fastify.post('/api/auth/change-password', {
    onRequest: [fastify.authenticate],
    schema: { body: body({ currentPassword: str, newPassword: str }) },
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body || {}
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: '請輸入目前密碼與新密碼' })
    }
    if (newPassword.length < 8) {
      return reply.code(400).send({ error: '新密碼長度至少 8 碼' })
    }
    if (newPassword === currentPassword) {
      return reply.code(400).send({ error: '新密碼不可與目前密碼相同' })
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      omit: { password: false },
    })

    if (!user || user.deletedAt) {
      return reply.code(401).send({ error: '帳號不存在' })
    }
    if (!user.password) {
      return reply.code(400).send({ error: '帳號尚未設定密碼，請聯絡管理員' })
    }

    const ok = await bcrypt.compare(currentPassword, user.password)
    if (!ok) {
      return reply.code(401).send({ error: '目前密碼錯誤' })
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    })

    return { ok: true }
  })

  // GET /api/auth/me
  fastify.get('/api/auth/me', {
    onRequest: [fastify.authenticate],
  }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
    })
    if (!user || user.deletedAt) return null
    return toUserDto(user)
  })
}
