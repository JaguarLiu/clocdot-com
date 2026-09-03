import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n/index.js'

/**
 * 語言切換 — 紙膠帶風格的小分頁，貼在畫面角落。
 * 只有兩個語言，用並排小分頁比下拉選單更符合 paper-craft 調性（見 DESIGN.md）。
 */
export default function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage

  return (
    <div
      className={`inline-flex items-center gap-0.5 bg-white/60 border border-white/40 backdrop-blur-[1px] p-0.5 ${className}`}
      style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.04)' }}
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
