/**
 * 取得指定時區下，某個 Date 落在的本地日期 YYYY-MM-DD
 */
export function getDateStrInTZ(date, timezone = 'Asia/Taipei') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year').value
  const m = parts.find((p) => p.type === 'month').value
  const d = parts.find((p) => p.type === 'day').value
  return `${y}-${m}-${d}`
}

/**
 * 取得指定時區「今天」的 YYYY-MM-DD 字串
 */
function getTodayDateStr(timezone = 'Asia/Taipei') {
  return getDateStrInTZ(new Date(), timezone)
}

/**
 * 取得指定時區「今天」的 UTC Date（給 @db.Date 欄位用）
 * e.g. timezone=Asia/Taipei 時，Taipei 的今天 00:00 = UTC 的前一天 16:00，
 * 但 @db.Date 只存日期部分，存 `今天 00:00 UTC` 即可代表那一天
 */
export function getTodayStart(timezone = 'Asia/Taipei') {
  const [year, month, day] = getTodayDateStr(timezone).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * 將 YYYY-MM-DD 字串轉為 UTC Date（給 @db.Date 欄位用）
 */
export function dateStrToDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * 將 "HH:mm" 轉為指定時區「今天 HH:mm」對應的 UTC Date（用於時間比較）
 * 內部改用 localTimeToUTC 以支援任意時區，避免依賴 Node 程式時區
 */
export function parseTimeToday(timeStr, timezone = 'Asia/Taipei') {
  const dateStr = getTodayDateStr(timezone)
  return localTimeToUTC(dateStr, timeStr, timezone)
}

/**
 * 將 YYYY-MM-DD 日期 + HH:mm 時間 + 時區，轉為正確的 UTC Date
 * 用於把用戶填寫的本地時間存入 DB
 */
export function localTimeToUTC(dateStr, timeStr, timezone) {
  const ref = new Date(`${dateStr}T12:00:00Z`)
  const utc = new Date(ref.toLocaleString('en-US', { timeZone: 'UTC' }))
  const local = new Date(ref.toLocaleString('en-US', { timeZone: timezone }))
  const offsetMs = local - utc
  const [h, m] = timeStr.split(':').map(Number)
  const localMs = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`).getTime()
  return new Date(localMs - offsetMs)
}
