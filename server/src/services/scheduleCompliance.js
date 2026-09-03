// 排班法規檢核（純函式，不碰 DB）— 存排班前呼叫。
//
// 目前實作兩條與變形工時類型無關、對所有輪班客戶皆適用的紅線：
//   1. 七休一：連續工作日不得超過 6 天（兩例假之間工作日 ≤ 6）
//   2. 輪班間隔：相鄰兩個工作日的班別之間至少休息 11 小時
//
// 「工作日」的定義由呼叫端決定（傳入 worked map）；本模組只認「有班別的那天＝工作日」。
// 只回報「牽涉到本次變更日」的違規（changed）——既有的歷史違規不因這次存檔被翻出來擋，
// 避免困住使用者。違規採「警告可覆寫」語意，是否放行由呼叫端（confirm）決定。

export const MAX_CONSECUTIVE_WORKDAYS = 6
export const MIN_REST_HOURS = 11
const MIN_PER_DAY = 1440

const DAY_MS = 24 * 60 * 60 * 1000

/** 'YYYY-MM-DD' → 以天為單位的整數索引（UTC 天數） */
export function dayIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

/** 天索引 → 'YYYY-MM-DD' */
export function indexToDateStr(idx) {
  return new Date(idx * DAY_MS).toISOString().slice(0, 10)
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** endTime < startTime 表跨夜班（翌日下班） */
function isOvernight(shift) {
  return Boolean(shift?.startTime && shift?.endTime && shift.endTime < shift.startTime)
}

/** 班別在「絕對分鐘軸」上的上/下班時刻（dayIdx 為該工作日的天索引） */
function shiftStartAbs(dayIdx, shift) {
  return dayIdx * MIN_PER_DAY + timeToMin(shift.startTime)
}
function shiftEndAbs(dayIdx, shift) {
  const endDay = isOvernight(shift) ? dayIdx + 1 : dayIdx
  return endDay * MIN_PER_DAY + timeToMin(shift.endTime)
}

/** 連續整數索引分組 */
function consecutiveRuns(sortedIdx) {
  const runs = []
  let cur = []
  for (const i of sortedIdx) {
    if (cur.length === 0 || i === cur[cur.length - 1] + 1) cur.push(i)
    else { runs.push(cur); cur = [i] }
  }
  if (cur.length) runs.push(cur)
  return runs
}

/**
 * @param {Array<{userId:string, userName:string,
 *   worked: Map<number, {startTime:string, endTime:string}>, changed: Set<number>}>} userSchedules
 * @returns {Array<{userId, userName, type:'seven_day_rest'|'shift_interval', message:string, ...}>}
 */
export function evaluateScheduleCompliance(userSchedules) {
  const violations = []
  for (const u of userSchedules) {
    violations.push(...checkSevenDayRest(u))
    violations.push(...checkShiftInterval(u))
  }
  return violations
}

// 七休一：任一「長度 > 6 且含本次變更日」的連續工作日區段 → 違規
function checkSevenDayRest({ userId, userName, worked, changed }) {
  const runs = consecutiveRuns([...worked.keys()].sort((a, b) => a - b))
  const out = []
  for (const run of runs) {
    if (run.length <= MAX_CONSECUTIVE_WORKDAYS) continue
    if (!run.some((i) => changed.has(i))) continue
    const startDate = indexToDateStr(run[0])
    const endDate = indexToDateStr(run[run.length - 1])
    out.push({
      userId, userName, type: 'seven_day_rest',
      startDate, endDate, days: run.length,
      message: `${userName}：${startDate}～${endDate} 連續上班 ${run.length} 天，違反七休一（連續工作不得超過 ${MAX_CONSECUTIVE_WORKDAYS} 天）`,
    })
  }
  return out
}

// 輪班間隔：相鄰兩工作日（皆有班）之間休息 < 11 小時，且該對含本次變更日 → 違規
function checkShiftInterval({ userId, userName, worked, changed }) {
  const idxs = [...worked.keys()].sort((a, b) => a - b)
  const out = []
  for (const i of idxs) {
    const next = i + 1
    if (!worked.has(next)) continue
    if (!changed.has(i) && !changed.has(next)) continue
    const restMin = shiftStartAbs(next, worked.get(next)) - shiftEndAbs(i, worked.get(i))
    const restHours = restMin / 60
    if (restHours >= MIN_REST_HOURS) continue
    out.push({
      userId, userName, type: 'shift_interval',
      prevDate: indexToDateStr(i), date: indexToDateStr(next),
      restHours: Math.round(restHours * 10) / 10,
      message: `${userName}：${indexToDateStr(i)} 下班到 ${indexToDateStr(next)} 上班僅間隔 ${(Math.round(restHours * 10) / 10)} 小時，不足輪班間隔 ${MIN_REST_HOURS} 小時`,
    })
  }
  return out
}
