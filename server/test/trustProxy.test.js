import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTrustProxy } from '../src/utils/trustProxy.js'

test('未設定時不信任 X-Forwarded-For', () => {
  assert.equal(parseTrustProxy(undefined), false)
  assert.equal(parseTrustProxy(''), false)
  assert.equal(parseTrustProxy('   '), false)
  assert.equal(parseTrustProxy('false'), false)
})

test('數字視為反向代理跳數', () => {
  assert.equal(parseTrustProxy('1'), 1)
  assert.equal(parseTrustProxy(' 2 '), 2)
  assert.equal(parseTrustProxy('0'), 0)
})

test('逗號分隔的 IP/CIDR 轉成清單', () => {
  assert.deepEqual(parseTrustProxy('10.0.0.1'), ['10.0.0.1'])
  assert.deepEqual(parseTrustProxy('10.0.0.0/8, 172.16.0.0/12'), ['10.0.0.0/8', '172.16.0.0/12'])
})

test('true/false 關鍵字不分大小寫，不會被當成 IP 清單', () => {
  assert.equal(parseTrustProxy('true'), true)
  assert.equal(parseTrustProxy('TRUE'), true)
  assert.equal(parseTrustProxy(' True '), true)
  assert.equal(parseTrustProxy('FALSE'), false)
})
