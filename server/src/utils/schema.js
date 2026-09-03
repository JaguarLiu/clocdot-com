// Fastify JSON schema 小工具（P2-6）。
//
// 目的：擋「頂層型別混淆」——把物件/陣列塞進預期為字串的欄位，避免流入 Prisma where 造成錯誤。
// 原則：additionalProperties 預設「寬鬆」（只驗列出的欄位、不擋多餘欄位），
//       各 route handler 既有的細部驗證（格式、範圍、業務規則）保留不動，schema 只做型別把關。

export const str = { type: 'string' }
export const strOrNull = { type: ['string', 'null'] }
export const bool = { type: 'boolean' }
export const int = { type: 'integer' }
export const num = { type: 'number' }
export const anyObject = { type: 'object' }
export const anyArray = { type: 'array' }

/**
 * 產生 body 物件 schema。
 * @param {Record<string, object>} properties 欄位型別
 * @param {object} [opts]
 * @param {string[]} [opts.required] 必填欄位（僅列 handler 本來就強制的，避免改變行為）
 * @param {boolean} [opts.additionalProperties] 預設 true（寬鬆）
 */
export function body(properties, { required = [], additionalProperties = true } = {}) {
  return { type: 'object', properties, required, additionalProperties }
}

/** 陣列 body（頂層是陣列的少見情況） */
export function arrayBody(items) {
  return { type: 'array', items: items ?? anyObject }
}
