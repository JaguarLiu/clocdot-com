import { useTranslation } from 'react-i18next'
import ClockStylePicker from '../components/ClockStylePicker.jsx'

/** 打卡鐘樣式 — 圖卡選擇切換，選中的那張即為目前使用的樣式（從 Profile 進來）。 */
export default function ClockStyle() {
  const { t } = useTranslation()

  return (
    <main className="w-full relative z-10 px-4 mt-4 pb-10 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
        <h3 className="font-zh font-bold text-slate-600 text-sm">{t('clockStyle.allStyles')}</h3>
        {t('clockStyle.allStylesEn') && (
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('clockStyle.allStylesEn')}</span>
        )}
      </div>
      <div className="px-1">
        <ClockStylePicker />
      </div>
    </main>
  )
}
