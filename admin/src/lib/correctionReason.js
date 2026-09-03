// 補卡原因的「儲存格式」解析
//
// server 把補卡申請存成 `[上班] 09:00 - 說明`（見 server/src/routes/correction.js）。
// 那是**持久化到 DB 的資料格式，永遠是中文**，不隨介面語言變動 ——
// 翻譯它會讓既有紀錄解析不出來。所以：解析時比對中文常數，顯示時才轉成當前語言。

/** DB 內固定使用的中文，不可改、不可翻譯 */
export const STORED_TYPE_IN = '上班'
export const STORED_TYPE_OUT = '下班'

/** `[上班] 09:00 - 說明` → { type: '上班', time: '09:00', detail: '說明' } */
export function parseCorrectionReason(reason) {
  const match = String(reason ?? '').match(/^\[(.+?)\]\s*(\d{1,2}:\d{2})\s*-\s*(.*)$/)
  if (match) return { type: match[1], time: match[2], detail: match[3] }
  return { type: '--', time: '--', detail: reason }
}

/** 把儲存格式的中文類型轉成當前語言的顯示字串；無法辨識時原樣回傳 */
export function punchTypeLabel(t, storedType) {
  if (storedType === STORED_TYPE_IN) return t('attendance.punchIn')
  if (storedType === STORED_TYPE_OUT) return t('attendance.punchOut')
  return storedType
}
