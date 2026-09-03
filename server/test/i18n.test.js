import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'

import i18nPlugin from '../src/plugins/i18n.js'
import { translateMessage, pickLanguage } from '../src/i18n/messages.js'

// ---------- pickLanguage ----------

test('pickLanguage: 無標頭或無法辨識時落回 zh-TW', () => {
  assert.equal(pickLanguage(undefined), 'zh-TW')
  assert.equal(pickLanguage(''), 'zh-TW')
  assert.equal(pickLanguage('*'), 'zh-TW')
  assert.equal(pickLanguage('fr-FR'), 'zh-TW')
})

test('pickLanguage: 收斂語言變體', () => {
  assert.equal(pickLanguage('en'), 'en')
  assert.equal(pickLanguage('en-US'), 'en')
  assert.equal(pickLanguage('en-GB,en;q=0.9'), 'en')
  assert.equal(pickLanguage('zh-TW'), 'zh-TW')
  assert.equal(pickLanguage('zh-HK'), 'zh-TW')
  assert.equal(pickLanguage('zh-Hant'), 'zh-TW')
})

test('pickLanguage: 依 q 值排序', () => {
  assert.equal(pickLanguage('fr;q=1.0, en;q=0.8'), 'en')
  assert.equal(pickLanguage('en;q=0.3, zh-TW;q=0.9'), 'zh-TW')
})

// ---------- translateMessage ----------

test('translateMessage: 完全相符', () => {
  assert.equal(translateMessage('找不到公司', 'en'), 'Company not found.')
  assert.equal(translateMessage('今日已打過上班卡', 'en'), 'You have already clocked in today.')
})

test('translateMessage: 查無對應時回 null，呼叫端保留原文', () => {
  assert.equal(translateMessage('這句沒有登錄在表裡', 'en'), null)
  assert.equal(translateMessage('找不到公司', 'zh-TW'), null)
  assert.equal(translateMessage('', 'en'), null)
  assert.equal(translateMessage(undefined, 'en'), null)
})

test('translateMessage: 插值訊息帶出數值', () => {
  assert.equal(
    translateMessage('密碼長度至少 8 碼', 'en'),
    'Password must be at least 8 characters.',
  )
  assert.equal(
    translateMessage('email 與第 3 列重複', 'en'),
    'Duplicate email — also on row 3.',
  )
  assert.equal(
    translateMessage('餘額不足：剩餘 12.5 小時，此筆需 16.0 小時', 'en'),
    'Insufficient balance: 12.5 h remaining, this request needs 16.0 h.',
  )
})

test('translateMessage: 排班法規違規訊息', () => {
  assert.equal(
    translateMessage('王小明：2026-07-01～2026-07-08 連續上班 8 天，違反七休一（連續工作不得超過 6 天）', 'en'),
    '王小明: worked 8 consecutive days from 2026-07-01 to 2026-07-08, breaching the "one rest day every seven days" rule (Employees cannot work for seven consecutive days without a day off).',
  )
  assert.equal(
    translateMessage('王小明：2026-07-01 下班到 2026-07-02 上班僅間隔 9.5 小時，不足輪班間隔 11 小時', 'en'),
    '王小明: only 9.5 h between clocking out on 2026-07-01 and clocking in on 2026-07-02, short of the required 11 h rest between shifts.',
  )
})

test('translateMessage: 巢狀翻譯（鎖定訊息內含另一則訊息）', () => {
  assert.equal(
    translateMessage('帳號不存在，剩餘嘗試次數 3', 'en'),
    'Account not found. 3 attempt(s) remaining.',
  )
})

// ---------- onSend hook ----------

async function buildApp(routes) {
  const app = Fastify()
  await app.register(i18nPlugin)
  routes(app)
  return app
}

test('onSend: en 時翻譯頂層 error', async () => {
  const app = await buildApp((a) => {
    a.get('/boom', async (req, reply) => reply.code(404).send({ error: '找不到公司' }))
  })
  const res = await app.inject({ method: 'GET', url: '/boom', headers: { 'accept-language': 'en' } })
  assert.equal(res.statusCode, 404)
  assert.deepEqual(res.json(), { error: 'Company not found.' })
  // content-length 必須與翻譯後的 body 一致，否則 client 會讀到截斷內容
  assert.equal(Number(res.headers['content-length']), Buffer.byteLength(res.payload))
  await app.close()
})

test('onSend: zh-TW（預設）維持原文且不重新序列化', async () => {
  const app = await buildApp((a) => {
    a.get('/boom', async (req, reply) => reply.code(404).send({ error: '找不到公司' }))
  })
  for (const headers of [{}, { 'accept-language': 'zh-TW' }]) {
    const res = await app.inject({ method: 'GET', url: '/boom', headers })
    assert.deepEqual(res.json(), { error: '找不到公司' })
  }
  await app.close()
})

test('onSend: 翻譯陣列中的 message（例如排班違規、匯入逐列錯誤）', async () => {
  const app = await buildApp((a) => {
    a.put('/schedule', async (req, reply) => reply.code(409).send({
      error: 'schedule_compliance_warning',
      violations: [
        { type: 'weekly_rest', message: '王小明：2026-07-01～2026-07-08 連續上班 8 天，違反七休一（連續工作不得超過 6 天）' },
      ],
    }))
  })
  const res = await app.inject({ method: 'PUT', url: '/schedule', headers: { 'accept-language': 'en' } })
  const body = res.json()
  // error 是 code 而非中文，查無對應 → 原樣保留，前端仍能比對
  assert.equal(body.error, 'schedule_compliance_warning')
  assert.match(body.violations[0].message, /^王小明: worked 8 consecutive days/)
  await app.close()
})

test('onSend: 未登錄的訊息原樣落回中文', async () => {
  const app = await buildApp((a) => {
    a.get('/x', async (req, reply) => reply.code(400).send({ error: '一句還沒登錄的訊息' }))
  })
  const res = await app.inject({ method: 'GET', url: '/x', headers: { 'accept-language': 'en' } })
  assert.deepEqual(res.json(), { error: '一句還沒登錄的訊息' })
  await app.close()
})

test('onSend: 不碰資料欄位 —— 補卡 reason 的持久化格式必須原封不動', async () => {
  const app = await buildApp((a) => {
    a.get('/corrections', async () => ([
      { id: 1, reason: '[上班] 09:00 - 忘記打卡', status: 'pending' },
    ]))
  })
  const res = await app.inject({ method: 'GET', url: '/corrections', headers: { 'accept-language': 'en' } })
  assert.equal(res.json()[0].reason, '[上班] 09:00 - 忘記打卡')
  await app.close()
})

test('onSend: 非 JSON 回應不處理', async () => {
  const app = await buildApp((a) => {
    a.get('/csv', async (req, reply) => {
      reply.header('content-type', 'text/csv; charset=utf-8')
      return '員工,工時\n王小明,160\n'
    })
  })
  const res = await app.inject({ method: 'GET', url: '/csv', headers: { 'accept-language': 'en' } })
  assert.equal(res.payload, '員工,工時\n王小明,160\n')
  await app.close()
})
