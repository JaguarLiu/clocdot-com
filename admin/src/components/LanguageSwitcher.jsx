import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n/index.js'

/**
 * 語言切換 — 檔案夾 tab 風格的小分頁。
 * admin 的旋轉手感較克制（±1deg，見 DESIGN.md），故不加傾斜。
 */
export default function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage

  return (
    <div
      className={`inline-flex items-center gap-0.5 bg-white/70 border border-slate-200 p-0.5 ${className}`}
      role="group"
      aria-label={t('common.language')}
    >
      {SUPPORTED_LANGUAGES.map((lang) => {
        const active = current === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => i18n.changeLanguage(lang.code)}
            aria-pressed={active}
            title={lang.label}
            className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-widest transition-colors
              ${active ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            style={{ borderRadius: '6px 2px 8px 3px/3px 8px 2px 6px' }}
          >
            {lang.short}
          </button>
        )
      })}
    </div>
  )
}
