'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ---- Candidate data ----
const CANDIDATES = [
  { id: 'D-2207', tag: '역삼 야간 주력',     score: 0.892, prop: 0.901, space: 0.864 },
  { id: 'D-1841', tag: '강남 단거리',         score: 0.871, prop: 0.882, space: 0.851 },
  { id: 'D-3390', tag: '청담 선호',           score: 0.858, prop: 0.864, space: 0.846 },
  { id: 'D-0925', tag: '저녁피크 고수락',     score: 0.844, prop: 0.851, space: 0.829 },
  { id: 'D-4172', tag: '삼성동 거점',         score: 0.829, prop: 0.836, space: 0.816 },
  { id: 'D-1130', tag: '단거리 회피↓',       score: 0.817, prop: 0.822, space: 0.808 },
  { id: 'D-2688', tag: '유료호출 강세',       score: 0.803, prop: 0.808, space: 0.795 },
  { id: 'D-0457', tag: '강남 장기누적',       score: 0.792, prop: 0.799, space: 0.781 },
  { id: 'D-3011', tag: '신논현 거점',         score: 0.781, prop: 0.788, space: 0.770 },
  { id: 'D-1779', tag: '심야 주력',           score: 0.768, prop: 0.774, space: 0.758 },
]

function mkbars(seed: number, peak: number) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = Math.abs(i - peak)
    const v = Math.max(0.12, 1 - d * 0.26 - ((seed * 7 + i * 13) % 5) * 0.03)
    return { h: `${Math.round(v * 100)}%`, c: i === peak ? 'linear-gradient(180deg,#5ce0f0,#22a6c4)' : 'rgba(99,126,164,.5)' }
  })
}

// ---- Hex field types ----
interface HexCell { q: number; r: number; v: number; isOrigin: boolean; isDest: boolean; pref: number; phase: number }
interface ProjCell { c: HexCell; sx: number; sy: number; hgt: number; depth: number }

function buildField(): HexCell[] {
  const cells: HexCell[] = []
  const N = 7
  const originQ = -1, originR = 1
  const destQ = 3, destR = -2
  for (let q = -N; q <= N; q++) {
    for (let r = Math.max(-N, -q - N); r <= Math.min(N, -q + N); r++) {
      const dist = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2
      if (dist > N) continue
      const nx = Math.sin(q * 0.9 + r * 0.4), ny = Math.cos(q * 0.5 - r * 0.8)
      let v = 0.28 + 0.34 * (nx * 0.5 + 0.5) + 0.22 * (ny * 0.5 + 0.5) - dist * 0.018
      v = Math.max(0.05, Math.min(1, v))
      const isOrigin = q === originQ && r === originR
      const isDest = q === destQ && r === destR
      const pref = Math.exp(-(Math.pow(q - 2, 2) + Math.pow(r + 1, 2)) / 6) + Math.exp(-(Math.pow(q + 2, 2) + Math.pow(r - 2, 2)) / 7)
      cells.push({ q, r, v, isOrigin, isDest, pref: Math.min(1, pref), phase: (q * 3 + r * 7) % 10 })
    }
  }
  return cells
}

function axialToWorld(q: number, r: number, size: number) {
  return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r }
}

// ---- Main component ----
export function MatchingStudioView() {
  const [radius, setRadius] = useState(2)
  const [selected, setSelected] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const cellsRef = useRef<HexCell[]>([])

  useEffect(() => {
    cellsRef.current = buildField()
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !cellsRef.current.length) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.clientWidth, H = canvas.clientHeight
    const t = tRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const cx = W * 0.5, cy = H * 0.46
    const size = Math.max(20, Math.min(W, H) * 0.052)
    const yScale = 0.58
    const extrude = size * 1.85

    // ground glow
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 9)
    grd.addColorStop(0, 'rgba(20,40,60,.20)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(cx, cy, size * 9, 0, 7)
    ctx.fill()
    ctx.restore()

    // project cells
    const proj: ProjCell[] = cellsRef.current.map(c => {
      const w = axialToWorld(c.q, c.r, size)
      const sx = cx + w.x
      const sy = cy + w.y * yScale
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.3 + c.phase)
      const hgt = (c.v * 0.85 + 0.15 * pulse * c.v) * extrude
      return { c, sx, sy, hgt, depth: w.y }
    }).sort((a, b) => a.depth - b.depth)

    const hexPts = (scx: number, scy: number) => {
      return Array.from({ length: 6 }, (_, i) => {
        const a = (-90 + i * 60) * Math.PI / 180
        return { x: scx + size * 0.94 * Math.cos(a), y: scy + size * 0.94 * Math.sin(a) * yScale }
      })
    }

    const colorFor = (c: HexCell) => {
      if (c.isOrigin) return { top: 'rgba(60,224,240,.9)', glow: '#22d3ee' }
      if (c.isDest) return { top: 'rgba(176,140,255,.92)', glow: '#a78bfa' }
      if (c.pref > 0.32) {
        const a = 0.30 + c.pref * 0.5
        return { top: `rgba(150,120,250,${a})`, glow: '#9a7bff' }
      }
      const a = 0.16 + c.v * 0.5
      const g = Math.round(120 + c.v * 110)
      const b = Math.round(150 + c.v * 80)
      return { top: `rgba(40,${g},${b},${a})`, glow: `rgba(34,200,235,${c.v * 0.5})` }
    }

    // draw pillars
    for (const p of proj) {
      const c = p.c
      const topY = p.sy - p.hgt
      const basePts = hexPts(p.sx, p.sy)
      const topPts = hexPts(p.sx, topY)
      const col = colorFor(c)
      const isHi = c.isOrigin || c.isDest || c.pref > 0.32

      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6
        const midY = (basePts[i].y + basePts[j].y) / 2
        if (midY < p.sy - 1) continue
        ctx.beginPath()
        ctx.moveTo(topPts[i].x, topPts[i].y)
        ctx.lineTo(topPts[j].x, topPts[j].y)
        ctx.lineTo(basePts[j].x, basePts[j].y)
        ctx.lineTo(basePts[i].x, basePts[i].y)
        ctx.closePath()
        const wallTop = isHi ? 'rgba(30,60,80,0.55)' : 'rgba(20,32,50,0.5)'
        const g2 = ctx.createLinearGradient(0, topY, 0, p.sy)
        g2.addColorStop(0, wallTop)
        g2.addColorStop(1, 'rgba(6,10,18,0.66)')
        ctx.fillStyle = g2
        ctx.fill()
        ctx.strokeStyle = isHi ? 'rgba(120,200,235,0.18)' : 'rgba(120,150,190,0.06)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      ctx.save()
      if (isHi) { ctx.shadowColor = col.glow; ctx.shadowBlur = 18 }
      ctx.globalCompositeOperation = isHi ? 'lighter' : 'source-over'
      ctx.beginPath()
      topPts.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y))
      ctx.closePath()
      ctx.fillStyle = col.top
      ctx.fill()
      ctx.restore()

      ctx.beginPath()
      topPts.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y))
      ctx.closePath()
      ctx.strokeStyle = isHi ? 'rgba(180,230,250,0.6)' : 'rgba(150,190,225,0.12)'
      ctx.lineWidth = isHi ? 1.4 : 1
      ctx.stroke()
    }

    // OD arc
    const oCell = proj.find(p => p.c.isOrigin)
    const dCell = proj.find(p => p.c.isDest)
    if (oCell && dCell) {
      const ox2 = oCell.sx, oy2 = oCell.sy - oCell.hgt - 6
      const dx = dCell.sx, dy = dCell.sy - dCell.hgt - 6
      const mx = (ox2 + dx) / 2, my = Math.min(oy2, dy) - 70
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.beginPath()
      ctx.moveTo(ox2, oy2)
      ctx.quadraticCurveTo(mx, my, dx, dy)
      ctx.strokeStyle = 'rgba(90,220,245,0.7)'
      ctx.lineWidth = 2.2
      ctx.setLineDash([7, 7])
      ctx.lineDashOffset = -t * 22
      ctx.shadowColor = '#22d3ee'
      ctx.shadowBlur = 12
      ctx.stroke()
      ctx.setLineDash([])
      const tt = Math.sin(t * 0.8) * 0.5 + 0.5
      const bx = (1 - tt) * (1 - tt) * ox2 + 2 * (1 - tt) * tt * mx + tt * tt * dx
      const by = (1 - tt) * (1 - tt) * oy2 + 2 * (1 - tt) * tt * my + tt * tt * dy
      ctx.beginPath()
      ctx.arc(bx, by, 3.4, 0, 7)
      ctx.fillStyle = '#bdf3ff'
      ctx.shadowBlur = 14
      ctx.fill()
      ctx.restore()
    }

    // search radius ring
    const ringR = radius * size * 1.7
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx, cy, ringR, ringR * yScale, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(34,211,238,0.28)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }, [radius])

  useEffect(() => {
    const loop = () => {
      tRef.current += 0.016
      drawFrame()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [drawFrame])

  const fmt = (n: number) => n.toFixed(3)
  const sel = CANDIDATES[selected]
  const evidence = [
    { label: '시간대 적합', val: fmt(0.91 - selected * 0.012), color: '#5ce0f0', bars: mkbars(selected, 4) },
    { label: '요일 성향',   val: fmt(0.88 - selected * 0.011), color: '#c3acff', bars: mkbars(selected + 1, 5) },
    { label: '거리 선호',   val: fmt(0.86 - selected * 0.013), color: '#5ce0f0', bars: mkbars(selected + 2, 3) },
    { label: '출발 H3 근접', val: fmt(0.87 - selected * 0.010), color: '#7ee0a3', bars: mkbars(selected + 3, 2) },
    { label: '도착 H3 선호', val: fmt(0.84 - selected * 0.012), color: '#c3acff', bars: mkbars(selected + 4, 5) },
  ]

  const rStyle = (on: boolean) => ({
    bg: on ? 'linear-gradient(180deg,#3ddcef,#22c6e0)' : 'rgba(20,28,42,.6)',
    border: on ? 'none' : '1px solid rgba(148,163,184,.14)',
    color: on ? '#05070d' : '#8b98ae',
  })

  return (
    <div style={{ position: 'relative', height: 'calc(100dvh - 62px)', overflow: 'hidden' }}>
      {/* Full-bleed canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />

      {/* Depth overlays */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(90% 70% at 50% 46%, transparent 40%, rgba(4,6,12,.55) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '180px', pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(4,6,12,.6), transparent)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '200px', pointerEvents: 'none', background: 'linear-gradient(0deg, rgba(4,6,12,.78), transparent)' }} />

      {/* KPI floating chips */}
      <div style={{ position: 'absolute', top: '16px', left: '22px', right: '22px', zIndex: 30, display: 'flex', gap: '12px', alignItems: 'stretch' }}>
        <div style={{ flex: 1.5, minWidth: '230px', display: 'flex', flexDirection: 'column', gap: '6px', padding: '13px 17px', borderRadius: '15px', background: 'rgba(10,15,25,.66)', backdropFilter: 'blur(16px)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.45)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c89a0', letterSpacing: '.04em', textTransform: 'uppercase' }}>선택 콜카드</span>
          <span style={{ fontSize: '19px', fontWeight: 700 }}>강남구 · 금요일 · 18–20시</span>
          <span style={{ fontSize: '12px', color: '#8b98ae' }}>역삼1동 → 청담동 · 일반호출</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', padding: '13px 17px', borderRadius: '15px', background: 'rgba(10,15,25,.66)', backdropFilter: 'blur(16px)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.45)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c89a0', letterSpacing: '.04em', textTransform: 'uppercase' }}>후보 기사 수</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '34px', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>1,284</span>
          <span style={{ fontSize: '12px', color: '#8b98ae' }}>탐색반경 2km 내 누적</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', padding: '13px 17px', borderRadius: '15px', background: 'linear-gradient(160deg, rgba(20,36,46,.7), rgba(10,15,25,.66))', backdropFilter: 'blur(16px)', border: '1px solid rgba(34,211,238,.32)', boxShadow: '0 18px 44px rgba(0,0,0,.45),0 0 28px rgba(34,211,238,.1)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#5fd6e8', letterSpacing: '.04em', textTransform: 'uppercase' }}>1위 최종점수</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '34px', fontWeight: 700, lineHeight: 1, color: '#5ce0f0', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 22px rgba(34,211,238,.45)' }}>0.892</span>
          <span style={{ fontSize: '12px', color: '#8b98ae' }}>기사 D-2207 · 추천 1순위</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', padding: '13px 17px', borderRadius: '15px', background: 'rgba(10,15,25,.66)', backdropFilter: 'blur(16px)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.45)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#b79bff', letterSpacing: '.04em', textTransform: 'uppercase' }}>성향 유사도</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '34px', fontWeight: 700, lineHeight: 1, color: '#c3acff', fontVariantNumeric: 'tabular-nums' }}>0.901</span>
          <span style={{ fontSize: '12px', color: '#8b98ae' }}>코사인 · 가중 75%</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', padding: '13px 17px', borderRadius: '15px', background: 'rgba(10,15,25,.66)', backdropFilter: 'blur(16px)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.45)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c89a0', letterSpacing: '.04em', textTransform: 'uppercase' }}>공간 적합도</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '34px', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>0.864</span>
          <span style={{ fontSize: '12px', color: '#8b98ae' }}>H3 선호 · 가중 25%</span>
        </div>
      </div>

      {/* Left: Call Card Builder */}
      <aside style={{ position: 'absolute', top: '138px', left: '22px', width: '312px', bottom: '150px', zIndex: 30, display: 'flex', flexDirection: 'column', borderRadius: '18px', background: 'rgba(9,14,23,.72)', backdropFilter: 'blur(20px) saturate(135%)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 28px 64px rgba(0,0,0,.55)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(148,163,184,.09)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: 700 }}>콜카드 빌더</span>
          <span style={{ fontSize: '11px', color: '#7c89a0', fontWeight: 500 }}>조건 입력</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#8b98ae', letterSpacing: '.03em' }}>지역 · 요일 · 시간</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#dbe3f0', background: 'rgba(20,28,42,.7)', border: '1px solid rgba(148,163,184,.14)', borderRadius: '9px', padding: '9px 11px' }}>강남구</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#dbe3f0', background: 'rgba(20,28,42,.7)', border: '1px solid rgba(148,163,184,.14)', borderRadius: '9px', padding: '9px 11px' }}>금요일</div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#dbe3f0', background: 'rgba(20,28,42,.7)', border: '1px solid rgba(148,163,184,.14)', borderRadius: '9px', padding: '9px 11px' }}>18:00 – 20:00 · 저녁 피크</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#8b98ae', letterSpacing: '.03em' }}>출발지 · 도착지</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', background: 'rgba(20,28,42,.7)', border: '1px solid rgba(34,211,238,.28)', borderRadius: '9px', padding: '9px 11px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 10px #22d3ee', flexShrink: 0, display: 'inline-block' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>역삼1동 · 강남대로 396</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: '#7c89a0' }}>출발 H3 · 8830e1d0fffffff</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', background: 'rgba(20,28,42,.7)', border: '1px solid rgba(167,139,250,.28)', borderRadius: '9px', padding: '9px 11px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#a78bfa', boxShadow: '0 0 10px #a78bfa', flexShrink: 0, display: 'inline-block' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>청담동 · 도산대로 도착</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: '#7c89a0' }}>도착 H3 · 8830e1d4bffffff</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#8b98ae', letterSpacing: '.03em' }}>예상거리 · 예상요금</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(20,28,42,.7)', border: '1px solid rgba(148,163,184,.14)', borderRadius: '9px', padding: '9px 11px' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '17px', fontWeight: 700 }}>5.8<span style={{ fontSize: '11px', color: '#8b98ae' }}> km</span></span>
                <span style={{ fontSize: '10px', color: '#7c89a0' }}>예상거리</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(20,28,42,.7)', border: '1px solid rgba(148,163,184,.14)', borderRadius: '9px', padding: '9px 11px' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '17px', fontWeight: 700 }}>13,400<span style={{ fontSize: '11px', color: '#8b98ae' }}> ₩</span></span>
                <span style={{ fontSize: '10px', color: '#7c89a0' }}>예상요금</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#fbbf24', background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)', borderRadius: '8px', padding: '7px 10px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block', flexShrink: 0 }} />
              시뮬레이션 추정값 · 실제 운영값 아님
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#8b98ae', letterSpacing: '.03em' }}>호출 종류</span>
            <div style={{ display: 'flex', gap: '7px' }}>
              <div style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#05070d', background: 'linear-gradient(180deg,#3ddcef,#22c6e0)', borderRadius: '9px', padding: '9px' }}>일반호출</div>
              <div style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#8b98ae', background: 'rgba(20,28,42,.6)', border: '1px solid rgba(148,163,184,.14)', borderRadius: '9px', padding: '9px' }}>유료호출</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#8b98ae', letterSpacing: '.03em' }}>탐색반경</span>
            <div style={{ display: 'flex', gap: '7px' }}>
              {([1, 2, 3] as const).map(r => {
                const s = rStyle(radius === r)
                return (
                  <button key={r} onClick={() => setRadius(r)} style={{ flex: 1, fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 600, cursor: 'pointer', borderRadius: '9px', padding: '9px', background: s.bg, border: s.border, color: s.color }}>
                    {r} km
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div style={{ padding: '13px 18px', borderTop: '1px solid rgba(148,163,184,.09)' }}>
          <button style={{ width: '100%', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700, color: '#05070d', background: 'linear-gradient(180deg,#3ddcef,#1eb8d4)', border: 'none', borderRadius: '11px', padding: '12px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(34,211,238,.3)' }}>후보 재탐색 ↻</button>
        </div>
      </aside>

      {/* Right: Top 10 candidates */}
      <aside style={{ position: 'absolute', top: '138px', right: '22px', width: '344px', bottom: '150px', zIndex: 30, display: 'flex', flexDirection: 'column', borderRadius: '18px', background: 'rgba(9,14,23,.72)', backdropFilter: 'blur(20px) saturate(135%)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 28px 64px rgba(0,0,0,.55)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(148,163,184,.09)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: 700 }}>후보 기사 Top 10</span>
          <span style={{ fontSize: '11px', color: '#7c89a0', fontWeight: 500 }}>최종점수 순</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {CANDIDATES.map((c, i) => {
            const isSel = i === selected
            const top3 = i < 3
            return (
              <button
                key={c.id}
                onClick={() => setSelected(i)}
                style={{
                  textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                  padding: '11px 13px', borderRadius: '13px',
                  background: isSel ? 'linear-gradient(150deg, rgba(22,40,52,.92), rgba(18,24,40,.9))' : 'rgba(16,22,35,.6)',
                  border: isSel ? '1px solid rgba(34,211,238,.5)' : '1px solid rgba(148,163,184,.1)',
                  boxShadow: isSel ? '0 0 26px rgba(34,211,238,.16)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 700, color: top3 ? '#5ce0f0' : '#7c89a0', width: '22px', flexShrink: 0 }}>#{i + 1}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>기사 {c.id}</span>
                    <span style={{ fontSize: '11px', color: '#8b98ae' }}>{c.tag}</span>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '18px', fontWeight: 700, color: isSel ? '#5ce0f0' : top3 ? '#c3acff' : '#cdd6e6', fontVariantNumeric: 'tabular-nums' }}>{c.score.toFixed(3)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'rgba(148,163,184,.14)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(c.score * 100)}%`, borderRadius: '3px', background: isSel ? 'linear-gradient(90deg,#22d3ee,#a78bfa)' : top3 ? 'linear-gradient(90deg,#2b9fc4,#6f7bd8)' : 'rgba(148,163,184,.4)' }} />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: '#7c89a0', flexShrink: 0 }}>성향 {c.prop.toFixed(3)} · 공간 {c.space.toFixed(3)}</span>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Bottom: Evidence strip */}
      <div style={{ position: 'absolute', bottom: '20px', left: '356px', right: '388px', zIndex: 30, display: 'flex', gap: '11px', alignItems: 'stretch', borderRadius: '16px', background: 'rgba(9,14,23,.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 24px 56px rgba(0,0,0,.5)', padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center', paddingRight: '18px', borderRight: '1px solid rgba(148,163,184,.1)', minWidth: '148px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c89a0', letterSpacing: '.03em', textTransform: 'uppercase' }}>추천 근거</span>
          <span style={{ fontSize: '15px', fontWeight: 700 }}>기사 <span style={{ color: '#5ce0f0' }}>{sel.id}</span></span>
          <span style={{ fontSize: '11px', color: '#8b98ae' }}>5개 팩터 기여도</span>
        </div>
        {evidence.map((e) => (
          <div key={e.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#9aa7bd', fontWeight: 600 }}>{e.label}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', fontWeight: 700, color: e.color }}>{e.val}</span>
            </div>
            <div style={{ height: '32px', display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
              {e.bars.map((b, bi) => (
                <div key={bi} style={{ flex: 1, borderRadius: '1.5px', height: b.h, background: b.c }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Map legend */}
      <div style={{ position: 'absolute', bottom: '20px', right: '22px', zIndex: 30, width: '344px', display: 'flex', flexDirection: 'column', gap: '9px', borderRadius: '16px', background: 'rgba(9,14,23,.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 24px 56px rgba(0,0,0,.5)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 700 }}>H3 공간 레이어</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: '#7c89a0' }}>res 8 · 틸트 52°</span>
        </div>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', color: '#9aa7bd' }}>출발 H3 · 경로</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: '#a78bfa', boxShadow: '0 0 8px #a78bfa', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', color: '#9aa7bd' }}>기사 선호 H3</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: '#4ade80', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', color: '#9aa7bd' }}>Top 후보</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#fbbf24', borderTop: '1px solid rgba(148,163,184,.1)', paddingTop: '9px' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block', flexShrink: 0 }} />
          기사 선호 H3 · 실시간 위치 아님 (누적 운행패턴)
        </div>
      </div>
    </div>
  )
}
