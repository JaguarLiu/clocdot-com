// 小型 CSV 序列化工具 — 夠用就好，不用 npm 套件
//
// - 欄位若含 `,` `"` `\n` `\r` 就用雙引號包起來，內部雙引號 escape 成 ""
// - 結尾用 \r\n (Excel 對 \r\n 相容性最好)
// - 檔案開頭加 UTF-8 BOM，Windows Excel 打開中文不亂碼

const BOM = '﻿'

function escapeCell(val) {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCSV(headers, rows) {
  const lines = [headers.map(escapeCell).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','))
  }
  return BOM + lines.join('\r\n')
}

/**
 * 把 Date 格式化為指定時區的 HH:mm
 */
export function formatTimeInTZ(date, timezone) {
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const h = parts.find((p) => p.type === 'hour').value
  const m = parts.find((p) => p.type === 'minute').value
  return `${h}:${m}`
}

/**
 * 把 Date 格式化為 YYYY-MM-DD (UTC — AttendanceRecord.workDate 是 @db.Date 本來就只有日期部分)
 */
export function formatDateUTC(date) {
  if (!date) return ''
  return date.toISOString().slice(0, 10)
}
