// 前端版組織樹建構（與 server services/orgChart.js 邏輯一致；各自獨立避免跨 workspace import）
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
