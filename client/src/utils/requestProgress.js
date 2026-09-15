// 申請進度（GET /api/requests/:type/:id/progress）的顯示邏輯，純函式便於測試。

/** 事件 → i18n key（progress.action.*）；加班重送另給一個標籤 */
export function eventLabelKey(event) {
  if (event?.action === 'overtime.submitted' && event?.meta?.resubmitted) {
    return 'progress.action.overtime_resubmitted'
  }
  return `progress.action.${String(event?.action ?? '').replace('.', '_')}`
}

/**
 * 每一關的顯示狀態
 * @returns {'approved'|'rejected'|'skipped'|'current'|'waiting'}
 */
export function stepTone(step, activeLevel) {
  if (step.status === 'approved') return 'approved'
  if (step.status === 'rejected') return 'rejected'
  if (step.status === 'skipped') return 'skipped'
  return step.level === activeLevel ? 'current' : 'waiting'
}

/** 事件的關卡層級（簽核事件才有） */
export function eventLevel(event) {
  const level = event?.meta?.level
  return Number.isInteger(level) ? level : null
}
