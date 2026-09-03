// 與 server/src/utils/leaveTypes.js 對齊 (未來有共享 package 再合併)
//
// statutoryDays — 勞基法/性平法預設天數，第一次設定時自動帶入
// autofillOnFirstSetup — 首次設定是否自動帶入；婚/喪/公假因實際情況差異大，留給公司自填
//
// 顯示文字（label / code / note）一律走 i18n，key: leaveTypes.<value>.*
// 這裡只留與法規綁定、不隨語系變動的數值。

export const LEAVE_TYPES = [
  { value: 'annual',       statutoryDays: 7,  autofillOnFirstSetup: true },
  { value: 'personal',     statutoryDays: 14, autofillOnFirstSetup: true },
  { value: 'sick',         statutoryDays: 30, autofillOnFirstSetup: true },
  { value: 'menstrual',    statutoryDays: 3,  autofillOnFirstSetup: true },
  { value: 'marriage',     statutoryDays: 8,  autofillOnFirstSetup: false },
  { value: 'bereavement',  statutoryDays: 8,  autofillOnFirstSetup: false },
  { value: 'maternity',    statutoryDays: 56, autofillOnFirstSetup: true },
  { value: 'paternity',    statutoryDays: 7,  autofillOnFirstSetup: true },
  { value: 'official',     statutoryDays: 0,  autofillOnFirstSetup: false },
  { value: 'compensatory', statutoryDays: 0,  autofillOnFirstSetup: true },
]

export const LEAVE_TYPE_MAP = Object.fromEntries(LEAVE_TYPES.map((t) => [t.value, t]))

/** 假別顯示名稱 */
export function leaveTypeLabel(t, value) {
  return t(`leaveTypes.${value}.label`, { defaultValue: value })
}

/**
 * 裝飾性英文代碼；英文語系下回傳空字串，避免與主標籤重複（見 DESIGN.md）。
 */
export function leaveTypeCode(t, value) {
  return t(`leaveTypes.${value}.code`, { defaultValue: '' })
}

/** 法規說明（Settings 的假別額度表用） */
export function leaveTypeNote(t, value) {
  return t(`leaveTypes.${value}.note`, { defaultValue: '' })
}

// 各假別「扣薪比例」系統預設（與 server leaveTypes.js 對齊）。0=全薪不扣，1=扣全薪。
export const DEFAULT_LEAVE_DEDUCT_RATE = { personal: 1, sick: 0.5 }

export function minutesToDays(minutes) {
  if (minutes == null) return null
  return minutes / (8 * 60)
}

export function daysToMinutes(days) {
  return Math.round(Number(days) * 8 * 60)
}
