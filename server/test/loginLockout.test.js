import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_FAILED_ATTEMPTS,
  LOCK_BASE_MS,
  LOCK_MAX_MS,
  lockDurationMs,
  shouldLock,
  remainingLockMs,
  remainingAttempts,
} from '../src/services/loginLockout.js'

// ---- lockDurationMs ----

test('未滿一輪失敗不鎖定', () => {
  assert.equal(lockDurationMs(0), 0)
  assert.equal(lockDurationMs(MAX_FAILED_ATTEMPTS - 1), 0)
})

test('第一輪鎖 15 分鐘，之後逐輪翻倍', () => {
  assert.equal(lockDurationMs(MAX_FAILED_ATTEMPTS), LOCK_BASE_MS)
  assert.equal(lockDurationMs(MAX_FAILED_ATTEMPTS * 2), LOCK_BASE_MS * 2)
  assert.equal(lockDurationMs(MAX_FAILED_ATTEMPTS * 3), LOCK_BASE_MS * 4)
})

test('鎖定時長有 24 小時上限', () => {
  assert.equal(lockDurationMs(MAX_FAILED_ATTEMPTS * 20), LOCK_MAX_MS)
})

// ---- shouldLock ----

test('剛好滿一輪才觸發鎖定', () => {
  assert.equal(shouldLock(MAX_FAILED_ATTEMPTS - 1), false)
  assert.equal(shouldLock(MAX_FAILED_ATTEMPTS), true)
  assert.equal(shouldLock(MAX_FAILED_ATTEMPTS + 1), false)
  assert.equal(shouldLock(MAX_FAILED_ATTEMPTS * 2), true)
})

test('零次失敗不鎖定', () => {
  assert.equal(shouldLock(0), false)
})

// ---- remainingLockMs ----

test('未鎖定回 0', () => {
  assert.equal(remainingLockMs({ lockedAt: null, failedLoginCount: 2 }), 0)
})

test('鎖定期間回剩餘毫秒', () => {
  const now = Date.now()
  const lockedAt = new Date(now - 5 * 60 * 1000) // 5 分鐘前鎖定
  const left = remainingLockMs({ lockedAt, failedLoginCount: MAX_FAILED_ATTEMPTS }, now)
  assert.equal(left, LOCK_BASE_MS - 5 * 60 * 1000)
})

test('鎖定期滿自動視為未鎖定', () => {
  const now = Date.now()
  const lockedAt = new Date(now - LOCK_BASE_MS - 1000)
  assert.equal(remainingLockMs({ lockedAt, failedLoginCount: MAX_FAILED_ATTEMPTS }, now), 0)
})

test('第二輪鎖定時間較長', () => {
  const now = Date.now()
  const lockedAt = new Date(now - LOCK_BASE_MS - 1000) // 已超過第一輪時長
  // 累積兩輪失敗 → 時長 30 分鐘，仍在鎖定中
  const left = remainingLockMs({ lockedAt, failedLoginCount: MAX_FAILED_ATTEMPTS * 2 }, now)
  assert.ok(left > 0)
  assert.ok(left < LOCK_BASE_MS)
})

test('lockedAt 可吃 Date 或 ISO 字串', () => {
  const now = Date.now()
  const iso = new Date(now - 60 * 1000).toISOString()
  const left = remainingLockMs({ lockedAt: iso, failedLoginCount: MAX_FAILED_ATTEMPTS }, now)
  assert.equal(left, LOCK_BASE_MS - 60 * 1000)
})

// ---- remainingAttempts ----

test('剩餘嘗試次數隨失敗遞減、進入新一輪後重算', () => {
  assert.equal(remainingAttempts(0), MAX_FAILED_ATTEMPTS)
  assert.equal(remainingAttempts(1), MAX_FAILED_ATTEMPTS - 1)
  assert.equal(remainingAttempts(MAX_FAILED_ATTEMPTS + 1), MAX_FAILED_ATTEMPTS - 1)
})
