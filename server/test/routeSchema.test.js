import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

// P2-6：body schema 型別把關的整合測試。用 app.inject 掛真實 route，
// 驗證「物件塞進字串欄位 → 400（進不了 handler）」而「型別正確 → 照常進 handler」。
process.env.JWT_SECRET = 'test-secret-route-schema'
const { default: authRoutes } = await import('../src/routes/auth.js')
const { default: approvalRoutes } = await import('../src/routes/approvals.js')

// 與 app.js 相同的全域 error handler，讓 validation 錯誤以 { error } 呈現
function attachErrorHandler(app) {
  app.setErrorHandler((err, req, reply) => {
    const status = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500
    reply.code(status).send({ error: status < 500 ? err.message : 'server error' })
  })
}

async function buildAuthApp() {
  const app = Fastify()
  app.decorate('authenticate', async () => {})
  app.decorate('prisma', { user: { findUnique: async () => null } })
  app.decorate('jwt', { sign: () => 'tok' })
  attachErrorHandler(app)
  await app.register(authRoutes)
  await app.ready()
  return app
}

const login = (app, payload) => app.inject({ method: 'POST', url: '/api/auth/login', payload })

test('login：email 為物件 → 400（schema 擋型別混淆，進不了 handler）', async () => {
  const app = await buildAuthApp()
  const r = await login(app, { email: { $gt: '' }, password: 'y' })
  assert.equal(r.statusCode, 400)
  await app.close()
})

test('login：缺欄位 → handler 的 zh 400（schema 不強制 required）', async () => {
  const app = await buildAuthApp()
  const r = await login(app, {})
  assert.equal(r.statusCode, 400)
  assert.match(r.json().error, /請輸入/)
  await app.close()
})

test('login：型別正確但帳密錯 → 進 handler 回 401', async () => {
  const app = await buildAuthApp()
  const r = await login(app, { email: 'a@b.c', password: 'y' })
  assert.equal(r.statusCode, 401)
  await app.close()
})

test('login：多餘欄位放行（additionalProperties 寬鬆）→ 進 handler 401', async () => {
  const app = await buildAuthApp()
  const r = await login(app, { email: 'a@b.c', password: 'y', extra: 123 })
  assert.equal(r.statusCode, 401)
  await app.close()
})

test('login：完全無 body → 400（帶 body schema 的端點要求物件）', async () => {
  const app = await buildAuthApp()
  const r = await app.inject({ method: 'POST', url: '/api/auth/login' })
  assert.equal(r.statusCode, 400)
  await app.close()
})

// approvals：decision 型別把關；值的合法性仍由 handler 檢
async function buildApprovalApp() {
  const app = Fastify()
  app.decorate('authenticate', async () => {})
  app.decorate('prisma', {})
  attachErrorHandler(app)
  await app.register(approvalRoutes)
  await app.ready()
  return app
}

test('approvals decide：decision 為物件 → 400（schema 擋）', async () => {
  const app = await buildApprovalApp()
  const r = await app.inject({ method: 'POST', url: '/api/approvals/s1/decide', payload: { decision: { x: 1 } } })
  assert.equal(r.statusCode, 400)
  await app.close()
})

test('approvals decide：decision 字串但非法值 → handler zh 400', async () => {
  const app = await buildApprovalApp()
  const r = await app.inject({ method: 'POST', url: '/api/approvals/s1/decide', payload: { decision: 'bad' } })
  assert.equal(r.statusCode, 400)
  assert.match(r.json().error, /approve/)
  await app.close()
})
