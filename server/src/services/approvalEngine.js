import { computeChain, summarizeStatus } from './approvalChain.js'
import { applyApprovalEffects } from './approvalEffects.js'

// 決議流程中止用：帶著結果丟出，讓 runInTx rollback 後把結果回給呼叫端
class DecisionAbort extends Error {
  constructor(result) {
    super('approval decision aborted')
    this.result = result
  }
}

// 決議整段包 interactive transaction (P1-8)：任何一步失敗即整體 rollback
async function runInTx(prisma, fn) {
  try {
    return await prisma.$transaction(fn, { timeout: 10000 })
  } catch (err) {
    if (err instanceof DecisionAbort) return err.result
    throw err
  }
}

// 設定「駁回」時申請的總狀態（核准走 applyApprovalEffects）
// 條件式寫入：只有仍 pending 的申請能被駁回；回傳是否成功
async function setRequestRejected(prisma, { requestType, requestId, decidedById, note }) {
  let res = { count: 0 }
  if (requestType === 'leave') {
    res = await prisma.leaveRequest.updateMany({
      where: { id: requestId, status: 'pending' },
      data: { status: 'rejected', reviewerId: decidedById, reviewedAt: new Date(), reviewNote: note || null },
    })
  } else if (requestType === 'correction') {
    res = await prisma.correctionRequest.updateMany({ where: { id: requestId, status: 'pending' }, data: { status: 'rejected' } })
  } else if (requestType === 'overtime') {
    res = await prisma.overtimeRequest.updateMany({ where: { id: requestId, status: 'pending' }, data: { status: 'rejected' } })
  }
  return res.count > 0
}

// 送單時建鏈（覆蓋舊鏈：先刪後建，支援加班 upsert 重送）
export async function createApprovalChain(prisma, { requestType, requestId, submitterId, companyId }) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { approvalLevels: true } })
  const levels = company?.approvalLevels ?? 1
  const submitter = await prisma.user.findUnique({ where: { id: submitterId }, select: { departmentId: true } })
  const depts = await prisma.department.findMany({
    where: { companyId }, select: { id: true, parentId: true, managerId: true },
  })
  const departmentsById = new Map(depts.map((d) => [d.id, d]))
  const chain = computeChain({ submitterId, departmentId: submitter?.departmentId ?? null, departmentsById, levels })
  await prisma.approvalStep.deleteMany({ where: { requestType, requestId } })
  await prisma.approvalStep.createMany({
    data: chain.map((s) => ({ requestType, requestId, level: s.level, approverId: s.approverId })),
  })
  return chain
}

// 員工/主管於員工端決議
export async function decideStepByApprover(prisma, { stepId, userId, decision, note, confirm }) {
  return runInTx(prisma, async (tx) => {
    const step = await tx.approvalStep.findUnique({ where: { id: stepId } })
    if (!step) return { ok: false, code: 404, body: { error: '找不到簽核項目' } }
    const steps = await tx.approvalStep.findMany({ where: { requestType: step.requestType, requestId: step.requestId } })
    const { activeLevel } = summarizeStatus(steps)
    if (step.status !== 'pending' || step.level !== activeLevel) {
      return { ok: false, code: 409, body: { error: '此項目目前無法簽核' } }
    }
    if (step.approverId !== userId) return { ok: false, code: 403, body: { error: '非指派給您的簽核' } }

    // 樂觀鎖 (P1-8)：條件式搶下 step，同層並發 / 同一人連點只有一個會成功
    const claimed = await tx.approvalStep.updateMany({
      where: { id: step.id, status: 'pending' },
      data: {
        status: decision === 'reject' ? 'rejected' : 'approved',
        note: note || null, decidedAt: new Date(), decidedById: userId,
      },
    })
    if (claimed.count === 0) return { ok: false, code: 409, body: { error: '此項目已被處理' } }

    if (decision === 'reject') {
      const marked = await setRequestRejected(tx, { requestType: step.requestType, requestId: step.requestId, decidedById: userId, note })
      if (!marked) throw new DecisionAbort({ ok: false, code: 409, body: { error: '此申請已審核' } })
      return { ok: true, body: { status: 'rejected' } }
    }

    // approve：核准後整筆完成才套用副作用
    const after = steps.map((s) => (s.id === step.id ? { ...s, status: 'approved' } : s))
    const summary = summarizeStatus(after)
    if (summary.status === 'approved') {
      const eff = await applyApprovalEffects(tx, {
        requestType: step.requestType, requestId: step.requestId, decidedById: userId, note, confirm,
      })
      // 效果未成立（餘額不足 / 合規 409 需 confirm…）→ rollback，step 維持 pending
      if (!eff.ok) throw new DecisionAbort(eff)
    }
    return { ok: true, body: summary.status === 'approved' ? { status: 'approved' } : { status: 'pending', activeLevel: summary.activeLevel } }
  })
}

// admin 越級：一鍵核准整筆 / 駁回（相容無 step 的舊申請）
export async function adminFinalize(prisma, { requestType, requestId, decision, note, decidedById, confirm }) {
  return runInTx(prisma, async (tx) => {
    if (decision === 'reject') {
      await tx.approvalStep.updateMany({
        where: { requestType, requestId, status: 'pending' },
        data: { status: 'rejected', decidedAt: new Date(), decidedById },
      })
      const marked = await setRequestRejected(tx, { requestType, requestId, decidedById, note })
      if (!marked) throw new DecisionAbort({ ok: false, code: 400, body: { error: '此申請已審核' } })
      return { ok: true, body: { status: 'rejected' } }
    }
    const eff = await applyApprovalEffects(tx, { requestType, requestId, decidedById, note, confirm })
    if (!eff.ok) throw new DecisionAbort(eff)
    await tx.approvalStep.updateMany({
      where: { requestType, requestId, status: 'pending' },
      data: { status: 'skipped', decidedAt: new Date(), decidedById },
    })
    return { ok: true, body: { status: 'approved' } }
  })
}

// 員工端待簽清單：active 層且指派給該使用者的 pending step + 申請摘要
export async function listPendingForUser(prisma, userId) {
  const mySteps = await prisma.approvalStep.findMany({
    where: { approverId: userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  })
  const out = []
  for (const step of mySteps) {
    const siblings = await prisma.approvalStep.findMany({
      where: { requestType: step.requestType, requestId: step.requestId },
    })
    const { activeLevel } = summarizeStatus(siblings)
    if (step.level !== activeLevel) continue // 還沒輪到這層
    const summary = await loadRequestSummary(prisma, step.requestType, step.requestId)
    if (summary) out.push({ stepId: step.id, level: step.level, requestType: step.requestType, ...summary })
  }
  return out
}

async function loadRequestSummary(prisma, requestType, requestId) {
  if (requestType === 'leave') {
    const r = await prisma.leaveRequest.findUnique({
      where: { id: requestId }, include: { user: { select: { name: true, email: true } } },
    })
    if (!r) return null
    return { applicant: r.user?.name || r.user?.email, leaveType: r.leaveType, startDate: r.startDate, startTime: r.startTime, endDate: r.endDate, endTime: r.endTime, reason: r.reason }
  }
  if (requestType === 'correction') {
    const r = await prisma.correctionRequest.findUnique({
      where: { id: requestId }, include: { attendance: { include: { user: { select: { name: true, email: true } } } } },
    })
    if (!r) return null
    return { applicant: r.attendance?.user?.name || r.attendance?.user?.email, reason: r.reason, workDate: r.attendance?.workDate }
  }
  if (requestType === 'overtime') {
    const r = await prisma.overtimeRequest.findUnique({
      where: { id: requestId }, include: { user: { select: { name: true, email: true } } },
    })
    if (!r) return null
    return { applicant: r.user?.name || r.user?.email, workDate: r.workDate, requestedMinutes: r.requestedMinutes, reason: r.reason }
  }
  return null
}
