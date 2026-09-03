// 班別時間顯示：跨日班（endTime < startTime）加 ⁺¹ 標記
export function formatShiftRange(shift) {
  if (!shift?.startTime || !shift?.endTime) return ''
  const overnight = shift.endTime < shift.startTime
  return `${shift.startTime}–${shift.endTime}${overnight ? '⁺¹' : ''}`
}
