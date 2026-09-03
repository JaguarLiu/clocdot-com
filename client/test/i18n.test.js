import { test } from 'node:test'
import assert from 'node:assert/strict'
import i18next from 'i18next'
import { readFileSync } from 'node:fs'

const zhTW = JSON.parse(readFileSync(new URL('../src/i18n/locales/zh-TW.json', import.meta.url), 'utf-8'))
const en = JSON.parse(readFileSync(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf-8'))

// 與 src/i18n/index.js 保持一致（LanguageDetector 需要瀏覽器環境，這裡用 lng 直接指定）
const BASE_OPTIONS = {
  resources: { 'zh-TW': { translation: zhTW }, en: { translation: en } },
  fallbackLng: 'zh-TW',
  supportedLngs: ['zh-TW', 'en'],
  load: 'currentOnly',
  interpolation: { escapeValue: false },
  returnEmptyString: true,
}

async function makeInstance(lng) {
  const inst = i18next.createInstance()
  await inst.init({ ...BASE_OPTIONS, lng })
  return inst
}

test('瀏覽器語言變體收斂到我們支援的語系', async () => {
  for (const lng of ['zh-TW', 'zh-HK', 'zh-Hant-TW', 'zh']) {
    const inst = await makeInstance(lng)
    assert.equal(inst.resolvedLanguage, 'zh-TW', `${lng} 應收斂為 zh-TW`)
  }
  for (const lng of ['en', 'en-US', 'en-GB']) {
    const inst = await makeInstance(lng)
    assert.equal(inst.resolvedLanguage, 'en', `${lng} 應收斂為 en`)
  }
})

test('不支援的語系落回 zh-TW', async () => {
  for (const lng of ['ja-JP', 'fr-FR', undefined]) {
    const inst = await makeInstance(lng)
    assert.equal(inst.resolvedLanguage, 'zh-TW')
    assert.equal(inst.t('login.signIn'), '登入')
  }
})

/**
 * 回歸測試：曾經因為多加了 `nonExplicitSupportedLngs: true`，
 * 造成 resolvedLanguage 與 resource bundle 都正確、但 t() 一律回傳 key 本身，
 * 整個介面顯示成 `login.signIn` 這種原始 key。此測試釘住「t() 必須真的翻譯」。
 */
test('t() 必須回傳譯文而非 key（zh 與 en 都要）', async () => {
  const zh = await makeInstance('zh-TW')
  assert.equal(zh.t('login.signIn'), '登入')
  assert.equal(zh.t('nav.punch'), '打卡')
  assert.notEqual(zh.t('login.signIn'), 'login.signIn')

  const eng = await makeInstance('en-US')
  assert.equal(eng.t('login.signIn'), 'Sign in')
  assert.equal(eng.t('nav.punch'), 'Punch')
  assert.notEqual(eng.t('login.signIn'), 'login.signIn')
})

test('插值正常運作', async () => {
  const zh = await makeInstance('zh-TW')
  assert.equal(zh.t('nav.greeting', { name: 'Rex' }), 'Rex，你好！')
  const eng = await makeInstance('en')
  assert.equal(eng.t('nav.greeting', { name: 'Rex' }), 'Hi, Rex!')
})

test('裝飾性英文標籤：zh 有值、en 為空字串（避免重複顯示）', async () => {
  const zh = await makeInstance('zh-TW')
  assert.equal(zh.t('status.approvedCode'), 'APPROVED')
  const eng = await makeInstance('en')
  assert.equal(eng.t('status.approvedCode'), '')
})

test('zh-TW 與 en 的 key 完全對稱', () => {
  const flat = (obj, prefix = '') => Object.entries(obj).reduce((acc, [k, v]) => {
    const key = `${prefix}${k}`
    return v && typeof v === 'object' ? { ...acc, ...flat(v, `${key}.`) } : { ...acc, [key]: v }
  }, {})
  const zhKeys = Object.keys(flat(zhTW)).sort()
  const enKeys = Object.keys(flat(en)).sort()
  assert.deepEqual(zhKeys, enKeys)
})
