import { getHolidays } from '../data/twHolidays/index.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// 國定假日查詢（供員工端 / 管理端行事曆標示）。任何登入者皆可讀，假日非敏感資料。
export default async function holidayRoutes(fastify) {
  // GET /api/holidays?from=YYYY-MM-DD&to=YYYY-MM-DD → [{ date, name }]
  fastify.get('/api/holidays', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { from, to } = request.query
    if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
      return reply.code(400).send({ error: 'from / to 需為 YYYY-MM-DD' })
    }
    const y0 = Number(from.slice(0, 4))
    const y1 = Number(to.slice(0, 4))
    const out = []
    for (let y = y0; y <= y1; y++) {
      for (const h of getHolidays(y)) {
        if (h.date >= from && h.date <= to) out.push(h)
      }
    }
    return out
  })
}
