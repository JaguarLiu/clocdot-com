import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDepartmentTree, wouldCreateCycle, normalizeDepartmentName } from '../src/services/orgChart.js'

const rows = [
  { id: 'a', name: '業務部', parentId: null, managerId: 'u1', managerName: '王大明', memberCount: 5 },
  { id: 'b', name: '業務一課', parentId: 'a', managerId: 'u2', managerName: '李小華', memberCount: 3 },
  { id: 'c', name: '業務二課', parentId: 'a', managerId: null, managerName: null, memberCount: 2 },
  { id: 'd', name: '人資部', parentId: null, managerId: 'u3', managerName: '陳小美', memberCount: 2 },
]

test('buildDepartmentTree：頂層 + 巢狀 + name 排序', () => {
  const tree = buildDepartmentTree(rows)
  assert.equal(tree.length, 2)
  assert.deepEqual(tree.map((n) => n.name), ['人資部', '業務部']) // localeCompare 排序
  const sales = tree.find((n) => n.id === 'a')
  assert.equal(sales.children.length, 2)
  assert.deepEqual(sales.children.map((n) => n.name), ['業務一課', '業務二課'])
})

test('buildDepartmentTree：孤兒 parentId 視為頂層', () => {
  const tree = buildDepartmentTree([
    { id: 'x', name: 'X', parentId: 'ghost', managerId: null, managerName: null, memberCount: 0 },
  ])
  assert.equal(tree.length, 1)
  assert.equal(tree[0].id, 'x')
  assert.deepEqual(tree[0].children, [])
})

test('wouldCreateCycle：自我 parent', () => {
  assert.equal(wouldCreateCycle(rows, 'a', 'a'), true)
})

test('wouldCreateCycle：把 a 設為其子孫 b 的子 → 循環', () => {
  assert.equal(wouldCreateCycle(rows, 'a', 'b'), true)
})

test('wouldCreateCycle：合法移動（業務一課掛到人資部）→ false', () => {
  assert.equal(wouldCreateCycle(rows, 'b', 'd'), false)
})

test('wouldCreateCycle：parentId 為 null → false', () => {
  assert.equal(wouldCreateCycle(rows, 'b', null), false)
})

test('normalizeDepartmentName：trim 正常', () => {
  assert.deepEqual(normalizeDepartmentName('  業務部  '), { ok: true, value: '業務部' })
})

test('normalizeDepartmentName：空字串 / 非字串 → 錯誤', () => {
  assert.equal(normalizeDepartmentName('   ').ok, false)
  assert.equal(normalizeDepartmentName(undefined).ok, false)
})
