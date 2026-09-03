/**
 * 請假核准後，將 leaveType 寫回對應日期的 AttendanceRecord；
 * 若同日已有打卡紀錄，只補 leaveType，不動 punchIn/punchOut。
 *
 * 撤回核准時 (approved → rejected) 反向清除同 leaveType 的標記，
 * 不碰他人/他次請假的 leaveType，避免誤傷。
 *
 * LeaveRequest.startDate / endDate 是 @db.Date — Prisma 回傳的 Date 在 UTC 00:00，
 * 所以迭代時用 UTC 加一天即可，不用處理時區漂移。
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function* eachDateUTCInclusive(start, end) {
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  for (let t = s.getTime(); t <= e.getTime(); t += ONE_DAY_MS) {
    yield new Date(t)
  }
}

export async function applyLeaveToAttendance(prisma, { userId, startDate, endDate, leaveType }) {
  const ops = []
  for (const workDate of eachDateUTCInclusive(startDate, endDate)) {
    ops.push(
      prisma.attendanceRecord.upsert({
        where: { userId_workDate: { userId, workDate } },
        create: { userId, workDate, leaveType },
        update: { leaveType },
      }),
    )
  }
  // 呼叫端可能傳 interactive transaction 的 tx client（沒有 $transaction）—
  // 此時外層已保證原子性，逐筆執行即可
  if (typeof prisma.$transaction === 'function') await prisma.$transaction(ops)
  else for (const op of ops) await op
}

export async function clearLeaveFromAttendance(prisma, { userId, startDate, endDate, leaveType }) {
  // 只清「剛好是此次假別」的標記；若早就被別筆請假覆蓋，不動它
  await prisma.attendanceRecord.updateMany({
    where: {
      userId,
      workDate: {
        gte: new Date(Date.UTC(
          startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(),
        )),
        lte: new Date(Date.UTC(
          endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(),
        )),
      },
      leaveType,
    },
    data: { leaveType: null },
  })
}
