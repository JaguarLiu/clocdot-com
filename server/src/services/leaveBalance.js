// 假別額度計算：
// - 請假時數 (分鐘) 換算
// - 年度起訖 (anniversary / calendar)
// - 已用 / 剩餘
//
// 設計簡化 (MVP)：
// - 同日請假：(endTime - startTime) 分鐘，不扣午休
// - 跨日請假：(endDate - startDate + 1) 天 × 480 分鐘，忽略當日 startTime/endTime
//   — 實際 HR 算法更複雜 (含假日/週休)，未來有需要再細化

import { DEFAULT_WORKDAY_MINUTES, computeProratedAnnualDays } from './leaveTypes.js'

/**
 * 根據 policy 與員工狀態，解出這個假別當年度的額度分鐘數。
 * - 特休 (annual) → 一律按到職比例 (ceil)；滿 1 年自動回到滿額；無 hireDate 為 0
 * - 其他假別 → 直接用 annualQuotaMinutes
 */
export function resolveQuotaMinutes(policy, user, now = new Date()) {
  if (policy.leaveType === 'annual') {
    const annualDays = policy.annualQuotaMinutes / DEFAULT_WORKDAY_MINUTES
    const proratedDays = computeProratedAnnualDays(annualDays, user.hireDate, now)
    return proratedDays * DEFAULT_WORKDAY_MINUTES
  }
  return policy.annualQuotaMinutes
}

function timeToMinutes(t) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t)
  if (!match) return NaN
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * @returns {number} 請假總分鐘數 (非法輸入回 NaN；呼叫端必須用 Number.isFinite 判斷)
 */
export function computeLeaveMinutes({ startDate, startTime, endDate, endTime }) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return NaN
  const sStart = startDate.getTime()
  const sEnd = endDate.getTime()
  if (!Number.isFinite(sStart) || !Number.isFinite(sEnd)) return NaN

  if (sStart === sEnd) {
    const s = timeToMinutes(startTime)
    const e = timeToMinutes(endTime)
    if (!Number.isFinite(s) || !Number.isFinite(e)) return NaN
    return Math.max(0, e - s)
  }
  const days = Math.round((sEnd - sStart) / 86400000) + 1
  return Math.max(0, days * DEFAULT_WORKDAY_MINUTES)
}

/**
 * 取得特定 "policy year" 的 [start, end] — end 為當年之後 1ms (exclusive upper)
 * policy: 'anniversary' | 'calendar'
 * anniversary 需 hireDate；若 hireDate 為空則退 'calendar'
 */
export function computePolicyYearBounds({ policy, hireDate, now = new Date() }) {
  if (policy === 'anniversary' && hireDate) {
    // 取當年週年日：若今年週年已過，取今年週年日；未到則取去年週年日
    const h = hireDate
    const yrBase = now.getUTCFullYear()
    const tryThisYear = new Date(Date.UTC(yrBase, h.getUTCMonth(), h.getUTCDate()))
    const start = tryThisYear <= now ? tryThisYear : new Date(Date.UTC(yrBase - 1, h.getUTCMonth(), h.getUTCDate()))
    const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate()))
    return { start, end }
  }
  const y = now.getUTCFullYear()
  return {
    start: new Date(Date.UTC(y, 0, 1)),
    end: new Date(Date.UTC(y + 1, 0, 1)),
  }
}

/**
 * 查詢該員工在當前 policy year 內某假別的已用分鐘數 (僅計入 status=approved)
 * 以 LeaveRequest.startDate 落在年度區間為準
 */
export async function getUsedMinutes(prisma, { userId, leaveType, yearStart, yearEnd }) {
  const requests = await prisma.leaveRequest.findMany({
    where: {
      userId,
      leaveType,
      status: 'approved',
      startDate: { gte: yearStart, lt: yearEnd },
    },
    select: { startDate: true, startTime: true, endDate: true, endTime: true },
  })
  let total = 0
  for (const r of requests) {
    const m = computeLeaveMinutes(r)
    // 歷史髒資料 (非法 time/date 字串) 回 NaN — 跳過，不讓它污染 total
    if (Number.isFinite(m)) total += m
  }
  return total
}

/**
 * 查詢該員工在 policy year 內的特休換薪總分鐘數（以 effectiveDate 落在區間為準）
 */
export async function getCashedOutMinutes(prisma, { userId, yearStart, yearEnd }) {
  const rows = await prisma.leaveCashout.findMany({
    where: { userId, effectiveDate: { gte: yearStart, lt: yearEnd } },
    select: { minutes: true },
  })
  return rows.reduce((s, r) => s + r.minutes, 0)
}

/**
 * 高階：一次 build 出該員工所有假別的額度/已用/剩餘
 */
export async function buildBalances(prisma, { user, company, policies, now = new Date() }) {
  const bounds = computePolicyYearBounds({
    policy: company.leavePolicyYearReset,
    hireDate: user.hireDate,
    now,
  })
  const balances = []
  for (const p of policies) {
    const quotaMinutes = resolveQuotaMinutes(p, user, now)
    const used = await getUsedMinutes(prisma, {
      userId: user.id,
      leaveType: p.leaveType,
      yearStart: bounds.start,
      yearEnd: bounds.end,
    })
    const cashedOut = p.leaveType === 'annual'
      ? await getCashedOutMinutes(prisma, { userId: user.id, yearStart: bounds.start, yearEnd: bounds.end })
      : 0
    balances.push({
      leaveType: p.leaveType,
      quotaMinutes,
      usedMinutes: used,
      cashedOutMinutes: cashedOut,
      remainingMinutes: quotaMinutes - used - cashedOut,
      // 便於前端顯示 "自動" 或 "未設到職日" 等提示
      isProrated: p.leaveType === 'annual',
    })
  }
  return { yearStart: bounds.start, yearEnd: bounds.end, balances }
}
