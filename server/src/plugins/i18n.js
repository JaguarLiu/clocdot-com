import fp from 'fastify-plugin'
import { translateMessage, pickLanguage, DEFAULT_LANG } from '../i18n/messages.js'

// 只翻譯「給人看的訊息欄位」。像 correction 的 reason（持久化格式）
// 或員工姓名等資料欄位一律不碰。
const MESSAGE_FIELDS = new Set(['error', 'message', 'detail'])

// 巢狀走訪的深度上限 —— 避免異常深的 payload 造成無謂遞迴
const MAX_DEPTH = 6

function translateNode(node, lang, depth) {
  if (depth > MAX_DEPTH || node === null || typeof node !== 'object') return node

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) translateNode(node[i], lang, depth + 1)
    return node
  }

  for (const key of Object.keys(node)) {
    const value = node[key]
    if (MESSAGE_FIELDS.has(key) && typeof value === 'string') {
      const translated = translateMessage(value, lang)
      if (translated) node[key] = translated
    } else if (value && typeof value === 'object') {
      translateNode(value, lang, depth + 1)
    }
  }
  return node
}

/**
 * 依 Accept-Language 翻譯回應中的訊息欄位。
 *
 * 為什麼用 onSend 而不是把 route 改成回 error code：
 * route/service 目前把中文訊息直接放進 `{ error: '...' }`，前端也直接顯示。
 * 改成 code + params 要動到每一條 route 與前端每個錯誤顯示點，契約全變。
 * 在出口統一翻譯可讓契約與呼叫端都不動，且查不到對應時自動落回中文。
 */
async function i18nPlugin(fastify) {
  fastify.decorateRequest('lang', DEFAULT_LANG)

  fastify.addHook('onRequest', async (request) => {
    request.lang = pickLanguage(request.headers['accept-language'])
  })

  fastify.addHook('onSend', async (request, reply, payload) => {
    const lang = request.lang || DEFAULT_LANG
    if (lang === DEFAULT_LANG) return payload
    if (typeof payload !== 'string' || payload.length === 0) return payload

    const contentType = reply.getHeader('content-type')
    if (!contentType || !String(contentType).includes('application/json')) return payload

    let parsed
    try {
      parsed = JSON.parse(payload)
    } catch {
      return payload
    }
    if (parsed === null || typeof parsed !== 'object') return payload

    const before = payload
    const after = JSON.stringify(translateNode(parsed, lang, 0))
    if (after === before) return payload

    // 內容長度變了，必須同步更新 header，否則 client 會讀到截斷的 body
    reply.header('content-length', Buffer.byteLength(after))
    return after
  })
}

export default fp(i18nPlugin, { name: 'i18n' })
