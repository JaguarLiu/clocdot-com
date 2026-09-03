import { Check, X, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// 圓形印章 — 雙環邊 + 微傾，蓋在 row 尾端
// 與 DESIGN.md §7「狀態印章可升級為斜蓋」的方向一致
//
// status: 'approved' | 'rejected' | 'pending'
// size:   'md' (預設, 64px) | 'sm' (52px)

// 文案走 i18n：status.<key> 為主標籤，status.<key>Code 為裝飾性英文小字
// （英文語系下 Code 解析為空字串，見 DESIGN.md）
const STAMP_STYLES = {
  approved: {
    key: 'approved',
    classes: 'text-emerald-600 border-emerald-500 outline-emerald-500 bg-emerald-50/70',
    rotate: '-8deg',
    Icon: Check,
  },
  rejected: {
    key: 'rejected',
    classes: 'text-red-600 border-red-500 outline-red-500 bg-red-50/70',
    rotate: '6deg',
    Icon: X,
  },
  pending: {
    key: 'pending',
    classes: 'text-amber-600 border-amber-500 outline-amber-500 bg-amber-50/70',
    rotate: '-5deg',
    Icon: Clock,
  },
}

const SIZE = {
  md: { box: 'w-[76px] h-[76px]', en: 'text-[7px]', zh: 'text-xs', icon: 11, offset: '-6px' },
  sm: { box: 'w-[52px] h-[52px]', en: 'text-[6px]', zh: 'text-[11px]', icon: 9, offset: '-4px' },
}

export default function StatusStamp({ status = 'pending', size = 'md' }) {
  const { t } = useTranslation()
  const style = STAMP_STYLES[status] || STAMP_STYLES.pending
  const dims = SIZE[size] || SIZE.md
  const Icon = style.Icon
  const label = t(`status.${style.key}`)
  const code = t(`status.${style.key}Code`)

  return (
    <span
      className={`inline-flex flex-col items-center justify-center rounded-full border-2 outline outline-2 font-black select-none ${dims.box} ${style.classes}`}
      style={{
        transform: `rotate(${style.rotate})`,
        outlineOffset: dims.offset,
      }}
      aria-label={label}
    >
      <Icon size={dims.icon} strokeWidth={3} aria-hidden="true" />
      <span className={`font-zh leading-none mt-0.5 ${dims.zh}`}>{label}</span>
      {code && (
        <span className={`uppercase tracking-[0.18em] leading-none mt-0.5 opacity-70 ${dims.en}`}>
          {code}
        </span>
      )}
    </span>
  )
}
