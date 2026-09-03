import { useState } from 'react'
import useSWR from 'swr'
import { useTranslation } from 'react-i18next'
import { Wallet } from 'lucide-react'
import PaperPiece from '../components/PaperPiece.jsx'
import { formatYearMonth } from '../utils/time.js'
import { getMyPayslipMonths, getMyPayslip } from '../services/api.js'

// 金額一律用當前語系的千分位格式
const money = (n, lang) => (n ?? 0).toLocaleString(lang)

function monthLabel(m, lang) {
  const [y, mo] = m.split('-')
  return formatYearMonth(new Date(Number(y), Number(mo) - 1, 1), lang)
}

function Row({ label, value, strong }) {
  const { i18n } = useTranslation()
  return (
    <div className={`flex items-center justify-between py-1 ${strong ? 'font-black text-slate-700' : 'text-slate-500'}`}>
      <span className="font-zh text-sm">{label}</span>
      <span className="font-mono tabular-nums text-sm">{money(value, i18n.resolvedLanguage)}</span>
    </div>
  )
}

export default function Payslip() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const fmtMin = (m) => t('payslip.hoursMinutes', { hours: Math.floor((m ?? 0) / 60), minutes: (m ?? 0) % 60 })
  const { data: months, isLoading: monthsLoading } = useSWR('/payroll/me', getMyPayslipMonths)
  const [picked, setPicked] = useState(null)
  const month = picked ?? months?.[0]?.month ?? null
  const { data: slip, isLoading: slipLoading } = useSWR(
    month ? `/payroll/me/${month}` : null,
    () => getMyPayslip(month),
  )

  if (monthsLoading) {
    return (
      <main className="w-full max-w-md mx-auto px-4 mt-10 text-center text-slate-400 font-zh text-sm">
        {t('common.loading')}
      </main>
    )
  }

  if (!months || months.length === 0) {
    return (
      <main className="w-full max-w-md mx-auto px-4 mt-6 animate-in slide-in-from-right-4 duration-300">
        <PaperPiece color="white" rotate="-1deg" className="p-8 text-center">
          <Wallet size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="font-zh text-sm text-slate-500">{t('payslip.empty')}</p>
        </PaperPiece>
      </main>
    )
  }

  const p = slip?.payslip
  return (
    <main className="w-full max-w-md mx-auto px-4 mt-4 pb-10 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-black text-slate-700 flex items-center gap-2">
          <Wallet size={22} className="text-emerald-500" /> {t('nav.payslipTitle')}
        </h2>
        <select
          value={month}
          onChange={(e) => setPicked(e.target.value)}
          aria-label={t('common.selectMonth')}
          className="bg-white px-3 py-1.5 border border-slate-200 text-sm font-black text-slate-600 focus:outline-none"
        >
          {months.map((m) => (
            <option key={m.month} value={m.month}>{monthLabel(m.month, lang)}</option>
          ))}
        </select>
      </div>

      {slipLoading || !p ? (
        <p className="text-center text-slate-400 font-zh text-sm mt-10">{t('common.loading')}</p>
      ) : (
        <PaperPiece color="white" rotate="-0.6deg" className="p-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
            {t('payslip.headerEn', { month: monthLabel(slip.month, lang) })}
          </p>

          <p className="font-zh text-xs text-emerald-600 font-black mb-1">{t('payslip.earnings')}</p>
          {p.meta?.payType === 'hourly' ? (
            <Row label={t('payslip.hourlyLine', { rate: p.earnings.hourlyRate, duration: fmtMin(p.earnings.regularMinutes) })} value={p.earnings.regularPay} />
          ) : (
            <>
              <Row label={t('payslip.baseSalary')} value={p.earnings.baseSalary} />
              {(p.earnings.allowances ?? []).map((a, i) => (
                <Row key={i} label={t('payslip.allowance', { name: a.name })} value={a.amount} />
              ))}
            </>
          )}
          {(p.earnings.overtime?.tiers ?? []).map((tier, i) => (
            <Row key={i} label={t('payslip.overtimeTier', { rate: tier.rate, minutes: tier.minutes })} value={tier.amount} />
          ))}
          <div className="border-t border-dashed border-slate-200 mt-1">
            <Row label={t('payslip.grossPay')} value={p.earnings.grossPay} strong />
          </div>

          <p className="font-zh text-xs text-red-500 font-black mb-1 mt-4">{t('payslip.deductions')}</p>
          <Row label={t('payslip.laborInsurance')} value={-p.deductions.laborInsurance} />
          <Row label={t('payslip.healthInsurance')} value={-p.deductions.healthInsurance} />
          <Row label={t('payslip.pensionVoluntary')} value={-p.deductions.pensionVoluntary} />
          <Row label={t('payslip.incomeTax')} value={-p.deductions.incomeTax} />
          {p.deductions.attendanceDeduction > 0 && (
            <Row label={t('payslip.attendanceDeduction')} value={-p.deductions.attendanceDeduction} />
          )}
          {p.deductions.leaveDeduction > 0 && (
            <Row label={t('payslip.leaveDeduction')} value={-p.deductions.leaveDeduction} />
          )}
          <div className="border-t border-dashed border-slate-200 mt-1">
            <Row label={t('payslip.deductionsTotal')} value={-p.deductions.total} strong />
          </div>

          {(slip.adjustments ?? []).length > 0 && (
            <>
              <p className="font-zh text-xs text-sky-600 font-black mb-1 mt-4">{t('payslip.adjustments')}</p>
              {slip.adjustments.map((a, i) => (
                <Row key={i} label={a.label} value={a.amount} />
              ))}
              <div className="border-t border-dashed border-slate-200 mt-1">
                <Row label={t('payslip.adjustmentsTotal')} value={slip.adjustmentsTotal} strong />
              </div>
            </>
          )}

          <div className="border-t-2 border-slate-200 mt-5 pt-3 flex items-center justify-between">
            <span className="font-zh text-sm font-black text-slate-700">{t('payslip.netPay')}</span>
            <span className="font-mono tabular-nums text-2xl font-black text-emerald-600">
              {money(slip.netPay, lang)}
            </span>
          </div>

          {slip.lockedAt && (
            <p className="text-[10px] text-slate-300 font-mono mt-4 text-right">
              {t('payslip.issuedAt', { date: new Date(slip.lockedAt).toLocaleDateString(lang) })}
            </p>
          )}
        </PaperPiece>
      )}
    </main>
  )
}
