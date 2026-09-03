import test from 'node:test'
import assert from 'node:assert/strict'

class MemoryStorage {
  #data = new Map()
  getItem(key) { return this.#data.has(key) ? this.#data.get(key) : null }
  setItem(key, value) { this.#data.set(key, String(value)) }
  removeItem(key) { this.#data.delete(key) }
  clear() { this.#data.clear() }
}
globalThis.localStorage = new MemoryStorage()

// 記錄每次 fetch 的呼叫參數，並回傳排定的回應
const calls = []
let nextResponses = []
function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error('no body')
      return body
    },
  }
}
globalThis.fetch = async (url, options) => {
  calls.push({ url, options })
  const next = nextResponses.shift()
  if (!next) throw new Error(`沒有為 ${url} 預備回應`)
  if (next instanceof Error) throw next
  return next
}

const auth = await import('../src/services/auth.js')

test.beforeEach(() => {
  localStorage.clear()
  calls.length = 0
  nextResponses = []
})

test('登入成功後保存 token 並回傳使用者', async () => {
  nextResponses = [jsonResponse(200, { token: 'jwt-abc', user: { id: 'u1', name: '小明' } })]

  const user = await auth.loginWithPassword('user@example.com', 'pw-1234')

  assert.deepEqual(user, { id: 'u1', name: '小明' })
  assert.equal(auth.getStoredToken(), 'jwt-abc')
  assert.equal(calls[0].url, '/api/auth/login')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'user@example.com', password: 'pw-1234' })
  assert.ok(calls[0].options.headers['Accept-Language'], '應帶 Accept-Language 供 server 決定錯誤語言')
})

test('登入失敗不寫入 token，並保留 server 的錯誤訊息與狀態碼', async () => {
  nextResponses = [jsonResponse(401, { error: '帳號或密碼錯誤' })]

  await assert.rejects(
    auth.loginWithPassword('user@example.com', 'wrong'),
    (err) => {
      assert.equal(err.message, '帳號或密碼錯誤')
      assert.equal(err.status, 401)
      return true
    },
  )
  assert.equal(auth.getStoredToken(), null, '失敗時不應留下 token')
})

test('登入失敗且回應非 JSON 時仍給出可讀錯誤', async () => {
  nextResponses = [jsonResponse(500, undefined)]
  await assert.rejects(auth.loginWithPassword('user@example.com', 'pw'), (err) => {
    assert.equal(err.status, 500)
    assert.ok(err.message.length > 0)
    return true
  })
})

test('登出移除 token', () => {
  localStorage.setItem('auth_token', 'jwt-abc')
  auth.logout()
  assert.equal(auth.getStoredToken(), null)
})

test('無 token 時 getCurrentUser 不發請求', async () => {
  const user = await auth.getCurrentUser()
  assert.equal(user, null)
  assert.equal(calls.length, 0)
})

test('token 失效時 getCurrentUser 清掉 token 並回傳 null', async () => {
  localStorage.setItem('auth_token', 'expired')
  nextResponses = [jsonResponse(401, { error: '帳號已停用' })]

  const user = await auth.getCurrentUser()

  assert.equal(user, null)
  assert.equal(auth.getStoredToken(), null, '失效 token 應被清除，避免持續帶著送出')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer expired')
})

test('修改密碼會帶上 Authorization', async () => {
  localStorage.setItem('auth_token', 'jwt-abc')
  nextResponses = [jsonResponse(200, { ok: true })]

  await auth.changePassword('old-pw', 'new-pw-1234')

  assert.equal(calls[0].url, '/api/auth/change-password')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer jwt-abc')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    currentPassword: 'old-pw', newPassword: 'new-pw-1234',
  })
})
