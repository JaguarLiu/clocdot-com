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

const api = await import('../src/services/api.js')

test.beforeEach(() => {
  localStorage.clear()
  calls.length = 0
  nextResponses = []
})

test('有 token 時自動帶上 Authorization', async () => {
  localStorage.setItem('auth_token', 'jwt-abc')
  nextResponses = [jsonResponse(200, { ok: true })]

  await api.punchIn({ lat: 25.03, lng: 121.56 })

  assert.equal(calls[0].url, '/api/punch-in')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer jwt-abc')
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json')
  assert.ok(calls[0].options.headers['Accept-Language'])
  // clientTime 未給時被 JSON.stringify 丟棄，不會送出 null
  assert.deepEqual(JSON.parse(calls[0].options.body), { lat: 25.03, lng: 121.56 })
})

test('無 token 時不帶 Authorization', async () => {
  nextResponses = [jsonResponse(200, { ok: true })]
  await api.punchOut({})
  assert.equal(calls[0].options.headers.Authorization, undefined)
})

test('GET 請求不設 Content-Type', async () => {
  nextResponses = [jsonResponse(200, [])]
  await api.getAttendanceRecords({ from: '2026-01-01', to: '2026-01-31' })
  assert.equal(calls[0].options.headers['Content-Type'], undefined)
  assert.match(calls[0].url, /^\/api\/attendance\?/)
  assert.match(calls[0].url, /from=2026-01-01/)
  assert.match(calls[0].url, /to=2026-01-31/)
})

test('fetch 拋錯（離線／DNS／TLS）標記為可辨識的網路錯誤', async () => {
  nextResponses = [new TypeError('Failed to fetch')]

  await assert.rejects(api.punchIn({}), (err) => {
    assert.equal(err.isNetworkError, true, '呼叫端要能分辨離線 vs server 錯誤')
    assert.equal(err.message, 'NETWORK_ERROR')
    assert.equal(err.status, undefined, '網路錯誤不應有 HTTP 狀態碼')
    assert.ok(err.cause instanceof TypeError, '應保留原始錯誤')
    return true
  })
})

test('server 4xx 帶出狀態碼與訊息，且不會被誤判為網路錯誤', async () => {
  nextResponses = [jsonResponse(409, { error: '今日已打卡' })]

  await assert.rejects(api.punchIn({}), (err) => {
    assert.equal(err.status, 409)
    assert.equal(err.message, '今日已打卡')
    assert.deepEqual(err.info, { error: '今日已打卡' })
    assert.notEqual(err.isNetworkError, true)
    return true
  })
})

test('錯誤回應非 JSON 時仍保留狀態碼並給預設訊息', async () => {
  nextResponses = [jsonResponse(502, undefined)]

  await assert.rejects(api.punchIn({}), (err) => {
    assert.equal(err.status, 502)
    assert.equal(err.info, null)
    assert.equal(err.message, 'API request failed')
    return true
  })
})

test('info.message 也會被採用為錯誤訊息', async () => {
  nextResponses = [jsonResponse(400, { message: 'validation failed' })]
  await assert.rejects(api.punchIn({}), (err) => {
    assert.equal(err.message, 'validation failed')
    return true
  })
})
