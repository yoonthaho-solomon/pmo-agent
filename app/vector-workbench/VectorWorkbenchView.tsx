'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ---- Factor data from dc.html ----
const FACTORS = [
  { code: 'F01', name: '시간대 적합',   desc: '호출 발생 시간대와 기사 주력 운행 시간대 일치', call: 0.92, drv: 0.90 },
  { code: 'F02', name: '요일 성향',     desc: '요일별 운행 빈도 패턴 일치', call: 0.78, drv: 0.84 },
  { code: 'F03', name: '예상거리 선호', desc: '콜 예상거리와 기사 평균 운행거리 대역', call: 0.66, drv: 0.71 },
  { code: 'F04', name: '예상요금 대역', desc: '콜 예상요금과 기사 평균 객단가', call: 0.70, drv: 0.68 },
  { code: 'F05', name: '유료호출 성향', desc: '유료호출 수락 비율', call: 0.30, drv: 0.34 },
  { code: 'F06', name: '일반호출 성향', desc: '일반호출 수락 비율', call: 0.88, drv: 0.86 },
  { code: 'F07', name: '출발 H3 선호', desc: '출발지 H3 셀 누적 픽업 빈도', call: 0.94, drv: 0.87 },
  { code: 'F08', name: '도착 H3 선호', desc: '도착지 H3 셀 누적 드랍 빈도', call: 0.81, drv: 0.79 },
  { code: 'F09', name: '출발 주소권',   desc: '출발지 행정동 운행권 일치', call: 0.76, drv: 0.80 },
  { code: 'F10', name: '도착 주소권',   desc: '도착지 행정동 운행권 일치', call: 0.64, drv: 0.69 },
  { code: 'F11', name: 'pickup 근접성', desc: '현재 추정 위치에서 출발지까지 접근성', call: 0.72, drv: 0.77 },
  { code: 'F12', name: '저녁피크 비중', desc: '18–22시 운행 집중도', call: 0.85, drv: 0.88 },
  { code: 'F13', name: '단거리 회피',   desc: '단거리 콜 기피 경향(역)', call: 0.40, drv: 0.36 },
  { code: 'F14', name: '장거리 선호',   desc: '장거리 콜 선호도', call: 0.58, drv: 0.62 },
  { code: 'F15', name: '강남권 집중',   desc: '강남 3구 운행 집중도', call: 0.90, drv: 0.85 },
  { code: 'F16', name: '주중 활동',     desc: '주중 운행 활성도', call: 0.83, drv: 0.81 },
  { code: 'F17', name: '심야 활동',     desc: '00–04시 운행 비중', call: 0.22, drv: 0.27 },
  { code: 'F18', name: '재호출 수락',   desc: '재배차 콜 수락률', call: 0.61, drv: 0.64 },
  { code: 'F19', name: '경유 선호',     desc: '경유 포함 콜 수락 경향', call: 0.44, drv: 0.41 },
  { code: 'F20', name: '대기 인내',     desc: '배차 후 픽업 대기 인내도', call: 0.69, drv: 0.73 },
  { code: 'F21', name: '취소율(역)',    desc: '배차 후 취소 빈도(낮을수록 좋음)', call: 0.79, drv: 0.82 },
  { code: 'F22', name: '누적 운행량',   desc: '기간 내 총 운행 완료 수', call: 0.74, drv: 0.78 },
]

const AXES = [
  { label: '시간대',    call: 0.90, drv: 0.89 },
  { label: '요일',      call: 0.78, drv: 0.84 },
  { label: '거리·요금', call: 0.66, drv: 0.70 },
  { label: '출발 H3',  call: 0.92, drv: 0.85 },
  { label: '도착 H3',  call: 0.78, drv: 0.77 },
]

function contribOf(f: typeof FACTORS[0]) {
  return Math.max(0, 1 - Math.abs(f.call - f.drv) * 4) * (f.call + f.drv) / 2
}

// ---- Canvas drawing ----
function drawVectorCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)

  // ===== LEFT: radar pentagon =====
  const rcx = W * 0.27, rcy = H * 0.52
  const R = Math.min(W * 0.21, H * 0.40)
  const n = AXES.length
  const ang = (i: number) => -Math.PI / 2 + i * 2 * Math.PI / n

  // grid rings
  for (let g = 1; g <= 4; g++) {
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const a = ang(i % n)
      const rr = R * g / 4
      const x = rcx + rr * Math.cos(a), y = rcy + rr * Math.sin(a)
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.strokeStyle = `rgba(148,163,184,${0.05 + g * 0.012})`
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // spokes + labels
  for (let i = 0; i < n; i++) {
    const a = ang(i)
    const x = rcx + R * Math.cos(a), y = rcy + R * Math.sin(a)
    ctx.beginPath()
    ctx.moveTo(rcx, rcy)
    ctx.lineTo(x, y)
    ctx.strokeStyle = 'rgba(148,163,184,.07)'
    ctx.stroke()
    ctx.fillStyle = '#9aa7bd'
    ctx.font = '600 11px Pretendard, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(AXES[i].label, rcx + (R + 22) * Math.cos(a), rcy + (R + 16) * Math.sin(a))
  }

  const poly = (key: 'call' | 'drv', stroke: string, fill: string, glow: string) => {
    ctx.save()
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const a = ang(i % n)
      const v = AXES[i % n][key]
      const rr = R * v
      const x = rcx + rr * Math.cos(a), y = rcy + rr * Math.sin(a)
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.shadowColor = glow
    ctx.shadowBlur = 12
    ctx.stroke()
    ctx.restore()
    for (let i = 0; i < n; i++) {
      const a = ang(i)
      const v = AXES[i][key]
      const rr = R * v
      const x = rcx + rr * Math.cos(a), y = rcy + rr * Math.sin(a)
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, 7)
      ctx.fillStyle = stroke
      ctx.fill()
    }
  }
  poly('call', '#34d8ee', 'rgba(34,211,238,.14)', '#22d3ee')
  poly('drv',  '#b79bff', 'rgba(167,139,250,.16)', '#a78bfa')

  // ===== RIGHT: cosine wedge =====
  const ox = W * 0.62, oy = H * 0.74
  const L = Math.min(W * 0.30, H * 0.62)
  const cosv = 0.901
  const theta = Math.acos(cosv)
  const base = -Math.PI / 2 - 0.18
  const aCall = base, aDrv = base + theta

  // arc fill
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.arc(ox, oy, L * 0.42, aCall, aDrv)
  ctx.closePath()
  const gg = ctx.createRadialGradient(ox, oy, 0, ox, oy, L * 0.42)
  gg.addColorStop(0, 'rgba(120,160,255,.28)')
  gg.addColorStop(1, 'rgba(120,160,255,0)')
  ctx.fillStyle = gg
  ctx.fill()
  ctx.restore()

  // two rays
  const ray = (a: number, col: string, glow: string, lbl: string) => {
    const x = ox + L * Math.cos(a), y = oy + L * Math.sin(a)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.lineTo(x, y)
    ctx.strokeStyle = col
    ctx.lineWidth = 2.5
    ctx.shadowColor = glow
    ctx.shadowBlur = 14
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 4.5, 0, 7)
    ctx.fillStyle = col
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = col
    ctx.font = '600 12px Pretendard, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(lbl, x + Math.cos(a) * 18, y + Math.sin(a) * 14)
  }

  ctx.beginPath()
  ctx.arc(ox, oy, 4, 0, 7)
  ctx.fillStyle = '#e8edf6'
  ctx.fill()
  ray(aCall, '#34d8ee', '#22d3ee', '콜카드')
  ray(aDrv,  '#b79bff', '#a78bfa', '기사')

  // theta arc indicator
  ctx.beginPath()
  ctx.arc(ox, oy, 30, aCall, aDrv)
  ctx.strokeStyle = 'rgba(220,230,245,.5)'
  ctx.lineWidth = 1.4
  ctx.stroke()
  const midA = (aCall + aDrv) / 2
  ctx.fillStyle = '#dbe7f2'
  ctx.font = '600 12px JetBrains Mono, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('θ 25.7°', ox + 50 * Math.cos(midA), oy + 50 * Math.sin(midA))
  ctx.fillStyle = '#9aa7bd'
  ctx.font = '600 12px Pretendard, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('각도가 작을수록 두 벡터가 비슷', ox - L * 0.1, oy + 26)
  ctx.fillStyle = '#c3acff'
  ctx.font = '700 13px JetBrains Mono, monospace'
  ctx.fillText('cos θ = 0.901', ox - L * 0.1, oy + 46)
}

// ---- Main component ----
export function VectorWorkbenchView() {
  const [selected, setSelected] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas) drawVectorCanvas(canvas)
  }, [])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [draw])

  const f = FACTORS[selected]
  const diff = f.drv - f.call
  const contrib = contribOf(f)

  return (
    <div style={{ maxWidth: '1560px', margin: '0 auto', padding: '22px 22px 32px' }}>
      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <h1 style={{ fontSize: '27px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>벡터 워크벤치</h1>
          <p style={{ fontSize: '14px', color: '#8b98ae', margin: 0 }}>콜카드와 기사가 어떤 22개 팩터로 설명되고, 두 벡터를 어떻게 비교하는가</p>
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee', display: 'inline-block' }} />
            <span style={{ fontSize: '12px', color: '#9aa7bd', fontWeight: 500 }}>콜카드 벡터</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: '#a78bfa', boxShadow: '0 0 8px #a78bfa', display: 'inline-block' }} />
            <span style={{ fontSize: '12px', color: '#9aa7bd', fontWeight: 500 }}>기사 D-2207 벡터</span>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '15px 18px', borderRadius: '16px', background: 'rgba(10,15,25,.7)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.4)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c89a0', letterSpacing: '.04em', textTransform: 'uppercase' }}>콜카드</span>
          <span style={{ fontSize: '18px', fontWeight: 700 }}>강남 · 금 · 18–20시</span>
          <span style={{ fontSize: '11px', color: '#8b98ae' }}>역삼1동 → 청담동</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '15px 18px', borderRadius: '16px', background: 'rgba(10,15,25,.7)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.4)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c89a0', letterSpacing: '.04em', textTransform: 'uppercase' }}>후보 기사 수</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '31px', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>1,284</span>
          <span style={{ fontSize: '11px', color: '#8b98ae' }}>비교 대상 누적 기사</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '15px 18px', borderRadius: '16px', background: 'linear-gradient(160deg, rgba(28,24,46,.7), rgba(10,15,25,.66))', border: '1px solid rgba(167,139,250,.32)', boxShadow: '0 18px 44px rgba(0,0,0,.4),0 0 26px rgba(167,139,250,.1)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#b79bff', letterSpacing: '.04em', textTransform: 'uppercase' }}>최고 유사도</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '31px', fontWeight: 700, lineHeight: 1, color: '#c3acff', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 22px rgba(167,139,250,.4)' }}>0.901</span>
          <span style={{ fontSize: '11px', color: '#8b98ae' }}>코사인 · 콜카드 ↔ D-2207</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '15px 18px', borderRadius: '16px', background: 'rgba(10,15,25,.7)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 18px 44px rgba(0,0,0,.4)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c89a0', letterSpacing: '.04em', textTransform: 'uppercase' }}>선택 팩터</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#5ce0f0' }}>{f.name}</span>
          <span style={{ fontSize: '11px', color: '#8b98ae' }}>기여도 +{contrib.toFixed(3)}</span>
        </div>
      </div>

      {/* Main 3-col */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr 340px', gap: '13px', alignItems: 'start' }}>
        {/* Left: 22D factor list */}
        <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>22D 팩터</h2>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#7c89a0' }}>driver_mbti</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '560px', overflowY: 'auto', paddingRight: '2px' }}>
            {FACTORS.map((factor, i) => {
              const isSel = i === selected
              const contrib = contribOf(factor)
              return (
                <button
                  key={factor.code}
                  onClick={() => setSelected(i)}
                  style={{
                    textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 11px', borderRadius: '10px',
                    background: isSel ? 'linear-gradient(150deg, rgba(20,38,50,.92), rgba(16,22,38,.9))' : 'rgba(16,22,35,.5)',
                    border: isSel ? '1px solid rgba(34,211,238,.5)' : '1px solid rgba(148,163,184,.09)',
                  }}
                >
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: '#6b778d', width: '24px', flexShrink: 0 }}>{factor.code}</span>
                  <span style={{ flex: 1, fontSize: '12.5px', fontWeight: 600, color: isSel ? '#5ce0f0' : '#cdd6e6', minWidth: 0 }}>{factor.name}</span>
                  <span style={{ width: '54px', height: '5px', borderRadius: '3px', background: 'rgba(148,163,184,.14)', overflow: 'hidden', flexShrink: 0, display: 'block' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.round(contrib * 100)}%`, background: isSel ? 'linear-gradient(90deg,#22d3ee,#a78bfa)' : 'rgba(120,150,190,.5)' }} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Center: canvas + 22D bar chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>코사인 유사도 렌즈 · 5축 요약</h2>
                <span style={{ fontSize: '12px', color: '#8b98ae' }}>두 특성이 얼마나 비슷한지 비교한 점수 — 22D를 5축으로 요약</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: '#8b98ae' }}>cos θ</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '28px', fontWeight: 700, color: '#c3acff', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 20px rgba(167,139,250,.4)' }}>0.901</span>
              </div>
            </div>
            <canvas ref={canvasRef} style={{ width: '100%', height: '344px', display: 'block' }} />
          </section>

          {/* 22D bar chart */}
          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>22D 원본 벡터 비교</h2>
              <span style={{ fontSize: '11px', color: '#7c89a0' }}>콜카드 vs 기사 · 같은 순서</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '96px' }}>
              {FACTORS.map((factor, i) => {
                const isSel = i === selected
                return (
                  <div
                    key={factor.code}
                    onClick={() => setSelected(i)}
                    title={`${factor.name} · 콜 ${factor.call.toFixed(2)} / 기사 ${factor.drv.toFixed(2)}`}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', height: '100%', justifyContent: 'flex-end' }}
                  >
                    <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2px', height: '78px' }}>
                      <span style={{ width: '42%', borderRadius: '2px 2px 0 0', height: `${Math.round(factor.call * 100)}%`, background: isSel ? '#5ce0f0' : 'rgba(34,211,238,.55)', display: 'inline-block' }} />
                      <span style={{ width: '42%', borderRadius: '2px 2px 0 0', height: `${Math.round(factor.drv * 100)}%`, background: isSel ? '#c3acff' : 'rgba(167,139,250,.5)', display: 'inline-block' }} />
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', color: isSel ? '#9fb4cc' : '#5a6680' }}>{factor.code}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Right: Factor Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '13px', position: 'sticky', top: '78px' }}>
          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '4px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: '#5ce0f0', boxShadow: '0 0 8px #5ce0f0', display: 'inline-block' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>팩터 인스펙터</h2>
            </div>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#5ce0f0', margin: '8px 0 3px' }}>{f.name}</p>
            <p style={{ fontSize: '12px', color: '#8b98ae', marginBottom: '16px' }}>{f.desc}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#9aa7bd' }}>콜카드 값</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '14px', fontWeight: 700, color: '#5ce0f0' }}>{f.call.toFixed(3)}</span>
                </div>
                <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(148,163,184,.12)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(f.call * 100)}%`, background: 'linear-gradient(90deg,#22d3ee,#3ddcef)', borderRadius: '4px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#9aa7bd' }}>기사 D-2207 값</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '14px', fontWeight: 700, color: '#c3acff' }}>{f.drv.toFixed(3)}</span>
                </div>
                <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(148,163,184,.12)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(f.drv * 100)}%`, background: 'linear-gradient(90deg,#a78bfa,#c3acff)', borderRadius: '4px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', paddingTop: '6px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', padding: '11px 13px', borderRadius: '11px', background: 'rgba(20,28,42,.6)', border: '1px solid rgba(148,163,184,.12)' }}>
                  <span style={{ fontSize: '11px', color: '#7c89a0' }}>팩터 차이</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '18px', fontWeight: 700, color: Math.abs(diff) < 0.05 ? '#7ee0a3' : '#fbd77a' }}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(3)}
                  </span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', padding: '11px 13px', borderRadius: '11px', background: 'rgba(20,28,42,.6)', border: '1px solid rgba(148,163,184,.12)' }}>
                  <span style={{ fontSize: '11px', color: '#7c89a0' }}>유사도 기여</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '18px', fontWeight: 700, color: '#7ee0a3' }}>+{contrib.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </section>

          <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '16px 20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>계산 방식</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#22d3ee', width: '62px' }}>cosine</span>
                <span style={{ fontSize: '12px', color: '#9aa7bd' }}>22D 벡터 내적 / 크기곱</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#a78bfa', width: '62px' }}>75%</span>
                <span style={{ fontSize: '12px', color: '#9aa7bd' }}>성향 유사도 가중</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#4ade80', width: '62px' }}>25%</span>
                <span style={{ fontSize: '12px', color: '#9aa7bd' }}>H3 공간 적합도 가중</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
