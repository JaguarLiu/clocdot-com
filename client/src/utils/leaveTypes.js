// 與 server / admin 對齊的假別 enum
// 顯示名稱一律走 i18n（key: leaveTypes.<value>.label / .code），
// 這裡只保留 enum 順序與值本身。

export const LEAVE_TYPE_VALUES = [
  'annual',
  'personal',
  'sick',
  'menstrual',
  'marriage',
  'bereavement',
  'maternity',
  'paternity',
  'official',
  'compensatory',
]

/**
 * 取得假別的顯示名稱。
 * @param {(key: string, opts?: object) => string} t i18next 的 t
 * @param {string} value 假別 enum 值
 */
export function leaveTypeLabel(t, value) {
  return t(`leaveTypes.${value}.label`, { defaultValue: value })
}

/**
 * 假別的裝飾性代碼（paper-craft 風格的小字英文標籤）。
 * 英文介面下回傳空字串 —— 避免與主標籤重複，見 DESIGN.md「裝飾標籤」段。
 */
export function leaveTypeCode(t, value) {
  return t(`leaveTypes.${value}.code`, { defaultValue: '' })
}

/** 給下拉選單用：[{ value, label, code }] */
export function leaveTypeOptions(t) {
  return LEAVE_TYPE_VALUES.map((value) => ({
    value,
    label: leaveTypeLabel(t, value),
    code: leaveTypeCode(t, value),
  }))
}
