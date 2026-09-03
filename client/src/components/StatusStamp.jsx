import { Check, X, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// 圓形印章 — 雙環邊 + 微傾，蓋在卡片尾端
// client 版尺寸偏小，行動端不擠版
//
// status: 'approved' | 'rejected' | 'pending'
// size:   'sm' (預設, 48px) | 'xs' (40px)
//
// 文案走 i18n：status.<key> 是主標籤，status.<key>Code 是裝飾性英文小字
// （英文語系下 Code 解析為空字串，避免與主標籤重複 — 見 DESIGN.md）

const STAMP_STYLES = {
  approved: {
    key: 'approved',
    classes: 'text-emerald-600 border-emerald-500 outline-emerald-500 bg-emerald-50/70',
    rotate: '-8deg',
    Icon: Check,
  },
  rejected: {
    key: 'rejected',
    classes: 'text-red-500 border-red-500 outline-red-500 bg-red-50/70',
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
  sm: { box: 'w-[70px] h-[70px]', en: 'text-[7px]', zh: 'text-xs', icon: 11, offset: '-5px' },
  xs: { box: 'w-10 h-10', en: 'hidden', zh: 'text-[10px]', icon: 8, offset: '-3px' },
}

export default function StatusStamp({ status = 'pending', size = 'sm' }) {
  const { t } = useTranslation()
  const style = STAMP_STYLES[status] || STAMP_STYLES.pending
  const dims = SIZE[size] || SIZE.sm
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
      {dims.en !== 'hidden' && code && (
        <span className={`uppercase tracking-[0.15em] leading-none mt-0.5 opacity-70 ${dims.en}`}>
          {code}
        </span>
      )}
    </span>
  )
}
