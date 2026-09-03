import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

// 必須在 register 前設定，authPlugin 未設定 JWT_SECRET 會 process.exit(1)
process.env.JWT_SECRET = 'test-secret-for-auth-plugin-tests'
const { default: authPlugin } = await import('../src/plugins/auth.js')

function makeRedisMock(store = new Map()) {
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null },
    async set(key, value) { store.set(key, value) },
    async del(key) { store.delete(key) },
  }
}

async function buildApp({ findUnique, redis = null }) {
  const app = Fastify()
  app.decorate('prisma', { user: { findUnique } })
  app.decorate('redis', redis)
  await app.register(authPlugin)
  app.get('/protected', { onRequest: [app.authenticate] }, async (request) => ({ id: request.user.id }))
  await app.ready()
  return app
}

function signToken(app, id = 'u1') {
  return app.jwt.sign({ id, email: 'u1@example.com' })
}

test('無 token → 401', async () => {
  const app = await buildApp({ findUnique: async () => ({ deletedAt: null }) })
  const res = await app.inject({ method: 'GET', url: '/protected' })
  assert.equal(res.statusCode, 401)
  await app.close()
})

test('有效 token + 在職帳號 → 200', async () => {
  const app = await buildApp({ findUnique: async () => ({ deletedAt: null }) })
  const res = await app.inject({
    method: 'GET', url: '/protected',
    headers: { authorization: `Bearer ${signToken(app)}` },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().id, 'u1')
  await app.close()
})

test('已停用帳號的有效 token → 401 帳號已停用', async () => {
  const app = await buildApp({ findUnique: async () => ({ deletedAt: new Date() }) })
  const res = await app.inject({
    method: 'GET', url: '/protected',
    headers: { authorization: `Bearer ${signToken(app)}` },
  })
  assert.equal(res.statusCode, 401)
  assert.equal(res.json().error, '帳號已停用')
  await app.close()
})

test('查無此使用者 → 401', async () => {
  const app = await buildApp({ findUnique: async () => null })
  const res = await app.inject({
    method: 'GET', url: '/protected',
    headers: { authorization: `Bearer ${signToken(app)}` },
  })
  assert.equal(res.statusCode, 401)
  await app.close()
})

test('通過檢查後寫入 active cache；cache 命中時不再查 DB', async () => {
  let dbHits = 0
  const redis = makeRedisMock()
  const app = await buildApp({
    findUnique: async () => { dbHits += 1; return { deletedAt: null } },
    redis,
  })
  const headers = { authorization: `Bearer ${signToken(app)}` }

  const first = await app.inject({ method: 'GET', url: '/protected', headers })
  assert.equal(first.statusCode, 200)
  assert.equal(dbHits, 1)
  assert.equal(redis.store.get('user:active:u1'), '1')

  const second = await app.inject({ method: 'GET', url: '/protected', headers })
  assert.equal(second.statusCode, 200)
  assert.equal(dbHits, 1) // cache 命中，沒有第二次 DB 查詢
  await app.close()
})

test('revokeUserStatus 清 cache 後，停用帳號下一個請求即 401', async () => {
  let deleted = false
  const redis = makeRedisMock()
  const app = await buildApp({
    findUnique: async () => ({ deletedAt: deleted ? new Date() : null }),
    redis,
  })
  const headers = { authorization: `Bearer ${signToken(app)}` }

  assert.equal((await app.inject({ method: 'GET', url: '/protected', headers })).statusCode, 200)

  // 停用 + 清 cache（模擬 admin 刪除員工）
  deleted = true
  await app.revokeUserStatus('u1')

  assert.equal((await app.inject({ method: 'GET', url: '/protected', headers })).statusCode, 401)
  await app.close()
})

test('Redis 為 null 時 graceful degrade 成查 DB', async () => {
  let dbHits = 0
  const app = await buildApp({
    findUnique: async () => { dbHits += 1; return { deletedAt: null } },
    redis: null,
  })
  const headers = { authorization: `Bearer ${signToken(app)}` }
  await app.inject({ method: 'GET', url: '/protected', headers })
  await app.inject({ method: 'GET', url: '/protected', headers })
  assert.equal(dbHits, 2)
  await app.close()
})

test('Redis get 失敗時 degrade 成查 DB 不擋請求', async () => {
  const brokenRedis = {
    async get() { throw new Error('redis down') },
    async set() { throw new Error('redis down') },
    async del() { throw new Error('redis down') },
  }
  const app = await buildApp({
    findUnique: async () => ({ deletedAt: null }),
    redis: brokenRedis,
  })
  const res = await app.inject({
    method: 'GET', url: '/protected',
    headers: { authorization: `Bearer ${signToken(app)}` },
  })
  assert.equal(res.statusCode, 200)
  await app.close()
})
