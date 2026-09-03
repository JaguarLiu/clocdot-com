import {
  laborInsuredSalary as deriveLaborInsured,
  healthInsuredSalary as deriveHealthInsured,
  pensionWage,
  getRates,
  incomeTaxWithholding,
} from './payrollReference.js'
import { computeAttendanceDeduction } from './attendanceDeduction.js'

const FIXED_OT_MULTIPLIER = { holiday: 1.0, regular_leave: 1.0 }

function tierMultiplier(rate) {
  if (Object.prototype.hasOwnProperty.call(FIXED_OT_MULTIPLIER, rate)) {
    return FIXED_OT_MULTIPLIER[rate]
  }
  const n = Number(rate)
  if (!Number.isFinite(n)) throw new Error(`computePayslip: 未知加班 rate「${rate}」`)
  return n
}

/**
 * 計算單一員工的薪資單明細（純函式）。
 */
export function computePayslip({ settlementRow, salaryProfile, company, leaveDeductRates, cashout, month, year }) {
  if (!salaryProfile) throw new Error('computePayslip: salaryProfile 必填')
  const baseSalary = salaryProfile.baseSalary
  if (!Number.isFinite(baseSalary)) throw new Error('computePayslip: baseSalary 必須為數字')

  const cashoutEarning = cashout && cashout.amount > 0
    ? { days: cashout.days, minutes: cashout.minutes, amount: cashout.amount }
    : null
  const cashoutAmount = cashoutEarning?.amount ?? 0

  // 整月零出勤且無任何核准請假（且該月有工作日）→ 視同當月未提供勞務，不計薪（實發 0）。
  // 只要有出勤任一天或有請假，就走下方正常計算（零星缺勤仍按日扣）。
  const hasWorkdays = (settlementRow.attendanceDays?.length ?? 0) > 0
  if (hasWorkdays && settlementRow.actualMinutes === 0 && (settlementRow.leaveMinutes ?? 0) === 0) {
    const incomeTax = cashoutAmount > 0 ? incomeTaxWithholding(cashoutAmount, year) : 0
    return {
      userId: settlementRow.userId,
      empNo: settlementRow.empNo,
      name: settlementRow.name,
      month,
      year,
      earnings: { baseSalary: 0, allowances: [], overtime: { tiers: [], total: 0 }, leaveCashout: cashoutEarning, grossPay: cashoutAmount },
      deductions: {
        laborInsurance: 0, healthInsurance: 0, pensionVoluntary: 0, incomeTax,
        attendanceDeduction: 0, leaveDeduction: 0, total: incomeTax,
      },
      netPay: cashoutAmount - incomeTax,
      meta: { payType: 'monthly', unpaidAbsentMonth: true, taxableTotal: cashoutAmount },
    }
  }

  const allowances = Array.isArray(salaryProfile.allowances) ? salaryProfile.allowances : []
  const sum = (list) => list.reduce((s, a) => s + a.amount, 0)
  const insuredAllowanceTotal = sum(allowances.filter((a) => a.insured))
  const taxableAllowanceTotal = sum(allowances.filter((a) => a.taxable))
  const allowanceTotal = sum(allowances)

  const insuredMonthlyWage = baseSalary + insuredAllowanceTotal
  const overtimeHourly = insuredMonthlyWage / 240

  const overtimeByRate = settlementRow.overtimeByRate ?? {}
  const tiers = Object.entries(overtimeByRate).map(([rate, minutes]) => {
    const multiplier = tierMultiplier(rate)
    const amount = Math.round((minutes / 60) * overtimeHourly * multiplier)
    return { rate, minutes, multiplier, amount }
  })
  const overtimeTotal = tiers.reduce((s, t) => s + t.amount, 0)

  const grossPay = baseSalary + allowanceTotal + overtimeTotal + cashoutAmount

  const rates = getRates(year)
  const laborBase = salaryProfile.laborInsuredSalary ?? deriveLaborInsured(insuredMonthlyWage, year)
  const healthBase = salaryProfile.healthInsuredSalary ?? deriveHealthInsured(insuredMonthlyWage, year)
  const insuredSalaryAutoDerived = salaryProfile.laborInsuredSalary == null || salaryProfile.healthInsuredSalary == null
  const pWage = pensionWage(insuredMonthlyWage, year)

  const laborInsurance = Math.round(
    laborBase * (rates.laborOrdinaryRate + rates.employmentInsuranceRate) * rates.laborEmployeeShare,
  )
  const dependents = Math.min(salaryProfile.healthDependents ?? 0, 3)
  const healthInsurance = Math.round(
    healthBase * rates.healthRate * rates.healthEmployeeShare * (1 + dependents),
  )
  const pensionRate = Number(salaryProfile.pensionVoluntaryRate ?? 0)
  const pensionVoluntary = Math.round(pWage * pensionRate)

  const taxableTotal = baseSalary + taxableAllowanceTotal + overtimeTotal + cashoutAmount
  const incomeTax = incomeTaxWithholding(taxableTotal, year)

  // 遲到/早退/缺勤/工時不足 + 請假 扣款（獨立項，不影響上方稅與投保基數）
  const attendanceDays = settlementRow.attendanceDays ?? []
  const monthlyWage = baseSalary + allowanceTotal
  const attDed = (company && attendanceDays.length)
    ? computeAttendanceDeduction({ days: attendanceDays, company, monthlyWage, leaveDeductRates: leaveDeductRates ?? {} })
    : { attendanceDeduction: 0, leaveDeduction: 0, days: [] }

  const deductionTotal =
    laborInsurance + healthInsurance + pensionVoluntary + incomeTax +
    attDed.attendanceDeduction + attDed.leaveDeduction

  return {
    userId: settlementRow.userId,
    empNo: settlementRow.empNo,
    name: settlementRow.name,
    month,
    year,
    earnings: {
      baseSalary,
      allowances: allowances.map((a) => ({
        name: a.name, amount: a.amount, taxable: Boolean(a.taxable), insured: Boolean(a.insured),
      })),
      overtime: { tiers, total: overtimeTotal },
      leaveCashout: cashoutEarning,
      grossPay,
    },
    deductions: {
      laborInsurance,
      healthInsurance,
      pensionVoluntary,
      incomeTax,
      attendanceDeduction: attDed.attendanceDeduction,
      leaveDeduction: attDed.leaveDeduction,
      total: deductionTotal,
    },
    netPay: grossPay - deductionTotal,
    meta: {
      payType: 'monthly',
      overtimeHourly,
      laborInsuredSalary: laborBase,
      healthInsuredSalary: healthBase,
      pensionWage: pWage,
      taxableTotal,
      insuredSalaryAutoDerived,
      attendanceDeductionDays: attDed.days,
    },
  }
}

const HOURLY_FIXED_OT_MULTIPLIER = { holiday: 2.0, regular_leave: 2.0 }

function hourlyTierMultiplier(rate) {
  if (Object.prototype.hasOwnProperty.call(HOURLY_FIXED_OT_MULTIPLIER, rate)) {
    return HOURLY_FIXED_OT_MULTIPLIER[rate]
  }
  const n = Number(rate)
  if (!Number.isFinite(n)) throw new Error(`computeHourlyPayslip: 未知加班 rate「${rate}」`)
  return n
}

/**
 * PT 時薪制薪資單（純函式）。
 * 一般工時 = actualMinutes − 核准加班分鐘（clamp 0）× 1.0；
 * 加班依倍率（holiday/regular_leave = 2.0，時薪制無「月薪已含當日工資」前提）；
 * 勞健保投保薪資：主檔手填優先，否則以當月毛額查級距。
 */
export function computeHourlyPayslip({ settlementRow, salaryProfile, month, year }) {
  if (!salaryProfile) throw new Error('computeHourlyPayslip: salaryProfile 必填')
  const hourlyRate = salaryProfile.hourlyRate
  if (!Number.isInteger(hourlyRate) || hourlyRate <= 0) {
    throw new Error('computeHourlyPayslip: hourlyRate 必須為正整數')
  }

  const overtimeByRate = settlementRow.overtimeByRate ?? {}
  const otMinutes = Object.values(overtimeByRate).reduce((s, m) => s + m, 0)
  const regularMinutes = Math.max(0, (settlementRow.actualMinutes ?? 0) - otMinutes)
  const regularPay = Math.round((regularMinutes / 60) * hourlyRate)

  const tiers = Object.entries(overtimeByRate).map(([rate, minutes]) => {
    const multiplier = hourlyTierMultiplier(rate)
    const amount = Math.round((minutes / 60) * hourlyRate * multiplier)
    return { rate, minutes, multiplier, amount }
  })
  const overtimeTotal = tiers.reduce((s, t) => s + t.amount, 0)
  const grossPay = regularPay + overtimeTotal

  const base = {
    userId: settlementRow.userId,
    empNo: settlementRow.empNo,
    name: settlementRow.name,
    month,
    year,
  }

  if (grossPay === 0) {
    return {
      ...base,
      earnings: { hourlyRate, regularMinutes, regularPay: 0, overtime: { tiers, total: 0 }, grossPay: 0 },
      deductions: {
        laborInsurance: 0, healthInsurance: 0, pensionVoluntary: 0, incomeTax: 0,
        attendanceDeduction: 0, leaveDeduction: 0, total: 0,
      },
      netPay: 0,
      meta: { payType: 'hourly', unpaidAbsentMonth: true, taxableTotal: 0 },
    }
  }

  const rates = getRates(year)
  const laborBase = salaryProfile.laborInsuredSalary ?? deriveLaborInsured(grossPay, year)
  const healthBase = salaryProfile.healthInsuredSalary ?? deriveHealthInsured(grossPay, year)
  const insuredSalaryAutoDerived = salaryProfile.laborInsuredSalary == null || salaryProfile.healthInsuredSalary == null
  const pWage = pensionWage(grossPay, year)

  const laborInsurance = Math.round(
    laborBase * (rates.laborOrdinaryRate + rates.employmentInsuranceRate) * rates.laborEmployeeShare,
  )
  const dependents = Math.min(salaryProfile.healthDependents ?? 0, 3)
  const healthInsurance = Math.round(
    healthBase * rates.healthRate * rates.healthEmployeeShare * (1 + dependents),
  )
  const pensionRate = Number(salaryProfile.pensionVoluntaryRate ?? 0)
  const pensionVoluntary = Math.round(pWage * pensionRate)
  const incomeTax = incomeTaxWithholding(grossPay, year)

  const deductionTotal = laborInsurance + healthInsurance + pensionVoluntary + incomeTax

  return {
    ...base,
    earnings: { hourlyRate, regularMinutes, regularPay, overtime: { tiers, total: overtimeTotal }, grossPay },
    deductions: {
      laborInsurance,
      healthInsurance,
      pensionVoluntary,
      incomeTax,
      attendanceDeduction: 0,
      leaveDeduction: 0,
      total: deductionTotal,
    },
    netPay: grossPay - deductionTotal,
    meta: {
      payType: 'hourly',
      laborInsuredSalary: laborBase,
      healthInsuredSalary: healthBase,
      pensionWage: pWage,
      taxableTotal: grossPay,
      insuredSalaryAutoDerived,
    },
  }
}
