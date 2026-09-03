import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/**
 * MarkerButton — hand-drawn marker / Sharpie sketch button.
 *
 * Layered render (back→front):
 *   1. Outer rough colored marker outline (slightly larger, irregular)
 *   2. Diagonal hatched fill (parallel marker strokes, clipped to inner rect)
 *   3. Inner thick dark sketchy double-stroke rectangle
 *   4. Crisp text + icons on top
 *
 * Usage:
 *   <MarkerButton color="#f97316" rotate="-1.2deg" fontSize={18} onClick={...}>
 *     <SendIcon /> 提交申請
 *   </MarkerButton>
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// Inject the wobble filter once per page.
let __wobbleInjected = false;
function ensureWobbleFilter() {
  if (__wobbleInjected || typeof document === 'undefined') return;
  __wobbleInjected = true;
  const svg = svgEl('svg', { width: '0', height: '0', 'aria-hidden': 'true' });
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  const defs = svgEl('defs', {});
  const filter = svgEl('filter', { id: 'marker-wobble', x: '-5%', y: '-12%', width: '110%', height: '124%' });
  filter.appendChild(svgEl('feTurbulence', {
    type: 'fractalNoise', baseFrequency: '0.02 0.04', numOctaves: '2', seed: '5', result: 'noise',
  }));
  filter.appendChild(svgEl('feDisplacementMap', {
    in: 'SourceGraphic', in2: 'noise', scale: '2.5', xChannelSelector: 'R', yChannelSelector: 'G',
  }));
  defs.appendChild(filter);
  svg.appendChild(defs);
  document.body.appendChild(svg);
}

// Inject hover / active interaction styles once per page.
let __interactionInjected = false;
function ensureInteractionStyles() {
  if (__interactionInjected || typeof document === 'undefined') return;
  __interactionInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .marker-btn {
      transform: rotate(var(--mb-rot, 0deg));
      transition: transform 160ms cubic-bezier(.2,.8,.2,1), filter 160ms ease-out;
      will-change: transform;
    }
    .marker-btn:not(.is-disabled):hover {
      transform: rotate(var(--mb-rot, 0deg)) translateY(-2px) scale(1.03);
      filter: brightness(1.06) drop-shadow(0 4px 6px rgba(0,0,0,0.12));
    }
    .marker-btn:not(.is-disabled):active {
      transform: rotate(var(--mb-rot, 0deg)) translateY(1px) scale(0.96);
      filter: brightness(0.94);
      transition-duration: 80ms;
    }
  `;
  document.head.appendChild(style);
}

export default function MarkerButton({
  children,
  color = '#f97316',
  ink = '#1a1a1a',
  textColor,
  rotate = '-1deg',
  fontSize = 16,
  onClick,
  disabled = false,
  type = 'button',
  className,
  style = {},
  contentStyle = {},
  as: Tag = 'button',
}) {
  useEffect(() => {
    ensureWobbleFilter();
    ensureInteractionStyles();
  }, []);

  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 200, h: 56 });

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const measure = () => {
      const r = wrapRef.current.getBoundingClientRect();
      if (r.width > 0) setSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Unique IDs so multiple instances don't collide
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const hatchId = `hatch_${uid}`;
  const clipId = `clip_${uid}`;

  const W = size.w;
  const H = size.h;
  const inner = (v) => Math.max(0, v);
  const finalTextColor = textColor || '#ffffff';

  return (
    <div
      ref={wrapRef}
      className={`marker-btn${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
      style={{
        '--mb-rot': rotate,
        position: 'relative',
        display: 'inline-flex',
        padding: '10px 14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      {/* SVG layer — sized to wrapper, sits behind content */}
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
        <defs>
          {/* Diagonal hatch pattern — parallel marker strokes */}
          <pattern
            id={hatchId}
            patternUnits="userSpaceOnUse"
            width="5"
            height="5"
            patternTransform="rotate(-22)"
          >
            <line
              x1="0"
              y1="-1"
              x2="0"
              y2="10"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.92"
            />
          </pattern>

          {/* Clip the hatch fill to the inner rectangle */}
          <clipPath id={clipId}>
            <rect x="9" y="9" width={inner(W - 18)} height={inner(H - 18)} rx="6" />
          </clipPath>
        </defs>

        {/* 1) Outer rough colored marker outline */}
        <g filter="url(#marker-wobble)">
          <rect
            x="2"
            y="2"
            width={inner(W - 4)}
            height={inner(H - 4)}
            rx="8"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinejoin="round"
            opacity="0.9"
          />
        </g>

        {/* 2) Hatched fill (clipped to inner area) */}
        <g clipPath={`url(#${clipId})`} filter="url(#marker-wobble)">
          <rect
            x="9"
            y="9"
            width={inner(W - 18)}
            height={inner(H - 18)}
            rx="6"
            fill={color}
            opacity="0.20"
          />
          <rect
            x="9"
            y="9"
            width={inner(W - 18)}
            height={inner(H - 18)}
            rx="6"
            fill={`url(#${hatchId})`}
          />
        </g>

        {/* 3) Inner thick dark sketchy double-stroke rectangle */}
        <g filter="url(#marker-wobble)">
          <rect
            x="9"
            y="9"
            width={inner(W - 18)}
            height={inner(H - 18)}
            rx="6"
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
            rx="5"
            fill="none"
            stroke={color}
            strokeWidth="1"
            strokeLinejoin="round"
            opacity="0.7"
          />
        </g>
      </svg>

      {/* 4) Crisp content layer — drives layout */}
      <Tag
        type={Tag === 'button' ? type : undefined}
        onClick={disabled ? undefined : onClick}
        disabled={Tag === 'button' ? disabled : undefined}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '14px 24px',
          minHeight: 24,
          width: '100%',
          color: finalTextColor,
          WebkitTextStroke: `1px ${ink}`,
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
  );
}
