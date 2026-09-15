// 打卡鐘的反應：上班卡看遲到、下班卡看早退，旗標以 server 回傳的出勤紀錄為準。
export function punchMood(action, record) {
  const flagged = action === 'out' ? record?.isEarlyLeave : record?.isLate
  return flagged ? 'angry' : 'happy'
}
