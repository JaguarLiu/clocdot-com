import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isIpAllowed, isValidIpOrCidr } from '../src/utils/ipMatch.js'

// ---- isValidIpOrCidr ----

test('單一 IPv4 合法', () => {
  assert.equal(isValidIpOrCidr('203.0.113.5'), true)
})

test('IPv4 CIDR 合法', () => {
  assert.equal(isValidIpOrCidr('203.0.113.0/24'), true)
})

test('IPv6 合法', () => {
  assert.equal(isValidIpOrCidr('2001:db8::1'), true)
  assert.equal(isValidIpOrCidr('2001:db8::/32'), true)
})

test('非法輸入回 false', () => {
  assert.equal(isValidIpOrCidr('not-an-ip'), false)
  assert.equal(isValidIpOrCidr('999.1.1.1'), false)
  assert.equal(isValidIpOrCidr('203.0.113.0/99'), false)
  assert.equal(isValidIpOrCidr(''), false)
  assert.equal(isValidIpOrCidr('   '), false)
  assert.equal(isValidIpOrCidr(null), false)
  assert.equal(isValidIpOrCidr(123), false)
})

test('前後空白可接受 (trim 後合法)', () => {
  assert.equal(isValidIpOrCidr(' 203.0.113.5 '), true)
})

// ---- isIpAllowed ----

test('單一 IP 精確命中', () => {
  assert.equal(isIpAllowed('203.0.113.5', ['203.0.113.5']), true)
})

test('單一 IP 未命中', () => {
  assert.equal(isIpAllowed('203.0.113.6', ['203.0.113.5']), false)
})

test('CIDR 網段命中', () => {
  assert.equal(isIpAllowed('203.0.113.99', ['203.0.113.0/24']), true)
})

test('CIDR 網段未命中', () => {
  assert.equal(isIpAllowed('203.0.114.1', ['203.0.113.0/24']), false)
})

test('多筆清單任一命中即通過', () => {
  assert.equal(isIpAllowed('10.0.0.5', ['203.0.113.5', '10.0.0.0/8']), true)
})

test('IPv6 命中', () => {
  assert.equal(isIpAllowed('2001:db8::abcd', ['2001:db8::/32']), true)
})

test('IPv4-mapped IPv6 正規化後以 IPv4 比對', () => {
  // Node 在 dual-stack 下 request.ip 可能是 ::ffff:203.0.113.5
  assert.equal(isIpAllowed('::ffff:203.0.113.5', ['203.0.113.5']), true)
  assert.equal(isIpAllowed('::ffff:203.0.113.5', ['203.0.113.0/24']), true)
})

test('IP 家族不同不誤判', () => {
  assert.equal(isIpAllowed('2001:db8::1', ['203.0.113.0/24']), false)
})

test('空清單 / 非法輸入一律 false', () => {
  assert.equal(isIpAllowed('203.0.113.5', []), false)
  assert.equal(isIpAllowed('garbage', ['203.0.113.0/24']), false)
  assert.equal(isIpAllowed(null, ['203.0.113.5']), false)
  assert.equal(isIpAllowed('203.0.113.5', null), false)
  // 清單內壞資料只跳過該筆，不整體炸掉
  assert.equal(isIpAllowed('203.0.113.5', ['bad-entry', '203.0.113.5']), true)
})
