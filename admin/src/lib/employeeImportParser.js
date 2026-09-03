export const IMPORT_COLUMNS = ['email', 'name', 'empNo', 'role', 'hireDate', 'baseSalary', 'bankAccount']

export function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"' && quoted && text[i + 1] === '"') {
      value += '"'
      i += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(value)
      value = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(value)
      if (row.some((cell) => cell !== '')) rows.push(row)
      row = []
      value = ''
    } else {
      value += char
    }
  }
  row.push(value)
  if (row.some((cell) => cell !== '')) rows.push(row)
  return rows
}

export function normalizeRows(rows) {
  const [headers = [], ...dataRows] = rows
  return dataRows.map((values) => {
    const output = {}
    headers.forEach((key, index) => {
      const normalized = String(key).trim().toLowerCase()
      const match = IMPORT_COLUMNS.find((column) => column.toLowerCase() === normalized)
      if (match) output[match] = String(values[index] ?? '').trim()
    })
    return output
  })
}

export function parseEmployeeCsv(text) {
  return normalizeRows(parseCsv(text.replace(/^\uFEFF/, '')))
}
