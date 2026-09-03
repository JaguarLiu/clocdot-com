import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeChain, summarizeStatus } from '../src/services/approvalChain.js'

// 部門樹：孫 g(mgr=mG) → 子 c(mgr=mC) → 父 p(mgr=mP)
function deptsMap(list) {
  return new Map(list.map((d) => [d.id, d]))
}
const tree = deptsMap([
  { id: 'g', parentId: 'c', managerId: 'mG' },
  { id: 'c', parentId: 'p', managerId: 'mC' },
  { id: 'p', parentId: null, managerId: 'mP' },
])

test('computeChain：單層 = 直屬主管', () => {
  const chain = computeChain({ submitterId: 'emp', departmentId: 'g', departmentsById: tree, levels: 1 })
  assert.deepEqual(chain, [{ level: 1, approverId: 'mG' }])
})

test('computeChain：多層沿樹往上', () => {
  const chain = computeChain({ submitterId: 'emp', departmentId: 'g', departmentsById: tree, levels: 3 })
  assert.deepEqual(chain, [
    { level: 1, approverId: 'mG' },
    { level: 2, approverId: 'mC' },
    { level: 3, approverId: 'mP' },
  ])
})

test('computeChain：樹不足 N → 補 admin pool(null)', () => {
  const chain = computeChain({ submitterId: 'emp', departmentId: 'c', departmentsById: tree, levels: 3 })
  assert.deepEqual(chain, [
    { level: 1, approverId: 'mC' },
    { level: 2, approverId: 'mP' },
    { level: 3, approverId: null },
  ])
})

test('computeChain：跳過無主管的部門（不佔層，繼續往上）', () => {
  const t = deptsMap([
    { id: 'g', parentId: 'c', managerId: null },
    { id: 'c', parentId: 'p', managerId: 'mC' },
    { id: 'p', parentId: null, managerId: 'mP' },
  ])
  const chain = computeChain({ submitterId: 'emp', departmentId: 'g', departmentsById: t, levels: 2 })
  assert.deepEqual(chain, [
    { level: 1, approverId: 'mC' },
    { level: 2, approverId: 'mP' },
  ])
})

test('computeChain：跳過送單者本人 + 去重', () => {
  const t = deptsMap([
    { id: 'g', parentId: 'c', managerId: 'emp' }, // 送單者自己是主管 → 跳過
    { id: 'c', parentId: 'p', managerId: 'mC' },
    { id: 'p', parentId: null, managerId: 'mC' },  // 同一人 → 去重
  ])
  const chain = computeChain({ submitterId: 'emp', departmentId: 'g', departmentsById: t, levels: 3 })
  assert.deepEqual(chain, [
    { level: 1, approverId: 'mC' },
    { level: 2, approverId: null },
    { level: 3, approverId: null },
  ])
})

test('computeChain：無部門 → 全 admin pool', () => {
  const chain = computeChain({ submitterId: 'emp', departmentId: null, departmentsById: tree, levels: 2 })
  assert.deepEqual(chain, [
    { level: 1, approverId: null },
    { level: 2, approverId: null },
  ])
})

test('summarizeStatus：全 pending → pending, activeLevel=1', () => {
  const r = summarizeStatus([
    { level: 1, status: 'pending' }, { level: 2, status: 'pending' },
  ])
  assert.deepEqual(r, { status: 'pending', activeLevel: 1 })
})

test('summarizeStatus：第一層核准 → activeLevel 前進到 2', () => {
  const r = summarizeStatus([
    { level: 1, status: 'approved' }, { level: 2, status: 'pending' },
  ])
  assert.deepEqual(r, { status: 'pending', activeLevel: 2 })
})

test('summarizeStatus：任一 rejected → rejected', () => {
  const r = summarizeStatus([
    { level: 1, status: 'approved' }, { level: 2, status: 'rejected' },
  ])
  assert.equal(r.status, 'rejected')
})

test('summarizeStatus：全 approved/skipped → approved', () => {
  const r = summarizeStatus([
    { level: 1, status: 'approved' }, { level: 2, status: 'skipped' },
  ])
  assert.deepEqual(r, { status: 'approved', activeLevel: null })
})
