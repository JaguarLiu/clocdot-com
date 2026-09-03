/**
 * 計算工時 (分鐘)。
 *
 * - 會從「下班 - 上班」扣除公司午休時間 (`breakMinutes`)
 * - 若打下班卡的時間 ≤ 午休 (少見：嚴重早退或打錯)，工時視為 0 而非負數
 * - breakMinutes 預期來自 Company，預設值在 schema 層已給 60
 */
export function computeWorkDuration(punchIn, punchOut, breakMinutes = 60) {
  if (!punchIn || !punchOut) return null
  const rawMinutes = Math.round((punchOut - punchIn) / 1000 / 60)
  return Math.max(0, rawMinutes - breakMinutes)
}
