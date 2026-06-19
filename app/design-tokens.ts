// Single source of truth lives in app/globals.css (:root).
// This module mirrors those CSS variables as var() strings so that
// inline-styled React components stay in sync with the stylesheet.
// Usage:  style={{ color: T.ink, background: T.bg1 }}

export const T = {
  // surfaces
  bg0: 'var(--bg-0)',
  bg1: 'var(--bg-1)',
  bg2: 'var(--bg-2)',
  bg3: 'var(--bg-3)',
  bgInput: 'var(--bg-input)',

  // borders
  line: 'var(--line)',
  line2: 'var(--line-2)',
  lineStrong: 'var(--line-strong)',

  // text
  ink: 'var(--ink)',
  ink2: 'var(--ink-2)',
  ink3: 'var(--ink-3)',
  ink4: 'var(--ink-4)',

  // primary accent
  accent: 'var(--accent)',
  accentStrong: 'var(--accent-strong)',
  accentInk: 'var(--accent-ink)',
  accentSoft: 'var(--accent-soft)',
  accentLine: 'var(--accent-line)',

  // secondary categorical
  violet: 'var(--violet)',
  violetSoft: 'var(--violet-soft)',
  violetLine: 'var(--violet-line)',

  // semantic
  ok: 'var(--ok)',
  okSoft: 'var(--ok-soft)',
  okLine: 'var(--ok-line)',
  warn: 'var(--warn)',
  warnSoft: 'var(--warn-soft)',
  warnLine: 'var(--warn-line)',
  danger: 'var(--danger)',
  dangerSoft: 'var(--danger-soft)',
  dangerLine: 'var(--danger-line)',

  // type
  fsMicro: 'var(--fs-micro)',
  fsXs: 'var(--fs-xs)',
  fsSm: 'var(--fs-sm)',
  fsBase: 'var(--fs-base)',
  fsMd: 'var(--fs-md)',
  fsLg: 'var(--fs-lg)',
  fsXl: 'var(--fs-xl)',
  fs2xl: 'var(--fs-2xl)',
  fs3xl: 'var(--fs-3xl)',
  fsMetric: 'var(--fs-metric)',
  fsMetricLg: 'var(--fs-metric-lg)',
  ffMono: 'var(--ff-mono)',

  // radii
  rSm: 'var(--r-sm)',
  rMd: 'var(--r-md)',
  rLg: 'var(--r-lg)',
  rXl: 'var(--r-xl)',
  rPill: 'var(--r-pill)',

  // elevation
  shadowSm: 'var(--shadow-sm)',
  shadowMd: 'var(--shadow-md)',
  shadowLg: 'var(--shadow-lg)',
  focusRing: 'var(--focus-ring)',

  maxw: 'var(--maxw)',
  navH: 'var(--nav-h)',
} as const

// Status tone → color set (semantic colors only)
export type Tone = 'accent' | 'ok' | 'warn' | 'danger' | 'violet' | 'neutral'
export function tone(t: Tone) {
  switch (t) {
    case 'ok': return { fg: T.ok, soft: T.okSoft, line: T.okLine }
    case 'warn': return { fg: T.warn, soft: T.warnSoft, line: T.warnLine }
    case 'danger': return { fg: T.danger, soft: T.dangerSoft, line: T.dangerLine }
    case 'violet': return { fg: T.violet, soft: T.violetSoft, line: T.violetLine }
    case 'neutral': return { fg: T.ink2, soft: 'rgba(255,255,255,0.04)', line: T.line }
    default: return { fg: T.accent, soft: T.accentSoft, line: T.accentLine }
  }
}
