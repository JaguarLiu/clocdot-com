// 排班解析與班別驗證 — 員工某日上下班時間的唯一真相來源。
// 解析順序：當日指派 → 員工預設班 → null（無班別 → 不判遲到/早退）

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * 驗證班別 payload；回傳錯誤訊息字串，合法回 null。
 * endTime < startTime（HH:mm 字串比較）表示跨日班（翌日下班）；相同則拒絕（不允許 24h 班）。
 */
export function validateShiftPayload({ name, startTime, endTime, breakMinutes }) {
  if (typeof name !== 'string' || !name.trim()) return '班別名稱不可為空'
  if (!TIME_PATTERN.test(startTime ?? '')) return 'startTime 需為 HH:MM 格式'
  if (!TIME_PATTERN.test(endTime ?? '')) return 'endTime 需為 HH:MM 格式'
  if (startTime === endTime) return '上下班時間不可相同'
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 480) {
    return '午休分鐘數需為 0–480 的整數'
  }
  return null
}

/** assignmentsByKey 的 key：`${userId}|${YYYY-MM-DD}` */
export function dateKey(userId, dateStr) {
  return `${userId}|${dateStr}`
}

/**
 * 純函式：從 bundle 解析某員工某日的班別。
 * @param {{assignmentsByKey: Map, defaultShiftByUser: Map}} bundle
 * @returns {{shift: object, source: 'assignment'|'default'} | null}
 */
export function shiftFor(bundle, userId, dateStr) {
  const assigned = bundle.assignmentsByKey.get(dateKey(userId, dateStr))
  if (assigned) return { shift: assigned, source: 'assignment' }
  const def = bundle.defaultShiftByUser.get(userId)
  if (def) return { shift: def, source: 'default' }
  return null
}

const SHIFT_SELECT = { id: true, name: true, startTime: true, endTime: true, breakMinutes: true }

/**
 * 批次載入一段區間的排班資料：一次指派查詢 + 一次預設班查詢，
 * 供月報表 / 排班行事曆 / 班表查詢避免 N+1。
 * @param {Object} args
 * @param {string[]} args.userIds
 * @param {Date} args.startDate 含（UTC 00:00）
 * @param {Date} args.endDate 不含（UTC 00:00）
 */
export async function loadScheduleBundle(prisma, { userIds, startDate, endDate }) {
  const [assignments, users] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where: { userId: { in: userIds }, date: { gte: startDate, lt: endDate } },
      select: { userId: true, date: true, shift: { select: SHIFT_SELECT } },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, defaultShift: { select: SHIFT_SELECT } },
    }),
  ])
  return {
    assignmentsByKey: new Map(
      assignments.map((a) => [dateKey(a.userId, a.date.toISOString().slice(0, 10)), a.shift]),
    ),
    defaultShiftByUser: new Map(
      users.filter((u) => u.defaultShift).map((u) => [u.id, u.defaultShift]),
    ),
  }
}

/**
 * 單人單日解析（打卡 / 補卡核准用）。
 * @param {Date} workDate UTC 00:00 的 @db.Date 值
 */
export async function getShiftForDate(prisma, userId, workDate) {
  const endDate = new Date(workDate.getTime() + 24 * 60 * 60 * 1000)
  const bundle = await loadScheduleBundle(prisma, { userIds: [userId], startDate: workDate, endDate })
  return shiftFor(bundle, userId, workDate.toISOString().slice(0, 10))
}

/** 跨日班:endTime 小於 startTime(字串比較)表示翌日下班 */
export function isOvernightShift(shift) {
  return Boolean(shift?.startTime && shift?.endTime && shift.endTime < shift.startTime)
}

/**
 * 下班卡回溯判定:今天沒有可下班的紀錄(無紀錄或無 punchIn)時,
 * 若昨天有已上班的紀錄且昨天班別是跨日班 → 下班卡歸昨天(凌晨下班歸排班日)。
 * 純函式,DB 查詢由呼叫端(routes/attendance.js)負責。
 */
export function shouldFallbackToYesterday({ todayRecord, yesterdayRecord, yesterdayShift }) {
  if (todayRecord?.punchIn) return false
  if (!yesterdayRecord?.punchIn) return false
  return isOvernightShift(yesterdayShift)
}
