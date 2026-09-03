// 組織範圍純邏輯（不碰 DB）：取某部門的子樹部門 id。

/**
 * @param {Array<{id:string, parentId:string|null}>} departments
 * @param {string|null} rootDeptId
 * @returns {Set<string>} root + 所有子孫部門 id；root 為 null/不存在 → 空集合
 */
export function descendantDeptIds(departments, rootDeptId) {
  const out = new Set()
  if (!rootDeptId) return out
  if (!departments.some((d) => d.id === rootDeptId)) return out
  const childrenOf = new Map()
  for (const d of departments) {
    if (!childrenOf.has(d.parentId)) childrenOf.set(d.parentId, [])
    childrenOf.get(d.parentId).push(d.id)
  }
  const stack = [rootDeptId]
  while (stack.length) {
    const id = stack.pop()
    if (out.has(id)) continue
    out.add(id)
    for (const child of childrenOf.get(id) ?? []) stack.push(child)
  }
  return out
}
