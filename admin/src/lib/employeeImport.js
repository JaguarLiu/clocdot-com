import ExcelJS from 'exceljs'
import i18n from '../i18n/index.js'
import { IMPORT_COLUMNS, normalizeRows, parseEmployeeCsv } from './employeeImportParser.js'

export { IMPORT_COLUMNS }

// 範例列的姓名隨語系走（其餘欄位是格式示範，不翻譯）
const sampleRow = () => ['wang@example.com', i18n.t('employees.importSampleName'), '1001', 'employee', '2026-01-01', '36000', '700-1234567']

// 解析 .csv / .xlsx → 正規欄位鍵的 row 陣列（值一律字串、已 trim）
export async function parseEmployeeFile(file) {
  const buf = await file.arrayBuffer()
  if (file.name?.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
    const text = new TextDecoder('utf-8').decode(buf)
    return parseEmployeeCsv(text)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buf)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []
  const rows = []
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = []
    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      values.push(row.getCell(column).text)
    }
    rows.push(values)
  })
  return normalizeRows(rows)
}

// 下載 .xlsx 範本（表頭 + 一列範例）
export async function downloadImportTemplate() {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(i18n.t('employees.importSheetName'))
  worksheet.addRows([IMPORT_COLUMNS, sampleRow()])
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = i18n.t('employees.importTemplateFile')
  anchor.click()
  URL.revokeObjectURL(url)
}

function csvCell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// 下載建立結果的密碼清單 CSV（UTF-8 BOM，Excel 友善）
export function downloadPasswordCSV(created) {
  const header = ['email', 'name', 'empNo', 'password']
  const lines = [header.join(',')]
  for (const u of created) {
    lines.push([u.email, u.name ?? '', u.empNo ?? '', u.password].map(csvCell).join(','))
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = i18n.t('employees.importPasswordsFile')
  a.click()
  URL.revokeObjectURL(url)
}
