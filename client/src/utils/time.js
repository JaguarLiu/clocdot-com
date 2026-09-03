import i18n from '../i18n/index.js'

/** 目前語言 —— 給非 React 環境（工具函式）取用 */
function currentLang(lang) {
  return lang || i18n.resolvedLanguage || 'zh-TW'
}

export function formatTime(date, lang) {
  return date.toLocaleTimeString(currentLang(lang), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDate(date, lang) {
  return date.toLocaleDateString(currentLang(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/** 「2026 年 5 月」／「May 2026」 */
export function formatYearMonth(date, lang) {
  return date.toLocaleDateString(currentLang(lang), {
    year: 'numeric',
    month: 'long',
  })
}

/** 星期全名：「星期一」／「Monday」 */
export function getDayName(date, lang) {
  return date.toLocaleDateString(currentLang(lang), { weekday: 'long' })
}

/** 行事曆表頭用的最短星期名，index 0 = 週日：['日'…]／['S','M',…] */
export function weekdayNarrowNames(lang) {
  const fmt = new Intl.DateTimeFormat(currentLang(lang), { weekday: 'narrow' })
  // 2024-01-07 是星期日，往後推 7 天剛好一輪
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i))))
}

/** 星期短名，index 0 = 週一（客戶端班表用週一起始）：['一'…]／['Mon',…] */
export function weekdayShortNamesMondayFirst(lang) {
  const fmt = new Intl.DateTimeFormat(currentLang(lang), { weekday: 'short' })
  // 2024-01-01 是星期一
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))))
}

/** 頓號／逗號的語系差異交給 Intl.ListFormat */
export function formatList(items, lang) {
  const list = items ?? []
  try {
    return new Intl.ListFormat(currentLang(lang), { style: 'narrow', type: 'unit' }).format(list)
  } catch {
    return list.join(', ')
  }
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

export function calculateWorkDuration(punchIn, punchOut) {
  if (!punchIn || !punchOut) return 0
  const start = new Date(punchIn)
  const end = new Date(punchOut)
  return Math.round((end - start) / 1000 / 60)
}

/**
 * 計算請假時長並格式化
 * - 同一天：回傳「X 小時」（若剛好是 8 小時以上，以「1 天」表示）
 * - 跨天：回傳「N 天」（含頭尾）
 */
export function formatLeaveDuration(startDate, startTime, endDate, endTime) {
  if (!startDate || !endDate) return ''

  const startKey = typeof startDate === 'string' ? startDate.slice(0, 10) : ''
  const endKey = typeof endDate === 'string' ? endDate.slice(0, 10) : ''

  if (startKey === endKey) {
    const [sh, sm] = (startTime || '00:00').split(':').map(Number)
    const [eh, em] = (endTime || '00:00').split(':').map(Number)
    const minutes = (eh * 60 + em) - (sh * 60 + sm)
    if (minutes <= 0) return '—'
    const hours = minutes / 60
    if (hours >= 8) return i18n.t('common.daysValue', { value: 1 })
    return i18n.t('common.hoursValue', { value: hours % 1 === 0 ? hours : hours.toFixed(1) })
  }

  const s = new Date(startKey)
  const e = new Date(endKey)
  const days = Math.round((e - s) / 86400000) + 1
  return i18n.t('common.daysValue', { value: days })
}
