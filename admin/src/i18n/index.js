import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import zhTW from './locales/zh-TW.json' with { type: 'json' }
import en from './locales/en.json' with { type: 'json' }

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-TW', label: '繁體中文', short: '中' },
  { code: 'en', label: 'English', short: 'EN' },
]

export const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code)

export const STORAGE_KEY = 'clocdot_admin_lang'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-TW': { translation: zhTW },
      en: { translation: en },
    },
    fallbackLng: 'zh-TW',
    supportedLngs: SUPPORTED_CODES,
    // zh-HK / zh-Hant 等變體收斂到 zh-TW，en-US / en-GB 收斂到 en
    // 注意：這裡不可加 nonExplicitSupportedLngs —— 它與 supportedLngs 併用時
    // 會讓 t() 回傳 key 本身（resolvedLanguage 與 bundle 都正常，只有查詢壞掉）。
    // 變體收斂靠 supportedLngs + load:'currentOnly' 就已足夠。
    load: 'currentOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      // React 已經做過 XSS escaping
      escapeValue: false,
    },
    returnEmptyString: true,
  })

/**
 * html lang 屬性跟著語言走 —— 影響瀏覽器斷行、字型 fallback 與螢幕閱讀器發音。
 */
function syncDocumentLang(lng) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng || 'zh-TW'
  }
}

syncDocumentLang(i18n.resolvedLanguage)
i18n.on('languageChanged', syncDocumentLang)

export default i18n
