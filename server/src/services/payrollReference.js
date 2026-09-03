import { getPayrollReference } from '../data/twPayroll/index.js'

/**
 * 分級查找：回傳 grades 中 >= monthlyWage 的最小級距；
 * 超過最高級距 → 最高級距；低於最低 → 最低級距。
 * @param {number[]} grades 升冪排序
 * @param {number} monthlyWage
 * @returns {number}
 */
export function findGrade(grades, monthlyWage) {
  if (!Array.isArray(grades) || grades.length === 0) {
    throw new Error('findGrade: grades 不可為空')
  }
  if (!Number.isFinite(monthlyWage)) {
    throw new Error('findGrade: monthlyWage 必須為有限數')
  }
  for (const g of grades) {
    if (g >= monthlyWage) return g
  }
  return grades[grades.length - 1]
}

export function laborInsuredSalary(monthlyWage, year) {
  return findGrade(getPayrollReference(year).laborInsuranceGrades, monthlyWage)
}

export function healthInsuredSalary(monthlyWage, year) {
  return findGrade(getPayrollReference(year).healthInsuranceGrades, monthlyWage)
}

export function pensionWage(monthlyWage, year) {
  return findGrade(getPayrollReference(year).pensionWageGrades, monthlyWage)
}

export function getRates(year) {
  return getPayrollReference(year).rates
}

/**
 * 居住者薪資每月扣繳：達起扣標準則按全月給付總額 5% 扣取（四捨五入到元），否則 0。
 * @param {number} taxableMonthlyTotal 全月應稅給付總額
 * @param {number|string} year
 * @returns {number}
 */
export function incomeTaxWithholding(taxableMonthlyTotal, year) {
  const { incomeTaxThreshold, incomeTaxRate } = getRates(year)
  if (taxableMonthlyTotal < incomeTaxThreshold) return 0
  return Math.round(taxableMonthlyTotal * incomeTaxRate)
}
