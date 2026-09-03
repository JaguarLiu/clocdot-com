/**
 * 純函式：在一份已核准請假清單中，找出與目標區間（日期級、含邊界）重疊者。
 * 兩區間重疊 ⇔ aStart <= bEnd 且 bStart <= aEnd。
 */
export function findOverlaps(existingLeaves, { startDate, endDate, excludeUserId } = {}) {
  const s = startDate.getTime()
  const e = endDate.getTime()
  return existingLeaves.filter((l) => {
    if (excludeUserId && l.userId === excludeUserId) return false
    return l.startDate.getTime() <= e && s <= l.endDate.getTime()
  })
}
