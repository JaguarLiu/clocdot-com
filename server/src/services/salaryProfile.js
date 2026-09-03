/**
 * 驗證並正規化薪資主檔輸入。純函式，不碰 DB。
 * @param {Object} input 來自 API body
 * @param {{payType?: 'monthly'|'hourly'}} [options] payType 由呼叫端依 user.employmentType 決定
 * @returns {{ok: true, value: Object} | {ok: false, error: string}}
 */
export function normalizeSalaryProfile(input, { payType = 'monthly' } = {}) {
  const src = input ?? {}
  const hourly = payType === 'hourly'

  if (hourly) {
    // hourlyRate：必填正整數（0 無意義）
    if (!Number.isInteger(src.hourlyRate) || src.hourlyRate <= 0) {
      return { ok: false, error: '時薪必須為正整數' }
    }
  } else if (!Number.isInteger(src.baseSalary) || src.baseSalary < 0) {
    return { ok: false, error: '本薪必須為非負整數' }
  }

  // 選填非負整數（含 null）
  const optInt = (v, label) => {
    if (v === undefined || v === null) return { ok: true, value: null }
    if (!Number.isInteger(v) || v < 0) return { ok: false, error: `${label}必須為非負整數` }
    return { ok: true, value: v }
  }

  const labor = optInt(src.laborInsuredSalary, '勞保投保薪資')
  if (!labor.ok) return labor
  const health = optInt(src.healthInsuredSalary, '健保投保薪資')
  if (!health.ok) return health

  // 計數欄位：非負整數，預設 0
  const countInt = (v, label) => {
    if (v === undefined || v === null) return { ok: true, value: 0 }
    if (!Number.isInteger(v) || v < 0) return { ok: false, error: `${label}必須為非負整數` }
    return { ok: true, value: v }
  }
  const healthDependents = countInt(src.healthDependents, '健保眷口數')
  if (!healthDependents.ok) return healthDependents
  const taxDependents = countInt(src.taxDependents, '扶養人數')
  if (!taxDependents.ok) return taxDependents

  // pensionVoluntaryRate：0~0.06，預設 0
  let rate = 0
  if (src.pensionVoluntaryRate !== undefined && src.pensionVoluntaryRate !== null) {
    rate = Number(src.pensionVoluntaryRate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 0.06) {
      return { ok: false, error: '勞退自願提繳率必須介於 0 至 0.06' }
    }
  }

  // allowances：陣列，每項 {name, amount, insured, taxable}；hourly 強制空
  const rawAllowances = hourly ? [] : (src.allowances ?? [])
  if (!Array.isArray(rawAllowances)) {
    return { ok: false, error: 'allowances 必須為陣列' }
  }
  const allowances = []
  for (const a of rawAllowances) {
    const name = typeof a?.name === 'string' ? a.name.trim() : ''
    if (!name) return { ok: false, error: '加給名稱不可為空' }
    if (!Number.isInteger(a?.amount) || a.amount < 0) {
      return { ok: false, error: `加給「${name}」金額必須為非負整數` }
    }
    allowances.push({
      name,
      amount: a.amount,
      insured: Boolean(a.insured),
      taxable: Boolean(a.taxable),
    })
  }

  const cleanStr = (v) => {
    if (typeof v !== 'string') return null
    const t = v.trim()
    return t === '' ? null : t
  }

  return {
    ok: true,
    value: {
      baseSalary: hourly ? null : src.baseSalary,
      hourlyRate: hourly ? src.hourlyRate : null,
      allowances,
      laborInsuredSalary: labor.value,
      healthInsuredSalary: health.value,
      healthDependents: healthDependents.value,
      pensionVoluntaryRate: rate,
      taxDependents: taxDependents.value,
      bankAccount: cleanStr(src.bankAccount),
      note: cleanStr(src.note),
    },
  }
}
