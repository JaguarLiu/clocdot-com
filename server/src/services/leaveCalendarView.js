/**
 * 純函式：把 LeaveRequest（含 user）列表轉成行事曆事件，並依角色裁切欄位。
 * admin：含假別與起訖時間；employee：僅「誰在哪幾天請假」，不洩漏假別/理由（隱私）。
 * 任何角色都不回傳 reason。
 */
export function toCalendarEvents(rows, role) {
  return rows.map((r) => {
    const base = {
      userId: r.userId,
      name: r.user?.name ?? null,
      startDate: r.startDate,
      endDate: r.endDate,
    }
    if (role === 'admin') {
      return {
        ...base,
        leaveType: r.leaveType,
        startTime: r.startTime,
        endTime: r.endTime,
      }
    }
    return base
  })
}
