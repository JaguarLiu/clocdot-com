// 假別 enum — server 與 admin/client 應共用此清單 (之後可抽到共享 package)

export const LEAVE_TYPES = [
  { value: 'annual',       label: '特休',   defaultDays: 7 },
  { value: 'personal',     label: '事假',   defaultDays: 14 },
  { value: 'sick',         label: '病假',   defaultDays: 30 },
  { value: 'menstrual',    label: '生理假', defaultDays: 12 }, // 台灣每月 1 天上限，12/年合理
  { value: 'marriage',     label: '婚假',   defaultDays: 8 },
  { value: 'bereavement',  label: '喪假',   defaultDays: 8 },
  { value: 'maternity',    label: '產假',   defaultDays: 56 },
  { value: 'paternity',    label: '陪產假', defaultDays: 7 },
  { value: 'official',     label: '公假',   defaultDays: 0 }, // 依實際事由
  { value: 'compensatory', label: '補休',   defaultDays: 0 }, // 由加班累積
]

export const LEAVE_TYPE_VALUES = LEAVE_TYPES.map((t) => t.value)

export function isValidLeaveType(v) {
  return LEAVE_TYPE_VALUES.includes(v)
}

export const DEFAULT_WORKDAY_MINUTES = 8 * 60 // 一日工時以 8 小時計

// 各假別「扣薪比例」系統預設（管理者可在假別政策覆寫）。0=全薪不扣，1=扣全薪(同曠職)。
export const DEFAULT_LEAVE_DEDUCT_RATE = { personal: 1, sick: 0.5 }

/**
 * 解析某假別扣薪比例：政策有設(非 null)優先，否則用系統預設，再否則 0。
 * @param {string} leaveType
 * @param {number|null|undefined} policyRate
 * @returns {number} 0~1
 */
export function resolveLeaveDeductRate(leaveType, policyRate) {
  if (policyRate != null) return policyRate
  return DEFAULT_LEAVE_DEDUCT_RATE[leaveType] ?? 0
}

/**
 * 比例制特休：用公司設定的年度天數，依到職日比例給予 (Math.ceil)
 *   未滿 1 年 → ceil(annualDays × tenureYears)
 *   滿 1 年   → annualDays (給滿)
 *   無到職日  → 0 天
 *
 * 例：annualDays = 12, hireDate = 2026-01-01, now = 2026-04-24
 *     tenureYears ≈ 0.31 → 12 × 0.31 = 3.72 → ceil → 4 天
 */
export function computeProratedAnnualDays(annualDays, hireDate, now = new Date()) {
  if (!annualDays || annualDays <= 0) return 0
  if (!hireDate || !(hireDate instanceof Date) || Number.isNaN(hireDate.getTime())) return 0
  const tenureMs = now.getTime() - hireDate.getTime()
  if (tenureMs < 0) return 0
  const tenureYears = tenureMs / (365.25 * 86400000)

  if (tenureYears >= 1) return annualDays
  return Math.ceil(annualDays * tenureYears)
}
