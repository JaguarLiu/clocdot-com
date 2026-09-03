import { localTimeToUTC } from '../utils/timezone.js'
import { isOvernightShift } from './schedule.js'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 將時間以「分鐘」為粒度截斷（抹掉秒與毫秒）。
 * 班別上下班時間 (HH:mm) 本來就只到分鐘，故比較時打卡時間也只看到分鐘，
 * 讓同一分鐘內不算遲到 / 早退（例：09:00:59 仍算準時，09:01:00 才遲到）。
 */
function floorToMinute(date) {
  const d = new Date(date)
  d.setUTCSeconds(0, 0)
  return d
}

/** 上班基準：workDate 當地日的 startTime */
function shiftStartUTC(workDate, shift, tz) {
  return localTimeToUTC(workDate.toISOString().slice(0, 10), shift.startTime, tz)
}

/** 下班基準：workDate（跨日班 +1 天）當地日的 endTime */
function shiftEndUTC(workDate, shift, tz) {
  const endDate = isOvernightShift(shift) ? new Date(workDate.getTime() + DAY_MS) : workDate
  return localTimeToUTC(endDate.toISOString().slice(0, 10), shift.endTime, tz)
}

/**
 * 依「打卡時間 vs 班別上下班時間」計算遲到 / 早退旗標。
 * shift 來自 services/schedule.js 的解析結果（當日指派 → 預設班）。
 *
 * 比較基準日一律用「出勤紀錄的 workDate」——即時打卡、補卡、跨日班凌晨打卡
 * 都以排班日為準（跨日班的下班基準為 workDate 翌日的 endTime）。
 *
 * - 判定以分鐘為粒度，秒數不影響結果（同一分鐘內視為準時）。
 * - 只回傳有提供對應打卡時間的旗標（punchIn → isLate；punchOut → isEarlyLeave），
 *   讓呼叫端可只更新被修改到的那一邊。
 * - 無班別（shift 為 null）、班別缺對應時間、或缺 workDate 時，對應旗標視為 false。
 *
 * @param {Object} args
 * @param {Date|null} [args.punchIn]
 * @param {Date|null} [args.punchOut]
 * @param {{ startTime?: string|null, endTime?: string|null }|null} [args.shift]
 * @param {Date} [args.workDate] 出勤紀錄的 workDate（UTC 00:00）
 * @param {string} [args.timezone]
 * @returns {{ isLate?: boolean, isEarlyLeave?: boolean }}
 */
export function computeAttendanceFlags({ punchIn, punchOut, shift, workDate, timezone }) {
  const tz = timezone || 'Asia/Taipei'
  const flags = {}

  if (punchIn) {
    flags.isLate = shift?.startTime && workDate
      ? floorToMinute(punchIn) > shiftStartUTC(workDate, shift, tz)
      : false
  }

  if (punchOut) {
    flags.isEarlyLeave = shift?.endTime && workDate
      ? floorToMinute(punchOut) < shiftEndUTC(workDate, shift, tz)
      : false
  }

  return flags
}

/**
 * 計算遲到 / 早退「分鐘數」（非旗標）。判定基準與 computeAttendanceFlags 相同：
 * 以 workDate（跨日班下班為翌日）的班別上/下班時間為界，分鐘粒度。
 *
 * @param {Object} args
 * @param {Date|null} [args.punchIn]
 * @param {Date|null} [args.punchOut]
 * @param {{ startTime?: string|null, endTime?: string|null }|null} [args.shift]
 * @param {Date} [args.workDate] 出勤紀錄的 workDate（UTC 00:00）
 * @param {string} [args.timezone]
 * @returns {{ lateMinutes: number, earlyLeaveMinutes: number }}
 */
export function lateEarlyMinutes({ punchIn, punchOut, shift, workDate, timezone }) {
  const tz = timezone || 'Asia/Taipei'
  let lateMinutes = 0
  let earlyLeaveMinutes = 0

  if (punchIn && shift?.startTime && workDate) {
    const diffMs = floorToMinute(punchIn) - shiftStartUTC(workDate, shift, tz)
    lateMinutes = diffMs > 0 ? Math.round(diffMs / 60000) : 0
  }

  if (punchOut && shift?.endTime && workDate) {
    const diffMs = shiftEndUTC(workDate, shift, tz) - floorToMinute(punchOut)
    earlyLeaveMinutes = diffMs > 0 ? Math.round(diffMs / 60000) : 0
  }

  return { lateMinutes, earlyLeaveMinutes }
}
