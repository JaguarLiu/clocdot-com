const SVG_NS = 'http://www.w3.org/2000/svg'
let filtersMounted = false

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

function buildFilter({ id, baseFrequency, numOctaves, seed, scale }) {
  const filter = el('filter', { id, x: '-10%', y: '-10%', width: '120%', height: '120%' })
  filter.appendChild(el('feTurbulence', {
    type: 'fractalNoise',
    baseFrequency,
    numOctaves: String(numOctaves),
    seed: String(seed),
    result: 'noise',
  }))
  filter.appendChild(el('feDisplacementMap', {
    in: 'SourceGraphic',
    in2: 'noise',
    scale: String(scale),
    xChannelSelector: 'R',
    yChannelSelector: 'G',
  }))
  return filter
}

function ensureTornEdgeFilters() {
  if (filtersMounted || typeof document === 'undefined') return
  filtersMounted = true

  const svg = el('svg', { width: '0', height: '0', 'aria-hidden': 'true' })
  svg.style.position = 'absolute'
  svg.style.width = '0'
  svg.style.height = '0'
  svg.style.overflow = 'hidden'

  const defs = el('defs', {})
  defs.appendChild(buildFilter({ id: 'torn-edge',      baseFrequency: '0.02 0.04', numOctaves: 4, seed: 7, scale: 22 }))
  defs.appendChild(buildFilter({ id: 'torn-edge-soft', baseFrequency: '0.03 0.05', numOctaves: 3, seed: 3, scale: 14 }))
  svg.appendChild(defs)

  document.body.appendChild(svg)
}

if (typeof window !== 'undefined') {
  ensureTornEdgeFilters()
}

export default function PaperPiece({
  children,
  color = '#ffffff',
  className = '',
  rotate = '0deg',
  variant = 'card',
  soft,
}) {
  ensureTornEdgeFilters()

  // 對應原 admin variant：
  //   - scrap → 強撕邊 (torn-edge)，標題 / Login / 強調卡
  //   - card  → 輕撕邊 (torn-edge-soft)，資料卡 / 表格容器
  // 也接受 soft prop 以與 client 保持一致；soft 顯式指定時優先
  const useSoft = typeof soft === 'boolean' ? soft : variant !== 'scrap'
  const filterId = useSoft ? 'torn-edge-soft' : 'torn-edge'

  return (
    <div
      style={{
        display: 'grid',
        transform: `rotate(${rotate})`,
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.08)) drop-shadow(0 8px 16px rgba(0,0,0,0.05))',
        boxShadow: 'inset 0 0 24px rgba(120,100,70,0.04), inset 0 0 2px rgba(0,0,0,0.03)',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none"
        style={{
          gridArea: '1 / 1',
          backgroundColor: color,
          borderRadius: '14px 22px 16px 20px',
          filter: `url(#${filterId})`,
        }}
      />
      <div className={className} style={{ gridArea: '1 / 1', position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}
