// 員工批次匯入：驗證與正規化（純函式，不碰 DB）
// 重用 normalizeSalaryProfile 驗證薪資欄位。
import { normalizeSalaryProfile } from './salaryProfile.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const IMPORT_MAX_ROWS = 500

function cleanStr(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

// 回傳 { empty:true } | { value:int } | { error:true }
function parseIntCell(v) {
  if (v === undefined || v === null) return { empty: true }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { value: v } : { error: true }
  }
  const s = String(v).trim()
  if (s === '') return { empty: true }
  if (!/^\d+$/.test(s)) return { error: true }
  return { value: Number(s) }
}

/**
 * @param {Array<Object>} rows 已以正規欄位鍵 (email/name/empNo/hireDate/baseSalary/bankAccount) 整理的列
 * @param {{existingEmails?:Set<string>, existingEmpNos?:Set<number>}} ctx DB 既有值（全域唯一）
 * @returns {{valid:Array, errors:Array<{row,field,message}>, summary:{total,validCount,errorCount}}}
 */
export function validateImportRows(rows, ctx = {}) {
  const existingEmails = ctx.existingEmails ?? new Set()
  const existingEmpNos = ctx.existingEmpNos ?? new Set()
  const errors = []
  const valid = []
  const seenEmails = new Map()
  const seenEmpNos = new Map()

  rows.forEach((raw, idx) => {
    const row = idx + 1
    const rowErrors = []

    const emailRaw = cleanStr(raw?.email)
    const email = emailRaw ? emailRaw.toLowerCase() : null
    if (!email) {
      rowErrors.push({ row, field: 'email', message: 'email 為必填' })
    } else if (!EMAIL_RE.test(email)) {
      rowErrors.push({ row, field: 'email', message: 'email 格式錯誤' })
    } else {
      if (existingEmails.has(email)) rowErrors.push({ row, field: 'email', message: 'email 已被使用' })
      if (seenEmails.has(email)) rowErrors.push({ row, field: 'email', message: `email 與第 ${seenEmails.get(email)} 列重複` })
      else seenEmails.set(email, row)
    }

    const name = cleanStr(raw?.name)

    let empNo = null
    const empParsed = parseIntCell(raw?.empNo)
    if (empParsed.error) {
      rowErrors.push({ row, field: 'empNo', message: 'empNo 必須為整數' })
    } else if (!empParsed.empty) {
      empNo = empParsed.value
      if (existingEmpNos.has(empNo)) rowErrors.push({ row, field: 'empNo', message: '員工編號已被使用' })
      if (seenEmpNos.has(empNo)) rowErrors.push({ row, field: 'empNo', message: `員工編號與第 ${seenEmpNos.get(empNo)} 列重複` })
      else seenEmpNos.set(empNo, row)
    }

    let hireDate = null
    const rawDate = cleanStr(raw?.hireDate)
    if (rawDate) {
      if (!DATE_RE.test(rawDate) || Number.isNaN(new Date(rawDate).getTime())) {
        rowErrors.push({ row, field: 'hireDate', message: 'hireDate 須為 YYYY-MM-DD' })
      } else {
        hireDate = rawDate
      }
    }

    let salaryProfile = null
    const bankAccount = cleanStr(raw?.bankAccount)
    const baseParsed = parseIntCell(raw?.baseSalary)
    const wantsSalary = !baseParsed.empty || bankAccount !== null
    if (wantsSalary) {
      if (baseParsed.error) {
        rowErrors.push({ row, field: 'baseSalary', message: 'baseSalary 必須為非負整數' })
      } else if (baseParsed.empty) {
        rowErrors.push({ row, field: 'baseSalary', message: '有填薪資欄位時 baseSalary 為必填' })
      } else {
        const norm = normalizeSalaryProfile({ baseSalary: baseParsed.value, bankAccount })
        if (!norm.ok) rowErrors.push({ row, field: 'baseSalary', message: norm.error })
        else salaryProfile = norm.value
      }
    }

    if (rowErrors.length > 0) errors.push(...rowErrors)
    else valid.push({ email, name, empNo, hireDate, salaryProfile })
  })

  return {
    valid,
    errors,
    summary: { total: rows.length, validCount: valid.length, errorCount: rows.length - valid.length },
  }
}
