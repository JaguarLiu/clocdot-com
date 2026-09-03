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
const queue = await import('../src/services/offlineQueue.js')

test.beforeEach(() => localStorage.clear())

test('offline queue keeps only the five newest punches', () => {
  for (let i = 0; i < 7; i += 1) queue.enqueuePunch({ action: i % 2 ? 'out' : 'in', lat: i, lng: i })
  assert.equal(queue.queueSize(), 5)
  assert.deepEqual(queue.listQueue().map((entry) => entry.lat), [2, 3, 4, 5, 6])
})

test('offline queue normalizes missing coordinates', () => {
  const entry = queue.enqueuePunch({ action: 'in' })
  assert.equal(entry.lat, null)
  assert.equal(entry.lng, null)
  assert.equal(queue.listQueue()[0].action, 'in')
})

test('replay removes successes and unrecoverable 4xx entries', async () => {
  queue.enqueuePunch({ action: 'in' })
  queue.enqueuePunch({ action: 'out' })
  let call = 0
  const result = await queue.replayQueue(async () => {
    call += 1
    if (call === 2) throw Object.assign(new Error('conflict'), { status: 409 })
  })
  assert.deepEqual(result, { sent: 1, dropped: 1, kept: 0 })
  assert.equal(queue.queueSize(), 0)
})

test('replay stops and preserves remaining entries on network or 5xx errors', async () => {
  queue.enqueuePunch({ action: 'in' })
  queue.enqueuePunch({ action: 'out' })
  const networkError = Object.assign(new Error('offline'), { isNetworkError: true })
  const result = await queue.replayQueue(async () => { throw networkError })
  assert.equal(result.sent, 0)
  assert.equal(result.dropped, 0)
  assert.equal(result.kept, 2)
  assert.equal(result.lastError, networkError)
  assert.equal(queue.queueSize(), 2)
})

test('corrupt persisted data is treated as an empty queue', () => {
  localStorage.setItem('clocdot.offlineQueue.v1', '{not-json')
  assert.deepEqual(queue.listQueue(), [])
})
