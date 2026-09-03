import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideStepByApprover, adminFinalize } from '../src/services/approvalEngine.js'

// ── in-memory mock DB ──
// tx client 刻意不含 $transaction（模擬 Prisma interactive tx client），
// applyLeaveToAttendance 會走逐筆執行的分支。
function makeDb({ steps = [], leave = null } = {}) {
  const state = {
    steps: steps.map((s) => ({ note: null, decidedAt: null, decidedById: null, ...s })),
    leave,
    upserts: [],
  }

  const matchStatus = (row, where) => !('status' in where) || row.status === where.status

  const tx = {
    approvalStep: {
      findUnique: async ({ where }) => state.steps.find((s) => s.id === where.id) ?? null,
      findMany: async ({ where }) => state.steps.filter(
        (s) => s.requestType === where.requestType && s.requestId === where.requestId,
      ),
      updateMany: async ({ where, data }) => {
        const hit = state.steps.filter((s) => {
          if (where.id && s.id !== where.id) return false
          if (where.requestType && s.requestType !== where.requestType) return false
          if (where.requestId && s.requestId !== where.requestId) return false
          return matchStatus(s, where)
        })
        hit.forEach((s) => Object.assign(s, data))
        return { count: hit.length }
      },
    },
    leaveRequest: {
      findUnique: async () => state.leave,
      updateMany: async ({ where, data }) => {
        if (!state.leave || state.leave.id !== where.id || !matchStatus(state.leave, where)) return { count: 0 }
        Object.assign(state.leave, data)
        return { count: 1 }
      },
    },
    leavePolicy: { findUnique: async () => null },
    attendanceRecord: {
      upsert: async (args) => { state.upserts.push(args); return {} },
    },
  }

  const prisma = { $transaction: async (fn) => fn(tx) }
  return { prisma, state, tx }
}

const LEAVE = () => ({
  id: 'L1', userId: 'emp', status: 'pending', leaveType: '特休',
  startDate: new Date(Date.UTC(2026, 6, 1)), endDate: new Date(Date.UTC(2026, 6, 2)),
  startTime: '09:00', endTime: '18:00',
  user: { id: 'emp', companyId: 'c1', employmentType: 'regular', hireDate: new Date(), company: { leavePolicyYearReset: 'anniversary' } },
})

const STEP = (over = {}) => ({
  id: 'S1', requestType: 'leave', requestId: 'L1', level: 1, approverId: 'mgr', status: 'pending', ...over,
})

// ── decideStepByApprover ──

test('找不到 step → 404', async () => {
  const { prisma } = makeDb()
  const r = await decideStepByApprover(prisma, { stepId: 'nope', userId: 'mgr', decision: 'approve' })
  assert.deepEqual([r.ok, r.code], [false, 404])
})

test('已決議的 step 再簽 → 409', async () => {
  const { prisma } = makeDb({ steps: [STEP({ status: 'approved' })], leave: LEAVE() })
  const r = await decideStepByApprover(prisma, { stepId: 'S1', userId: 'mgr', decision: 'approve' })
  assert.deepEqual([r.ok, r.code], [false, 409])
})

test('非指派人 → 403', async () => {
  const { prisma } = makeDb({ steps: [STEP()], leave: LEAVE() })
  const r = await decideStepByApprover(prisma, { stepId: 'S1', userId: 'other', decision: 'approve' })
  assert.deepEqual([r.ok, r.code], [false, 403])
})

test('並發搶輸（讀到 pending 但條件式更新落空）→ 409 此項目已被處理', async () => {
  const { prisma, tx } = makeDb({ steps: [STEP()], leave: LEAVE() })
  // 模擬另一個 tx 在讀取後、更新前搶先 commit：updateMany 條件落空
  tx.approvalStep.updateMany = async () => ({ count: 0 })
  const r = await decideStepByApprover(prisma, { stepId: 'S1', userId: 'mgr', decision: 'approve' })
  assert.deepEqual([r.ok, r.code], [false, 409])
  assert.match(r.body.error, /已被處理/)
})

test('單層核准 → effects 套用、申請與 step 皆 approved', async () => {
  const { prisma, state } = makeDb({ steps: [STEP()], leave: LEAVE() })
  const r = await decideStepByApprover(prisma, { stepId: 'S1', userId: 'mgr', decision: 'approve' })
  assert.equal(r.ok, true)
  assert.equal(r.body.status, 'approved')
  assert.equal(state.steps[0].status, 'approved')
  assert.equal(state.leave.status, 'approved')
  assert.equal(state.upserts.length, 2) // 7/1、7/2 兩天寫回考勤
})

test('兩層鏈第一層核准 → 不套用 effects、回 pending + activeLevel 2', async () => {
  const steps = [STEP(), STEP({ id: 'S2', level: 2, approverId: 'boss' })]
  const { prisma, state } = makeDb({ steps, leave: LEAVE() })
  const r = await decideStepByApprover(prisma, { stepId: 'S1', userId: 'mgr', decision: 'approve' })
  assert.equal(r.ok, true)
  assert.deepEqual(r.body, { status: 'pending', activeLevel: 2 })
  assert.equal(state.leave.status, 'pending') // 效果尚未套用
  assert.equal(state.upserts.length, 0)
})

test('第二層還沒輪到就先簽 → 409', async () => {
  const steps = [STEP(), STEP({ id: 'S2', level: 2, approverId: 'boss' })]
  const { prisma } = makeDb({ steps, leave: LEAVE() })
  const r = await decideStepByApprover(prisma, { stepId: 'S2', userId: 'boss', decision: 'approve' })
  assert.deepEqual([r.ok, r.code], [false, 409])
})

test('最終層核准但申請已被審核 → 回傳 effects 錯誤（DecisionAbort 路徑）', async () => {
  // 申請已被 admin 先核准
  const { prisma } = makeDb({ steps: [STEP()], leave: { ...LEAVE(), status: 'approved' } })
  const r = await decideStepByApprover(prisma, { stepId: 'S1', userId: 'mgr', decision: 'approve' })
  assert.deepEqual([r.ok, r.code], [false, 400])
  assert.match(r.body.error, /已審核/)
})

test('駁回 → step rejected + 申請 rejected', async () => {
  const { prisma, state } = makeDb({ steps: [STEP()], leave: LEAVE() })
  const r = await decideStepByApprover(prisma, { stepId: 'S1', userId: 'mgr', decision: 'reject', note: 'no' })
  assert.equal(r.ok, true)
  assert.equal(r.body.status, 'rejected')
  assert.equal(state.steps[0].status, 'rejected')
  assert.equal(state.leave.status, 'rejected')
  assert.equal(state.leave.reviewNote, 'no')
})

// ── adminFinalize ──

test('admin 核准 → effects 套用、pending steps 標記 skipped', async () => {
  const steps = [STEP(), STEP({ id: 'S2', level: 2, approverId: 'boss' })]
  const { prisma, state } = makeDb({ steps, leave: LEAVE() })
  const r = await adminFinalize(prisma, { requestType: 'leave', requestId: 'L1', decision: 'approve', decidedById: 'admin' })
  assert.equal(r.ok, true)
  assert.equal(state.leave.status, 'approved')
  assert.deepEqual(state.steps.map((s) => s.status), ['skipped', 'skipped'])
})

test('admin 並發重複核准（申請已 approved）→ 400 此申請已審核', async () => {
  const { prisma, state } = makeDb({ steps: [STEP()], leave: { ...LEAVE(), status: 'approved' } })
  const r = await adminFinalize(prisma, { requestType: 'leave', requestId: 'L1', decision: 'approve', decidedById: 'admin' })
  assert.deepEqual([r.ok, r.code], [false, 400])
  assert.equal(state.upserts.length, 0) // 副作用沒有重複執行
})

test('admin 駁回已審核的申請 → 400（條件式更新落空）', async () => {
  const { prisma } = makeDb({ steps: [], leave: { ...LEAVE(), status: 'rejected' } })
  const r = await adminFinalize(prisma, { requestType: 'leave', requestId: 'L1', decision: 'reject', decidedById: 'admin' })
  assert.deepEqual([r.ok, r.code], [false, 400])
})

test('admin 駁回 pending 申請（無 step 舊資料相容）→ rejected', async () => {
  const { prisma, state } = makeDb({ steps: [], leave: LEAVE() })
  const r = await adminFinalize(prisma, { requestType: 'leave', requestId: 'L1', decision: 'reject', decidedById: 'admin' })
  assert.equal(r.ok, true)
  assert.equal(state.leave.status, 'rejected')
})
