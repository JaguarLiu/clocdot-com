// Prisma 唯一鍵衝突 (P2002) 欄位解析 — 相容多種 meta 形狀。
// - 傳統 Prisma：err.meta.target = ['empNo'] 或字串 'users_empNo_key'
// - Prisma 7 + pg driver adapter：err.meta.driverAdapterError.cause.constraint.fields = ['"empNo"']（含引號）

/** 取出 P2002 涉及的欄位名陣列（去引號）。 */
export function p2002Fields(err) {
  const out = []
  const t = err?.meta?.target
  if (Array.isArray(t)) out.push(...t)
  else if (typeof t === 'string') out.push(t)
  const f = err?.meta?.driverAdapterError?.cause?.constraint?.fields
  if (Array.isArray(f)) out.push(...f)
  return out.map((s) => String(s).replace(/"/g, ''))
}

/** P2002 是否牽涉某欄位（涵蓋約束名包含該欄位的情況，如 users_empNo_key）。 */
export function p2002HasField(err, field) {
  return p2002Fields(err).some((f) => f === field || f.includes(field))
}
