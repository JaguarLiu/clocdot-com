// 員工端「申請進度」組裝（純函式）：簽核鏈每一層的狀態 + 稽核事件時間軸。
import { summarizeStatus } from './approvalChain.js'
import { toEmployeeEvent } from './audit.js'

export const PROGRESS_REQUEST_TYPES = ['leave', 'correction', 'overtime']

/**
 * @param {object} p
 * @param {object|null} p.request 申請列（已被撤回刪除時為 null）
 * @param {object[]} p.steps ApprovalStep 列
 * @param {object[]} p.events AuditLog 列（已依 createdAt 升冪）
 * @param {Record<string,string|null>} p.namesById userId → 姓名
 */
export function buildRequestProgress({ requestType, requestId, request, steps, events, namesById = {} }) {
  const sortedSteps = [...steps].sort((a, b) => a.level - b.level)
  const chain = sortedSteps.length ? summarizeStatus(sortedSteps) : { status: null, activeLevel: null }
  const withdrawn = !request && events.some((e) => e.action === 'leave.withdrawn')

  return {
    requestType,
    requestId,
    status: request?.status ?? (withdrawn ? 'withdrawn' : null),
    cancelRequested: request?.cancelRequested ?? false,
    activeLevel: request?.status === 'pending' ? chain.activeLevel : null,
    steps: sortedSteps.map((s) => ({
      level: s.level,
      status: s.status,
      approver: s.approverId ? { id: s.approverId, name: namesById[s.approverId] ?? null } : null,
      decidedAt: s.decidedAt ?? null,
      decidedBy: s.decidedById ? { id: s.decidedById, name: namesById[s.decidedById] ?? null } : null,
      note: s.note ?? null,
    })),
    events: events.map((e) => toEmployeeEvent(e, namesById)),
  }
}
