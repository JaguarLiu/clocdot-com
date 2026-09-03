// 加班合規狀態徽記 — 虛線框小標籤，呼應 DESIGN.md §3.8 印章風。
// 不是審核蓋章，故不用 StatusStamp（§3.9 規定 StatusStamp 僅限審核結果）。
// status: 'ok' | 'warn' | 'exceed' | undefined
//   exceed → 紅「超標」、warn → 琥珀「接近上限」、ok/缺值 → 不顯示（回 null）
// size: 'sm' (預設) | 'md'

import { useTranslation } from 'react-i18next'

const STYLES = {
  exceed: { key: 'exceed', cls: 'text-red-600 border-red-300 bg-red-50/70',     rotate: '-0.8deg' },
  warn:   { key: 'warn',   cls: 'text-amber-600 border-amber-300 bg-amber-50/70', rotate: '0.6deg' },
}

const SIZE = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-1 gap-1.5',
}

export default function ComplianceBadge({ status, size = 'sm' }) {
  const { t } = useTranslation()
  const s = STYLES[status]
  if (!s) return null
  const label = t(`compliance.${s.key}`)
  const code = t(`compliance.${s.key}Code`)
  return (
    <span
      className={`inline-flex items-center border border-dashed font-black select-none ${SIZE[size] || SIZE.sm} ${s.cls}`}
      style={{ transform: `rotate(${s.rotate})`, borderRadius: '4px 1px 5px 2px/2px 5px 1px 4px' }}
      aria-label={t('compliance.aria', { status: label })}
    >
      <span className="font-zh leading-none">{label}</span>
      {code && <span className="uppercase tracking-[0.15em] leading-none opacity-70">{code}</span>}
    </span>
  )
}
