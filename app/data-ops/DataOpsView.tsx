'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { DataOpsSummary } from '@/app/api/data-ops/summary/route'
import type { DriverLogsStats } from '@/app/api/data-ops/driver-logs/route'

// ---- Color tokens ----
const G  = { bg: '#2f8f64', border: '1px solid rgba(74,222,128,.35)' }
const Gs = { bg: '#256a4c', border: '1px solid rgba(74,222,128,.22)' }
const A  = { bg: '#9c7526', border: '1px solid rgba(251,191,36,.35)' }
const N  = { bg: 'rgba(148,163,184,.12)', border: '1px solid rgba(148,163,184,.1)' }

// ---- Helpers ----
function datesInRange(min: string, max: string): string[] {
  const dates: string[] = []
  const cur = new Date(`${min}T00:00:00`)
  const end = new Date(`${max}T00:00:00`)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function daysBetween(min: string, max: string) {
  const a = new Date(`${min}T00:00:00`)
  const b = new Date(`${max}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

function fmt(n: number) { return n.toLocaleString('ko-KR') }
function mmdd(iso: string) { return iso.slice(5).replace('-', '-') }
function rangeLabel(min: string, max: string) { return `${mmdd(min)} ~ ${mmdd(max)}` }

function axisLabels(dates: string[]): string[] {
  if (dates.length === 0) return []
  const n = 5
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.round(i * (dates.length - 1) / (n - 1))
    return mmdd(dates[idx])
  })
}

function buildCalendarRows(data: DataOpsSummary) {
  const allDates = datesInRange(data.calls.minDate, data.calls.maxDate)
  const callSet = new Set(data.calls.byDate.map(d => d.date))
  const meterMin = data.meter.minDate
  const meterMax = data.meter.maxDate

  const callCells = allDates.map(date => {
    const ok = callSet.has(date)
    return ok ? { ...G, title: `${mmdd(date)} 호출 있음` } : { ...N, title: `${mmdd(date)} 호출 없음` }
  })
  const meterCells = allDates.map(date => {
    const ok = date >= meterMin && date <= meterMax
    return ok
      ? { ...A, title: `${mmdd(date)} 앱미터 있음` }
      : { ...N, title: `${mmdd(date)} 앱미터 상세 미지원` }
  })
  const matchCells = allDates.map(date => {
    const withMeter = date >= meterMin && date <= meterMax
    return withMeter
      ? { ...G,  title: `${mmdd(date)} 매칭 (호출+앱미터)` }
      : { ...Gs, title: `${mmdd(date)} 매칭 (호출 기반)` }
  })

  return {
    rows: [
      { name: '호출데이터',   sub: 'calls',    cells: callCells },
      { name: '앱미터데이터', sub: 'app_meter', cells: meterCells },
      { name: '매칭 결과',   sub: 'matches',  cells: matchCells },
    ],
    axis: axisLabels(allDates),
  }
}

// ---- Component ----
export function DataOpsView() {
  const [data, setData] = useState<DataOpsSummary | null>(null)
  const [driverLogs, setDriverLogs] = useState<DriverLogsStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/data-ops/summary')
      .then(r => r.json())
      .then(j => {
        if (j.ok) setData(j.data)
        else setError(j.message ?? '데이터 로딩 실패')
      })
      .catch(e => setError(e.message))
    // driver_daily_logs stats (separate route — not in get_data_ops_summary)
    fetch('/api/data-ops/driver-logs')
      .then(r => r.json())
      .then(j => { if (j.ok) setDriverLogs(j.data) })
      .catch(() => {})
  }, [])

  if (error) return (
    <div style={{ padding: '40px', color: '#fbbf24', fontFamily: "'JetBrains Mono', monospace", fontSize: '15px' }}>
      ⚠ {error}
    </div>
  )

  if (!data) return (
    <div style={{ padding: '40px', color: '#7c89a0', fontFamily: "'JetBrains Mono', monospace", fontSize: '15px' }}>
      데이터 로딩 중...
    </div>
  )

  const callDays   = daysBetween(data.calls.minDate, data.calls.maxDate)
  const meterDays  = daysBetween(data.meter.minDate, data.meter.maxDate)
  const { rows: CAL_ROWS, axis: CAL_AXIS } = buildCalendarRows(data)

  // Source table → real columns → role in the 22D vector pipeline.
  const driverLogsRange = driverLogs?.minDate && driverLogs?.maxDate ? rangeLabel(driverLogs.minDate, driverLogs.maxDate) : '집계 원천'
  const driverLogsCount = driverLogs ? `${fmt(driverLogs.total)}건` : '…'

  const CATALOG = [
    {
      table: 'callcard_mbti', desc: '승객 호출 원천 로그', accent: '#22d3ee',
      range: rangeLabel(data.calls.minDate, data.calls.maxDate), count: `${fmt(data.calls.total)}건`,
      columns: ['hour_slot', 'weekday', 'expected_distance', 'expected_fare', 'is_paid', 'is_surge', 'eta_distance', 's_hexagon', 'd_hexagon'],
      usage: '콜카드 1건 → one-hot 방식으로 22D 벡터화 (아래 변환 규칙)',
    },
    {
      table: 'driver_daily_logs', desc: '기사 일별 콜 수락 행동', accent: '#fbbf24',
      range: driverLogsRange, count: driverLogsCount,
      columns: ['accepted_hours', 'weekday', 'avg_distance', 'avg_fare', 'paid_accepted', 'free_accepted', 'low/mid/high_fare_cnt', 'short/medium/long_cnt', 'product_normal/night/surge_cnt', 'accepted_s/d_hexagons'],
      usage: '각 기사의 수락 행동을 집계해 → driver_mbti의 22축 점수로 환산',
    },
    {
      table: 'driver_mbti', desc: '기사 22D 성향 벡터 (집계 결과)', accent: '#a78bfa',
      range: `스냅샷 ${mmdd(data.drivers.updatedAt.slice(0, 10))}`, count: `${fmt(data.drivers.total)}명`,
      columns: ['score_dawn·morning·daytime·night', 'score_mon … sun', 'score_short·medium·long', 'score_low·mid·high_fare', 'score_paid·free', 'score_surge·normal', 'score_near'],
      usage: '완성된 22D 기사 벡터 → 워크벤치에서 콜카드와 코사인 비교',
    },
    {
      table: 'matching_scores', desc: '콜카드별 Top 10 매칭 결과', accent: '#4ade80',
      range: rangeLabel(data.matches.minDate, data.matches.maxDate), count: `${fmt(data.matches.total)}건`,
      columns: ['call_id', 'driver_id', 'rank_in_call', 'cosine_score'],
      usage: '코사인 결과(output) → 워크벤치 후보 랭킹 · 매칭 스튜디오 Top 10',
    },
  ]

  // How callcard_mbti columns become the 22D axes (callToVector binning rules).
  const BINNING = [
    { col: 'hour_slot', rule: '≤5 새벽 · 6–11 오전 · 12–17 주간 · ≥18 야간', axis: '시간대 4' },
    { col: 'weekday', rule: '0–6 요일 one-hot', axis: '요일 7' },
    { col: 'expected_distance', rule: '≤3km · 3–8km · >8km', axis: '거리 3' },
    { col: 'expected_fare', rule: '≤1만 · 1–2만 · >2만', axis: '요금 3' },
    { col: 'is_paid', rule: '유료 / 무료(=!paid)', axis: '콜유형 2' },
    { col: 'is_surge', rule: '탄력 / 일반(=!surge)', axis: '상품 2' },
    { col: 'eta_distance', rule: '근접성 0~1 · 매칭 제외', axis: 'ETA 1' },
    { col: 's_hexagon · d_hexagon', rule: 'H3 격자 매칭', axis: '공간 H3 · 별도 25%' },
  ]

  const PIPELINE_STEPS = [
    {
      title: '호출 원천',
      table: 'callcard_mbti',
      metric: `${fmt(data.calls.total)}건`,
      note: '시간 · 요일 · 거리 · 요금 · 상품 정보를 콜카드 벡터로 변환',
      accent: '#22d3ee',
    },
    {
      title: '기사 행동 집계',
      table: 'driver_daily_logs',
      metric: driverLogsCount,
      note: '기사별 수락 패턴을 모아 22개 성향 축의 입력값으로 사용',
      accent: '#fbbf24',
    },
    {
      title: '22D 기사 벡터',
      table: 'driver_mbti',
      metric: `${fmt(data.drivers.total)}명`,
      note: '집계된 행동을 시간 · 요일 · 거리 · 요금 · 상품 성향 점수로 저장',
      accent: '#a78bfa',
    },
    {
      title: 'Top 10 매칭',
      table: 'matching_scores',
      metric: `${fmt(data.matches.total)}건`,
      note: '콜카드 벡터와 기사 벡터를 비교해 후보 랭킹을 저장',
      accent: '#4ade80',
    },
  ]

  return (
    <div className="data-ops-view" style={{ maxWidth: '1560px', margin: '0 auto', padding: '22px 22px 32px' }}>
      <style>{`
        @media (max-width: 900px) {
          .data-ops-view {
            padding: 18px 16px 28px !important;
            overflow-x: hidden;
          }
          .data-ops-title {
            align-items: flex-start !important;
            flex-direction: column;
            gap: 12px;
          }
          .kpi-grid,
          .date-diagnostics-grid,
          .pipeline-summary-grid,
          .pipeline-detail-grid {
            grid-template-columns: 1fr !important;
          }
          .kpi-card {
            min-width: 0;
          }
          .kpi-value {
            font-size: 34px !important;
            overflow-wrap: normal;
            white-space: nowrap;
          }
          .heatmap-header {
            align-items: flex-start !important;
            flex-direction: column;
            gap: 10px;
          }
          .pipeline-strip {
            justify-content: flex-start !important;
          }
          .data-flow-visual {
            grid-template-columns: 1fr !important;
          }
          .data-flow-svg {
            min-height: 260px;
          }
        }
        @keyframes dataPulse {
          from { stroke-dashoffset: 120; opacity: .25; }
          50% { opacity: .95; }
          to { stroke-dashoffset: 0; opacity: .25; }
        }
        @keyframes nodeGlow {
          0%, 100% { transform: scale(.96); opacity: .72; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes dataScan {
          from { transform: translateX(-22%); opacity: .12; }
          45% { opacity: .62; }
          to { transform: translateX(122%); opacity: .12; }
        }
        .data-flow-stage {
          position: relative;
          background:
            radial-gradient(circle at 22% 18%, rgba(34,211,238,.13), transparent 34%),
            radial-gradient(circle at 74% 72%, rgba(167,139,250,.11), transparent 36%),
            linear-gradient(150deg, rgba(8,13,23,.92), rgba(4,7,14,.98));
        }
        .data-flow-stage::after {
          content: '';
          position: absolute;
          inset: -30% auto -30% 0;
          width: 34%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent);
          transform: translateX(-22%);
          animation: dataScan 5.6s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>
      {/* Page title */}
      <div className="data-ops-title" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <h1 style={{ fontSize: '31px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>데이터 운영 콘솔</h1>
          <p style={{ fontSize: '16px', color: '#8b98ae', margin: 0 }}>AI 우선배차 검증에 필요한 데이터가 어디까지 적재됐는가</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#7ee0a3', background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.22)', borderRadius: '9px', padding: '8px 13px', flexShrink: 0 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', display: 'inline-block', flexShrink: 0 }} />
          마지막 적재 확인 · {mmdd(data.calls.maxDate)} KST
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px', marginBottom: '16px' }}>
        <KpiCard
          dot={{ borderRadius: '2px', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee' }}
          label="호출데이터" value={fmt(data.calls.total)} unit=" 건"
          range={rangeLabel(data.calls.minDate, data.calls.maxDate)}
          status={`${callDays}일 · 연속`} statusColor="#7ee0a3"
          cardBorder="rgba(148,163,184,.13)"
        />
        <KpiCard
          dot={{ borderRadius: '2px', background: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }}
          label="앱미터데이터" value={fmt(data.meter.total)} unit=" 건"
          range={rangeLabel(data.meter.minDate, data.meter.maxDate)}
          status={`${meterDays}일 · 부분`} statusColor="#fbbf24"
          cardBorder="rgba(251,191,36,.22)"
        />
        <KpiCard
          dot={{ borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 8px #a78bfa' }}
          label="기사 벡터" value={fmt(data.drivers.total)} unit=" 명"
          range="driver_mbti 22D" status="생성 완료" statusColor="#c3acff"
          cardBorder="rgba(167,139,250,.22)"
        />
        <KpiCard
          dot={{ borderRadius: '2px', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }}
          label="매칭 결과" value={fmt(data.matches.total)} unit=" 건"
          range="Top 10 / 콜카드" status="저장 완료" statusColor="#7ee0a3"
          cardBorder="rgba(148,163,184,.13)"
        />
      </div>

      <section className="data-flow-stage" style={{ borderRadius: '18px', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 26px 70px rgba(0,0,0,.52)', padding: '18px 20px', marginBottom: '13px', overflow: 'hidden' }}>
        <div className="data-flow-visual" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '18px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>데이터 적재 흐름</h2>
              <span style={{ fontSize: '14px', color: '#8b98ae' }}>콜 원천, 기사 행동 로그, 22D 기사 벡터, 매칭 결과가 한 흐름으로 이어지는지 확인합니다.</span>
            </div>
            <svg className="data-flow-svg" viewBox="0 0 980 300" style={{ width: '100%', height: '300px', display: 'block' }} role="img" aria-label="데이터 적재 흐름도">
              <defs>
                <linearGradient id="dataFlowLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity=".25" />
                  <stop offset="48%" stopColor="#a78bfa" stopOpacity=".9" />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity=".72" />
                </linearGradient>
                <filter id="dataGlow">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect x="34" y="28" width="890" height="226" rx="26" fill="rgba(255,255,255,.025)" stroke="rgba(148,163,184,.10)" />
              {Array.from({ length: 12 }).map((_, i) => <line key={i} x1={70 + i * 72} y1="46" x2={70 + i * 72} y2="238" stroke="rgba(148,163,184,.045)" />)}
              {Array.from({ length: 5 }).map((_, i) => <line key={i} x1="54" y1={66 + i * 36} x2="914" y2={66 + i * 36} stroke="rgba(148,163,184,.04)" />)}
              <path d="M120 150 C245 62 330 62 455 150 S665 238 795 150" fill="none" stroke="rgba(148,163,184,.12)" strokeWidth="18" strokeLinecap="round" />
              <path d="M120 150 C245 62 330 62 455 150 S665 238 795 150" fill="none" stroke="url(#dataFlowLine)" strokeWidth="7" strokeLinecap="round" strokeDasharray="22 18" style={{ animation: 'dataPulse 3.4s linear infinite' }} filter="url(#dataGlow)" />
              {[
                { x: 120, y: 150, label: 'callcard_mbti', sub: fmt(data.calls.total), c: '#22d3ee' },
                { x: 345, y: 90, label: 'driver_daily_logs', sub: driverLogsCount, c: '#fbbf24' },
                { x: 585, y: 210, label: 'driver_mbti', sub: fmt(data.drivers.total), c: '#a78bfa' },
                { x: 795, y: 150, label: 'matching_scores', sub: fmt(data.matches.total), c: '#4ade80' },
              ].map((node, i) => (
                <g key={node.label} style={{ transformOrigin: `${node.x}px ${node.y}px`, animation: `nodeGlow ${2.2 + i * .2}s ease-in-out infinite` }}>
                  <circle cx={node.x} cy={node.y} r="46" fill="rgba(10,15,25,.92)" stroke={node.c} strokeOpacity=".55" strokeWidth="2" />
                  <circle cx={node.x} cy={node.y} r="26" fill={node.c} fillOpacity=".12" stroke={node.c} strokeOpacity=".32" />
                  <text x={node.x} y={node.y - 4} textAnchor="middle" fill="#e8edf6" fontSize="14" fontWeight="800" fontFamily="Pretendard, sans-serif">{node.label}</text>
                  <text x={node.x} y={node.y + 18} textAnchor="middle" fill={node.c} fontSize="15" fontWeight="800" fontFamily="JetBrains Mono, monospace">{node.sub}</text>
                </g>
              ))}
            </svg>
          </div>
          <aside style={{ borderRadius: '14px', background: 'rgba(20,28,42,.48)', border: '1px solid rgba(148,163,184,.12)', padding: '16px 17px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 10px', color: '#e8edf6' }}>한눈에 볼 것</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <DataFlowCheck color="#22d3ee" title="콜 원천 적재" desc={`${rangeLabel(data.calls.minDate, data.calls.maxDate)} / ${fmt(data.calls.total)}건`} />
              <DataFlowCheck color="#fbbf24" title="기사 행동 로그" desc={driverLogs ? `${driverLogsRange} / ${driverLogsCount}` : '집계 원천 확인 필요'} />
              <DataFlowCheck color="#a78bfa" title="22D 기사 벡터" desc={`${fmt(data.drivers.total)}명 생성 완료`} />
              <DataFlowCheck color="#4ade80" title="매칭 결과 저장" desc={`${fmt(data.matches.total)}건 / Top 10 후보`} />
            </div>
          </aside>
        </div>
      </section>

      {/* Date connectivity + diagnostics */}
      <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '18px 20px', marginBottom: '13px' }}>
        <div className="date-diagnostics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '18px', alignItems: 'start' }}>
          <div>
          <div className="heatmap-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>날짜별 연결 상태</h2>
              <span style={{ fontSize: '14px', color: '#8b98ae' }}>호출 · 앱미터 · 매칭 데이터가 날짜별로 연결되는지</span>
            </div>
            <div style={{ display: 'flex', gap: '13px' }}>
              <LegendDot color="#3ba776" label="있음" />
              <LegendDot color="#b78a2e" label="부분" />
              <LegendDot color="rgba(148,163,184,.18)" label="상세 미지원" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {CAL_ROWS.map((row) => (
              <div key={row.sub} style={{ display: 'grid', gridTemplateColumns: '104px 1fr', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#dbe3f0' }}>{row.name}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: '#7c89a0' }}>{row.sub}</span>
                </div>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {row.cells.map((cell, i) => (
                    <div key={i} title={cell.title} style={{ flex: 1, height: '34px', borderRadius: '4px', background: cell.bg, border: cell.border }} />
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: '12px', marginTop: '2px' }}>
              <span />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: '#6b778d' }}>
                {CAL_AXIS.map(l => <span key={l}>{l}</span>)}
              </div>
            </div>
          </div>
          </div>
          <aside style={{ borderRadius: '14px', background: 'rgba(251,191,36,.055)', border: '1px solid rgba(251,191,36,.18)', padding: '14px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '11px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '7px', background: 'rgba(251,191,36,.16)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>!</span>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fbd77a', margin: 0 }}>확인 필요</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#e8edf6' }}>앱미터 날짜별 상세 미지원</span>
                  <span style={{ fontSize: '14px', color: '#9aa7bd' }}>{mmdd(data.meter.minDate)} 이전 구간은 날짜별 건수를 분해할 수 없음. 정상 완료로 표시하지 않음.</span>
                </div>
                <div style={{ height: '1px', background: 'rgba(251,191,36,.14)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#e8edf6' }}>앱미터 적재량 {fmt(data.meter.total)}건</span>
                  <span style={{ fontSize: '14px', color: '#9aa7bd' }}>호출 {fmt(data.calls.total)}건 대비 표본이 작음. 검증 결과 해석 시 주의.</span>
                </div>
              </div>
          </aside>
        </div>
      </section>

      {/* Full-width band: data sources → 22D vector pipeline */}
      <section style={{ borderRadius: '18px', background: 'rgba(9,14,23,.72)', border: '1px solid rgba(148,163,184,.13)', boxShadow: '0 22px 52px rgba(0,0,0,.45)', padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>데이터 → 22D 벡터 파이프라인</h2>
            <span style={{ fontSize: '14px', color: '#8b98ae' }}>기본 화면은 흐름만 보여주고, 컬럼과 변환 규칙은 필요할 때 펼쳐봅니다.</span>
          </div>
          {/* Pipeline strip */}
          <div className="pipeline-strip" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13px', fontWeight: 600 }}>
            {['원천 컬럼', '22D 벡터화', '임베딩 · 코사인', '매칭 Top 10'].map((step, i) => (
              <span key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ padding: '4px 10px', borderRadius: '999px', background: 'rgba(34,211,238,.1)', border: '1px solid rgba(34,211,238,.22)', color: '#5ce0f0' }}>{step}</span>
                {i < 3 ? <span style={{ color: '#5a6680' }}>→</span> : null}
              </span>
            ))}
          </div>
        </div>

        <div className="pipeline-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '14px' }}>
          {PIPELINE_STEPS.map((step) => (
            <div key={step.table} style={{ minHeight: '150px', borderRadius: '12px', background: 'rgba(16,22,35,.45)', border: '1px solid rgba(148,163,184,.1)', borderTop: `2px solid ${step.accent}`, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8edf6' }}>{step.title}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: step.accent }}>{step.table}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '19px', fontWeight: 700, color: '#dbe3f0' }}>{step.metric}</span>
              <span style={{ fontSize: '13px', lineHeight: 1.45, color: '#8b98ae' }}>{step.note}</span>
            </div>
          ))}
        </div>

        <details style={{ borderRadius: '13px', background: 'rgba(16,22,35,.34)', border: '1px solid rgba(148,163,184,.1)', padding: '0 15px' }}>
          <summary style={{ cursor: 'pointer', padding: '13px 0', color: '#cdd6e6', fontSize: '14px', fontWeight: 700 }}>
            컬럼과 22D 변환 규칙 자세히 보기
          </summary>
          <div className="pipeline-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start', padding: '0 0 15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {CATALOG.map((s) => (
              <div key={s.table} style={{ borderLeft: `2px solid ${s.accent}`, background: 'rgba(16,22,35,.45)', borderRadius: '0 11px 11px 0', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '15px', fontWeight: 600, color: s.accent }}>{s.table}</span>
                    <span style={{ fontSize: '13px', color: '#7c89a0' }}>{s.desc}</span>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: '#9aa7bd', flexShrink: 0 }}>{s.range} · {s.count}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '46px 1fr', gap: '10px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b778d' }}>컬럼</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12.5px', color: '#aab6c8', lineHeight: 1.7 }}>{s.columns.join('  ·  ')}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '46px 1fr', gap: '10px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '13px', color: s.accent, fontWeight: 700 }}>활용</span>
                  <span style={{ fontSize: '14px', color: '#9aa7bd' }}>{s.usage}</span>
                </div>
              </div>
              ))}
            </div>

            <div style={{ borderRadius: '12px', background: 'rgba(34,211,238,.05)', border: '1px solid rgba(34,211,238,.18)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#5ce0f0' }}>callcard_mbti 컬럼 → 22D 축 변환</h3>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: '#7c89a0' }}>4+7+3+3+2+2+1 = 22D</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {BINNING.map((b) => (
                  <div key={b.col} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 118px', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13.5px', color: '#cdd6e6' }}>{b.col}</span>
                    <span style={{ fontSize: '14px', color: '#9aa7bd' }}>{b.rule}</span>
                    <span style={{ justifySelf: 'end', fontSize: '13px', fontWeight: 700, color: '#5ce0f0', background: 'rgba(34,211,238,.1)', border: '1px solid rgba(34,211,238,.22)', borderRadius: '6px', padding: '3px 9px' }}>{b.axis}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '13px', color: '#7c89a0', margin: '12px 0 0' }}>기사 쪽도 동일한 22축 — driver_daily_logs의 수락 행동을 집계해 driver_mbti.score_*로 학습합니다.</p>
            </div>
          </div>
        </details>
      </section>
    </div>
  )
}

// ---- Subcomponents ----
function KpiCard({ dot, label, value, unit, range, status, statusColor, cardBorder }: {
  dot: CSSProperties; label: string; value: string; unit: string
  range: string; status: string; statusColor: string; cardBorder: string
}) {
  return (
    <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '17px 19px', borderRadius: '16px', background: 'rgba(10,15,25,.7)', border: `1px solid ${cardBorder}`, boxShadow: '0 18px 44px rgba(0,0,0,.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '8px', height: '8px', display: 'inline-block', flexShrink: 0, ...dot }} />
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#9aa7bd' }}>{label}</span>
      </div>
      <span className="kpi-value" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '38px', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}<span style={{ fontSize: '15px', color: '#8b98ae', fontWeight: 500 }}>{unit}</span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', color: '#8b98ae' }}>{range}</span>
        <span style={{ fontSize: '13px', color: statusColor, fontWeight: 600 }}>{status}</span>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontSize: '13px', color: '#9aa7bd' }}>{label}</span>
    </div>
  )
}

function DataFlowCheck({ color, title, desc }: { color: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: '10px', alignItems: 'start' }}>
      <span style={{ width: '10px', height: '10px', marginTop: '5px', borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}`, display: 'inline-block' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8edf6' }}>{title}</span>
        <span style={{ fontSize: '14px', color: '#9aa7bd', lineHeight: 1.45 }}>{desc}</span>
      </div>
    </div>
  )
}
