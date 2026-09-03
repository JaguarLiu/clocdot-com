// 多租戶隔離 helper — 搭配 requirePanel hook 掛上的 request.companyId 使用
//
// 用法：
//   const where = scopedByUser(request, { status: 'pending' })
//   const existing = await assertOwnedByCompany(
//     fastify.prisma.leaveRequest, id, request.companyId, reply
//   )
//
// 目的：讓「忘記過濾 tenant」變成顯性 (需要繞過時得自己寫 where)，而非預設。

/**
 * 回傳一個強制帶有 user.companyId 條件的 where 子句
 * 適用 model 本身沒有 companyId、但透過 userId 間接綁公司 (AttendanceRecord / LeaveRequest)
 */
export function scopedByUser(request, baseWhere = {}) {
  return {
    ...baseWhere,
    user: { is: { companyId: request.companyId } },
  }
}

/**
 * 回傳一個強制帶有 attendance.user.companyId 條件的 where 子句
 * 適用 CorrectionRequest (透過 attendance → user 間接綁公司)
 */
export function scopedByAttendanceUser(request, baseWhere = {}) {
  return {
    ...baseWhere,
    attendance: { is: { user: { is: { companyId: request.companyId } } } },
  }
}

/**
 * 審核專用：在 scopedByUser 基礎上，若 request.scopeUserIds 存在則限縮到該成員集合。
 * admin（scopeUserIds undefined）行為等同 scopedByUser（只綁公司）。
 */
export function reviewScopedByUser(request, baseWhere = {}) {
  const userCond = { companyId: request.companyId }
  if (request.scopeUserIds) userCond.id = { in: request.scopeUserIds }
  return { ...baseWhere, user: { is: userCond } }
}

/**
 * 審核專用（CorrectionRequest 透過 attendance → user）：同上限縮。
 */
export function reviewScopedByAttendanceUser(request, baseWhere = {}) {
  const userCond = { companyId: request.companyId }
  if (request.scopeUserIds) userCond.id = { in: request.scopeUserIds }
  return { ...baseWhere, attendance: { is: { user: { is: userCond } } } }
}

/**
 * 非 admin 且 userId 不在可視範圍 → 回 404 並回傳 false（呼叫端應 return）。
 * admin（scopeUserIds undefined）一律通過。
 */
export function assertInScope(request, userId, reply) {
  if (request.scopeUserIds && !request.scopeUserIds.includes(userId)) {
    reply.code(404).send({ error: '找不到資料' })
    return false
  }
  return true
}

/**
 * 找出 model by id 並確認屬於該公司 (透過自定的 ownership getter 取得 companyId)
 * 找不到或不屬於該公司都回 404 (不洩漏該 id 是否存在於其他公司)
 */
export async function assertOwnedByCompany(findById, id, companyId, reply, getCompanyId) {
  const record = await findById(id)
  if (!record) {
    reply.code(404).send({ error: '找不到資料' })
    return null
  }
  const ownerCompanyId = getCompanyId(record)
  if (ownerCompanyId !== companyId) {
    reply.code(404).send({ error: '找不到資料' })
    return null
  }
  return record
}
