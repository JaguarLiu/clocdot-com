import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Admin variant — solid color fill (no hatched stroke pattern).
// Layered render (back→front):
//   1. Outer rough colored marker outline
//   2. Solid color fill (slight wobble for hand-drawn edge)
//   3. Inner double-stroke rectangle
//   4. Crisp text + icons on top

const SVG_NS = 'http://www.w3.org/2000/svg'

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

let __wobbleInjected = false
function ensureWobbleFilter() {
  if (__wobbleInjected || typeof document === 'undefined') return
  if (document.getElementById('marker-wobble')) {
    __wobbleInjected = true
    return
  }
  __wobbleInjected = true
  const svg = svgEl('svg', { width: '0', height: '0', 'aria-hidden': 'true' })
  svg.style.position = 'absolute'
  svg.style.pointerEvents = 'none'
  const defs = svgEl('defs', {})
  const filter = svgEl('filter', { id: 'marker-wobble', x: '-5%', y: '-12%', width: '110%', height: '124%' })
  filter.appendChild(svgEl('feTurbulence', {
    type: 'fractalNoise', baseFrequency: '0.02 0.04', numOctaves: '2', seed: '5', result: 'noise',
  }))
  filter.appendChild(svgEl('feDisplacementMap', {
    in: 'SourceGraphic', in2: 'noise', scale: '2.5', xChannelSelector: 'R', yChannelSelector: 'G',
  }))
  defs.appendChild(filter)
  svg.appendChild(defs)
  document.body.appendChild(svg)
}

let __interactionInjected = false
function ensureInteractionStyles() {
  if (__interactionInjected || typeof document === 'undefined') return
  __interactionInjected = true
  const style = document.createElement('style')
  style.textContent = `
    .admin-marker-btn {
      transform: rotate(var(--mb-rot, 0deg));
      transition: transform 160ms cubic-bezier(.2,.8,.2,1), filter 160ms ease-out;
      will-change: transform;
    }
    .admin-marker-btn:not(.is-disabled):hover {
      transform: rotate(var(--mb-rot, 0deg)) translateY(-2px) scale(1.02);
      filter: brightness(1.05) drop-shadow(0 4px 6px rgba(0,0,0,0.12));
    }
    .admin-marker-btn:not(.is-disabled):active {
      transform: rotate(var(--mb-rot, 0deg)) translateY(1px) scale(0.97);
      filter: brightness(0.94);
      transition-duration: 80ms;
    }
  `
  document.head.appendChild(style)
}

export default function MarkerButton({
  children,
  color = '#10b981',
  ink = '#1a1a1a',
  textColor,
  rotate = '-0.6deg',
  fontSize = 14,
  onClick,
  disabled = false,
  type = 'button',
  className,
  style = {},
  contentStyle = {},
  as: Tag = 'button',
  title,
  ariaLabel,
}) {
  useEffect(() => {
    ensureWobbleFilter()
    ensureInteractionStyles()
  }, [])

  const wrapRef = useRef(null)
  const [size, setSize] = useState({ w: 160, h: 48 })

  useLayoutEffect(() => {
    if (!wrapRef.current) return
    const measure = () => {
      const r = wrapRef.current.getBoundingClientRect()
      if (r.width > 0) setSize({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const W = size.w
  const H = size.h
  const inner = (v) => Math.max(0, v)
  const finalTextColor = textColor || '#ffffff'

  return (
    <div
      ref={wrapRef}
      className={`admin-marker-btn${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
      style={{
        '--mb-rot': rotate,
        position: 'relative',
        display: 'inline-flex',
        padding: '8px 12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <svg
        aria-hidden="true"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        {/* 1) Outer rough colored marker outline */}
        <g filter="url(#marker-wobble)">
          <rect
            x="2"
            y="2"
            width={inner(W - 4)}
            height={inner(H - 4)}
            rx="7"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinejoin="round"
            opacity="0.9"
          />
        </g>

        {/* 2) Solid color fill */}
        <g filter="url(#marker-wobble)">
          <rect
            x="9"
            y="9"
            width={inner(W - 18)}
            height={inner(H - 18)}
            rx="5"
            fill={color}
          />
        </g>

        {/* 3) Inner double-stroke rectangle */}
        <g filter="url(#marker-wobble)">
          <rect
            x="9"
            y="9"
            width={inner(W - 18)}
            height={inner(H - 18)}
            rx="5"
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <rect
            x="12"
            y="12"
            width={inner(W - 24)}
            height={inner(H - 24)}
            rx="4"
            fill="none"
            stroke={color}
            strokeWidth="1"
            strokeLinejoin="round"
            opacity="0.55"
          />
        </g>
      </svg>

      <Tag
        type={Tag === 'button' ? type : undefined}
        onClick={disabled ? undefined : onClick}
        disabled={Tag === 'button' ? disabled : undefined}
        title={title}
        aria-label={ariaLabel || title}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 18px',
          minHeight: 20,
          width: '100%',
          color: finalTextColor,
          WebkitTextStroke: `0.8px ${ink}`,
          textShadow: `1px 0 0 ${ink}, -1px 0 0 ${ink}, 0 1px 0 ${ink}, 0 -1px 0 ${ink}`,
          paintOrder: 'stroke fill',
          fontSize,
          fontWeight: 900,
          letterSpacing: '0.04em',
          background: 'transparent',
          border: 'none',
          cursor: 'inherit',
          fontFamily: 'inherit',
          ...contentStyle,
        }}
      >
        {children}
      </Tag>
    </div>
  )
}
