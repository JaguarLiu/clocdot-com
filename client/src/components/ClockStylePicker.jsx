import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CLOCK_STYLES } from './clocks/index.js'
import { useClockStyle } from '../hooks/useClockStyle.js'

const TILE_RADIUS = ['12px 4px 14px 5px/5px 14px 4px 12px', '5px 14px 4px 12px/12px 4px 14px 5px']

/** 打卡鐘樣式選擇 — 每個樣式一張可按的小圖卡，選中的加藍框與勾勾。 */
export default function ClockStylePicker() {
  const { t } = useTranslation()
  const [current, setClockStyle] = useClockStyle()

  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label={t('clockStyle.title')}>
      {CLOCK_STYLES.map((style, i) => {
        const active = style.id === current.id
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => setClockStyle(style.id)}
            aria-pressed={active}
            className={`relative flex flex-col items-center gap-2 p-2 pb-2.5 border-2 transition-colors active:scale-95
              ${active ? 'border-sky-400 bg-sky-50' : 'border-dashed border-slate-200 bg-white hover:border-slate-300'}`}
            style={{ borderRadius: TILE_RADIUS[i % 2], transform: `rotate(${i % 2 ? '1deg' : '-1deg'})` }}
          >
            {active && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white" aria-hidden="true">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <span className="flex h-24 w-full items-center justify-center" aria-hidden="true">
              <img src={style.preview} alt="" draggable={false} className="h-full w-auto object-contain" />
            </span>
            <span className={`font-zh font-bold text-xs ${active ? 'text-sky-700' : 'text-slate-600'}`}>{t(style.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
