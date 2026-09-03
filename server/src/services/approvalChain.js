// 簽核鏈純邏輯（不碰 DB）。

/**
 * 沿部門樹往上計算簽核鏈。
 * @param {{submitterId:string, departmentId:string|null,
 *          departmentsById:Map<string,{id,parentId,managerId}>, levels:number}} p
 * @returns {Array<{level:number, approverId:string|null}>} 長度恆為 levels
 */
export function computeChain({ submitterId, departmentId, departmentsById, levels }) {
  const result = []
  const used = new Set()
  let cur = departmentId ? departmentsById.get(departmentId) : null
  while (result.length < levels && cur) {
    const mgr = cur.managerId
    if (mgr && mgr !== submitterId && !used.has(mgr)) {
      used.add(mgr)
      result.push({ level: result.length + 1, approverId: mgr })
    }
    cur = cur.parentId ? departmentsById.get(cur.parentId) : null
  }
  while (result.length < levels) {
    result.push({ level: result.length + 1, approverId: null })
  }
  return result
}

/**
 * @param {Array<{level:number, status:string}>} steps
 * @returns {{status:'pending'|'approved'|'rejected', activeLevel:number|null}}
 */
export function summarizeStatus(steps) {
  if (steps.some((s) => s.status === 'rejected')) return { status: 'rejected', activeLevel: null }
  const pending = steps.filter((s) => s.status === 'pending')
  if (pending.length === 0) return { status: 'approved', activeLevel: null }
  return { status: 'pending', activeLevel: Math.min(...pending.map((s) => s.level)) }
}
