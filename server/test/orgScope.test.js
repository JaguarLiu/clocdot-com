import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descendantDeptIds } from '../src/services/orgScope.js'

const depts = [
  { id: 'p', parentId: null },
  { id: 'c', parentId: 'p' },
  { id: 'g', parentId: 'c' },
  { id: 'h', parentId: null }, // 另一棵
]

test('無子部門 → 只有自己', () => {
  assert.deepEqual([...descendantDeptIds(depts, 'g')].sort(), ['g'])
})

test('多層子孫全收（含自己）', () => {
  assert.deepEqual([...descendantDeptIds(depts, 'p')].sort(), ['c', 'g', 'p'])
})

test('中間節點 → 自己 + 其下', () => {
  assert.deepEqual([...descendantDeptIds(depts, 'c')].sort(), ['c', 'g'])
})

test('root 為 null → 空集合', () => {
  assert.equal(descendantDeptIds(depts, null).size, 0)
})

test('root 不存在 → 空集合', () => {
  assert.equal(descendantDeptIds(depts, 'nope').size, 0)
})

test('含環不無限迴圈', () => {
  const cyclic = [
    { id: 'a', parentId: 'b' },
    { id: 'b', parentId: 'a' },
  ]
  const r = descendantDeptIds(cyclic, 'a')
  assert.ok(r.has('a') && r.has('b'))
})
