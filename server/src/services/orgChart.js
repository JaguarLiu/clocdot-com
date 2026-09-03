// 組織圖純邏輯（不碰 DB）：建樹、循環偵測、名稱正規化。

/**
 * 扁平部門列 → 巢狀樹。parentId 不存在於集合者視為頂層。
 * 同層依 name 以 localeCompare 排序。
 * @param {Array<{id,name,parentId,managerId,managerName,memberCount}>} rows
 * @returns {Array} 巢狀節點（每個節點多一個 children 陣列）
 */
export function buildDepartmentTree(rows) {
  const map = new Map()
  for (const r of rows) map.set(r.id, { ...r, children: [] })
  const roots = []
  for (const r of rows) {
    const node = map.get(r.id)
    const parent = r.parentId ? map.get(r.parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sortRec = (list) => {
    list.sort((a, b) => a.name.localeCompare(b.name))
    for (const n of list) sortRec(n.children)
  }
  sortRec(roots)
  return roots
}

/**
 * 若把 id 的 parent 設成 newParentId 是否會造成循環。
 * @param {Array<{id,parentId}>} rows 全公司部門（至少含 id、parentId）
 */
export function wouldCreateCycle(rows, id, newParentId) {
  if (!newParentId) return false
  if (newParentId === id) return true
  const parentOf = new Map(rows.map((r) => [r.id, r.parentId ?? null]))
  let cur = newParentId
  const seen = new Set()
  while (cur) {
    if (cur === id) return true
    if (seen.has(cur)) break // 既有資料若已有環，避免無限迴圈
    seen.add(cur)
    cur = parentOf.get(cur) ?? null
  }
  return false
}

/**
 * @param {*} name
 * @returns {{ok:true,value:string} | {ok:false,error:string}}
 */
export function normalizeDepartmentName(name) {
  const s = typeof name === 'string' ? name.trim() : ''
  if (s === '') return { ok: false, error: '部門名稱不可為空' }
  return { ok: true, value: s }
}
