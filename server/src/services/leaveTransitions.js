/**
 * 純函式：請假狀態機守門。
 * status: 'pending' | 'approved' | 'rejected' | 'cancelled'
 * cancelRequested: 已核准的假是否正在申請取消（旗標法，餘額在此期間仍計入）。
 */

// 員工可對「已核准且尚未在申請取消」的假發起取消
export function canRequestCancel(leave) {
  return leave.status === 'approved' && leave.cancelRequested !== true
}

// admin 可對「正在申請取消」的假做同意/駁回決議
export function canDecideCancel(leave) {
  return leave.status === 'approved' && leave.cancelRequested === true
}

// admin 可審核（approve/reject）仍在 pending 的假
export function canReview(leave) {
  return leave.status === 'pending'
}
