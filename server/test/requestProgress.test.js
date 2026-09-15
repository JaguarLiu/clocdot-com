import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRequestProgress } from '../src/services/requestProgress.js'

const decidedAt = new Date('2026-09-10T02:00:00Z')

test('進行中：回報目前卡在哪一層與每層簽核人', () => {
  const p = buildRequestProgress({
    requestType: 'leave', requestId: 'L1',
    request: { status: 'pending', cancelRequested: false },
    steps: [
      { level: 2, status: 'pending', approverId: 'boss' },
      { level: 1, status: 'approved', approverId: 'mgr', decidedAt, decidedById: 'mgr', note: 'ok' },
    ],
    events: [{ id: 'e1', action: 'leave.submitted', entityType: 'leave', entityId: 'L1', createdAt: new Date(0), actorId: 'emp' }],
    namesById: { mgr: '主管', boss: '老闆', emp: '員工' },
  })
  assert.equal(p.status, 'pending')
  assert.equal(p.activeLevel, 2)
  assert.deepEqual(p.steps.map((s) => s.level), [1, 2])
  assert.equal(p.steps[0].decidedAt, decidedAt)
  assert.deepEqual(p.steps[1].approver, { id: 'boss', name: '老闆' })
  assert.equal(p.events[0].actor.name, '員工')
})

test('已核准：activeLevel 為 null', () => {
  const p = buildRequestProgress({
    requestType: 'overtime', requestId: 'O1', request: { status: 'approved' },
    steps: [{ level: 1, status: 'approved', approverId: 'mgr', decidedAt, decidedById: 'mgr' }],
    events: [],
  })
  assert.equal(p.status, 'approved')
  assert.equal(p.activeLevel, null)
})

test('已撤回（申請列已刪除）：status = withdrawn，只回事件', () => {
  const p = buildRequestProgress({
    requestType: 'leave', requestId: 'L1', request: null, steps: [],
    events: [
      { id: 'e1', action: 'leave.submitted', entityType: 'leave', entityId: 'L1', createdAt: new Date(0), actorId: 'emp' },
      { id: 'e2', action: 'leave.withdrawn', entityType: 'leave', entityId: 'L1', createdAt: new Date(1), actorId: 'emp' },
    ],
  })
  assert.equal(p.status, 'withdrawn')
  assert.equal(p.events.length, 2)
})
