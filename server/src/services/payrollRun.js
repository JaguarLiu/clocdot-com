import { computePayslip, computeHourlyPayslip } from './payroll.js'

/**
 * 對每位員工計算薪資單；無主檔或當前身分對應薪資欄位缺值者列入 skipped。純函式。
 * parttime → 時薪引擎（忽略 cashout / company / leaveDeductRates）；其餘 → 月薪引擎。
 */
export function buildPayrollItems({ settlementRows, salaryProfilesByUserId, company, leaveDeductRates, cashoutByUserId, month, year }) {
  const items = []
  const skipped = []
  for (const row of settlementRows) {
    const salaryProfile = salaryProfilesByUserId[row.userId]
    const isHourly = row.employmentType === 'parttime'
    const payable = salaryProfile != null &&
      (isHourly ? salaryProfile.hourlyRate != null : salaryProfile.baseSalary != null)
    if (!payable) {
      skipped.push({ userId: row.userId, empNo: row.empNo, name: row.name })
      continue
    }
    const payslip = isHourly
      ? computeHourlyPayslip({ settlementRow: row, salaryProfile, month, year })
      : computePayslip({
          settlementRow: row, salaryProfile, company, leaveDeductRates,
          cashout: cashoutByUserId?.[row.userId] ?? null, month, year,
        })
    items.push({ userId: row.userId, empNo: row.empNo, name: row.name, payslip })
  }
  return { items, skipped }
}

/**
 * 套用手動調整項，回傳調整合計與實發淨額。
 */
export function applyAdjustments(payslip, adjustments) {
  const list = Array.isArray(adjustments) ? adjustments : []
  const adjustmentsTotal = list.reduce((s, a) => s + a.amount, 0)
  return { adjustmentsTotal, netPay: payslip.netPay + adjustmentsTotal }
}

/**
 * 驗證/正規化調整項輸入。
 * @returns {{ok:true,value:{label:string,amount:number}[]} | {ok:false,error:string}}
 */
export function validateAdjustments(input) {
  if (!Array.isArray(input)) return { ok: false, error: 'adjustments 必須為陣列' }
  const value = []
  for (const a of input) {
    const label = typeof a?.label === 'string' ? a.label.trim() : ''
    if (!label) return { ok: false, error: '調整項說明不可為空' }
    if (!Number.isInteger(a?.amount)) return { ok: false, error: `調整項「${label}」金額必須為整數` }
    value.push({ label, amount: a.amount })
  }
  return { ok: true, value }
}
