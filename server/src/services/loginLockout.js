// 登入失敗鎖定策略 — 時間性鎖定（自動解鎖），重複觸發逐輪升級
//
// 規則：
// - 每累積 MAX_FAILED_ATTEMPTS 次失敗鎖一輪，鎖定時長隨輪數翻倍：15m → 30m → 1h → …，上限 24h
// - 鎖定期滿即可再嘗試（毋須管理員解鎖），但失敗計數不歸零：
//   期滿後再錯 MAX_FAILED_ATTEMPTS 次會鎖下一輪（更久）
// - 登入成功或管理員手動解鎖 → 計數與鎖定一併歸零

export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_BASE_MS = 15 * 60 * 1000
export const LOCK_MAX_MS = 24 * 60 * 60 * 1000

// 依累積失敗次數推算「當前這一輪」的鎖定時長；未滿一輪回傳 0
export function lockDurationMs(failedCount) {
  const rounds = Math.floor(failedCount / MAX_FAILED_ATTEMPTS)
  if (rounds <= 0) return 0
  return Math.min(LOCK_BASE_MS * 2 ** (rounds - 1), LOCK_MAX_MS)
}

// 這次失敗後是否觸發鎖定（剛好滿一輪）
export function shouldLock(nextFailedCount) {
  return nextFailedCount > 0 && nextFailedCount % MAX_FAILED_ATTEMPTS === 0
}

// 剩餘鎖定毫秒數；0 = 未鎖定或鎖定期已滿
export function remainingLockMs({ lockedAt, failedLoginCount }, now = Date.now()) {
  if (!lockedAt) return 0
  const duration = lockDurationMs(failedLoginCount)
  const elapsed = now - new Date(lockedAt).getTime()
  return Math.max(0, duration - elapsed)
}

// 距下一次鎖定前的剩餘嘗試次數
export function remainingAttempts(failedCount) {
  return MAX_FAILED_ATTEMPTS - (failedCount % MAX_FAILED_ATTEMPTS)
}
