import i18n from '../i18n/index.js'

/** 目前語言 —— 給非 React 環境（工具函式）取用 */
function currentLang(lang) {
  return lang || i18n.resolvedLanguage || 'zh-TW'
}

/** 「2026 年 5 月」／「May 2026」 */
export function formatYearMonth(date, lang) {
  return date.toLocaleDateString(currentLang(lang), { year: 'numeric', month: 'long' })
}

/** 月份全名清單，index 0 = 一月 */
export function monthNames(lang) {
  const fmt = new Intl.DateTimeFormat(currentLang(lang), { month: 'long' })
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)))
}

/** 行事曆表頭用的最短星期名，index 0 = 週日 */
export function weekdayNarrowNames(lang) {
  const fmt = new Intl.DateTimeFormat(currentLang(lang), { weekday: 'narrow' })
  // 2024-01-07 是星期日
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i))))
}

/** 星期短名，index 0 = 週一 */
export function weekdayShortNamesMondayFirst(lang) {
  const fmt = new Intl.DateTimeFormat(currentLang(lang), { weekday: 'short' })
  // 2024-01-01 是星期一
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))))
}

/** 星期全名 */
export function getDayName(date, lang) {
  return date.toLocaleDateString(currentLang(lang), { weekday: 'long' })
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
