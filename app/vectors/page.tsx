'use client'

import { PrimaryNav } from '@/app/components/PrimaryNav'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  VECTOR_DIMENSIONS,
  callToVector,
  cosineSimilarity,
  driverToVector,
  type DriverVectorRow,
} from '@/lib/matching-vector'
import {
  DISPLAY_AXES,
  getDisplayAxisFactors,
  vectorToDisplayAxisBundle,
} from '@/lib/matching-display-axis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'preview-build-key',
)

type CallRow = {
  callcard_id: string
  asp_id: number
  call_date: string
  hour_slot: number
  weekday: number
  expected_distance: number
  expected_fare: number
  is_paid: boolean
  is_surge: boolean
  eta_distance: number | null
  product_type: string | null
}

type DriverRow = DriverVectorRow & {
  driver_id: string
  asp_id: number
  data_days: number | null
  reliability: number | null
}

type RankedDriver = {
  driver: DriverRow
  vector: number[]
  cosine: number
  grade: string
}

const C = {
  bg: '#050810',
  ink: '#F8FAFC',
  sub: '#B8C7DE',
  muted: '#8290A8',
  line: 'rgba(148, 163, 184, 0.22)',
  cyan: '#22D3EE',
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#FB923C',
  red: '#F43F5E',
  purple: '#8B5CF6',
} as const

const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']

const factorPurpose = [
  {
    title: '시간대',
    count: 4,
    keys: ['새벽', '오전', '주간', '야간'],
    desc: '콜이 발생한 시간대와 기사가 자주 반응한 시간대를 비교합니다.',
    color: C.purple,
  },
  {
    title: '요일',
    count: 7,
    keys: ['월', '화', '수', '목', '금', '토', '일'],
    desc: '요일별 호출 반응과 운행 패턴을 비교합니다.',
    color: C.green,
  },
  {
    title: '거리',
    count: 3,
    keys: ['단거리', '중거리', '장거리'],
    desc: '예상 운행거리와 기사 선호 거리 구간을 비교합니다.',
    color: C.orange,
  },
  {
    title: '요금·상품',
    count: 7,
    keys: ['저요금', '중요금', '고요금', '유료콜', '무료콜', '탄력', '일반'],
    desc: '요금대, 유료콜 여부, 상품 성향을 비교합니다.',
    color: C.yellow,
  },
  {
    title: '픽업 접근성',
    count: 1,
    keys: ['근접성'],
    desc: '콜카드 입력 ETA를 보조 팩터로 사용합니다. 실시간 기사 위치는 아직 포함하지 않습니다.',
    color: C.cyan,
  },
] as const

const coreModelCards = [
  {
    step: '01',
    title: '콜카드 팩터',
    value: '현재 요청 조건',
    desc: '시간대, 요일, 거리, 요금, 상품, ETA 조건을 22개 점수로 변환합니다.',
    color: C.cyan,
  },
  {
    step: '02',
    title: '기사 팩터',
    value: '누적 운행패턴',
    desc: 'driver_mbti에 저장된 기사별 반응·운행 성향을 같은 22개 점수로 읽습니다.',
    color: C.green,
  },
  {
    step: '03',
    title: '유사도 계산',
    value: '22D 코사인',
    desc: '두 벡터의 방향이 얼마나 비슷한지 계산하고, 화면에서는 5축으로 요약합니다.',
    color: C.purple,
  },
] as const

function pct(n: number | null | undefined) {
  return n == null || Number.isNaN(n) ? '-' : `${Math.round(n * 100)}%`
}

function scorePct(n: number | null | undefined) {
  return n == null || Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, Math.round(n * 100)))
}

function money(n: number | null | undefined) {
  if (n == null) return '-'
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

function meters(n: number | null | undefined) {
  if (n == null) return '-'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}km` : `${Math.round(n)}m`
}

function grade(score: number) {
  if (score >= 0.88) return 'S'
  if (score >= 0.78) return 'A'
  if (score >= 0.66) return 'B'
  if (score >= 0.54) return 'C'
  return 'D'
}

function callSummary(call?: CallRow) {
  if (!call) return '콜카드 없음'
  const weekday = weekdayLabels[call.weekday] ?? '-'
  const paid = call.is_paid ? '유료콜' : '무료콜'
  const product = call.is_surge ? '탄력' : '일반'
  return `${call.hour_slot}시 ${weekday} · ${meters(call.expected_distance)} · ${money(call.expected_fare)} · ${paid} · ${product}`
}

export default function VectorsPage() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [selectedCallId, setSelectedCallId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [selectedAxis, setSelectedAxis] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      const [callRes, driverRes] = await Promise.all([
        supabase
          .from('callcard_mbti')
          .select('callcard_id,asp_id,call_date,hour_slot,weekday,expected_distance,expected_fare,is_paid,is_surge,eta_distance,product_type')
          .order('call_date', { ascending: false })
          .limit(80),
        supabase
          .from('driver_mbti')
          .select('*')
          .order('reliability', { ascending: false })
          .limit(1500),
      ])

      if (cancelled) return
      const nextCalls = (callRes.data ?? []) as CallRow[]
      setCalls(nextCalls)
      setDrivers((driverRes.data ?? []) as DriverRow[])
      setSelectedCallId(nextCalls[0]?.callcard_id ?? '')
      setLoadError(callRes.error?.message ?? driverRes.error?.message ?? null)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const selectedCall = calls.find((row) => row.callcard_id === selectedCallId) ?? calls[0]
  const callVector = useMemo(() => (selectedCall ? callToVector(selectedCall) : []), [selectedCall])

  const ranked = useMemo<RankedDriver[]>(() => {
    if (!selectedCall || !callVector.length) return []
    return drivers
      .filter((driver) => driver.asp_id === selectedCall.asp_id)
      .map((driver) => {
        const vector = driverToVector(driver)
        const cosine = cosineSimilarity(callVector, vector)
        return { driver, vector, cosine, grade: grade(cosine) }
      })
      .sort((a, b) => b.cosine - a.cosine)
      .slice(0, 10)
  }, [drivers, selectedCall, callVector])

  useEffect(() => {
    const nextDriverId = !ranked.length
      ? ''
      : ranked.some((row) => row.driver.driver_id === selectedDriverId)
        ? null
        : ranked[0].driver.driver_id
    if (nextDriverId !== null) queueMicrotask(() => setSelectedDriverId(nextDriverId))
  }, [ranked, selectedDriverId])

  const selectedMatch = ranked.find((row) => row.driver.driver_id === selectedDriverId) ?? ranked[0]
  const selectedDriverVector = selectedMatch?.vector ?? []
  const callAxes = vectorToDisplayAxisBundle(callVector).axis
  const driverAxes = vectorToDisplayAxisBundle(selectedDriverVector).axis
  const axis = DISPLAY_AXES[selectedAxis]
  const callFactors = getDisplayAxisFactors(callVector, selectedAxis)
  const driverFactors = getDisplayAxisFactors(selectedDriverVector, selectedAxis)

  return (
    <main className="page">
      <PrimaryNav
        active="/vectors"
        title="Happycall PMO"
        subtitle="콜카드·기사 팩터리스트"
        rightSlot={<><Pill color={C.green}>실데이터</Pill><Pill color={C.cyan}>22D COSINE</Pill></>}
      />

      <section className="top-rail" aria-label="팩터리스트 핵심 지표">
        <RailMetric label="콜카드" value={selectedCall ? '1건 선택' : loading ? '조회 중' : '없음'} meta={`${calls.length.toLocaleString('ko-KR')}건 후보`} color={C.cyan} />
        <RailMetric label="후보 기사" value={`${ranked.length}명`} meta={`${drivers.length.toLocaleString('ko-KR')}명 driver_mbti`} color={C.green} />
        <RailMetric label="최고 유사도" value={pct(ranked[0]?.cosine)} meta="22D 코사인 기준" color={C.purple} />
        <RailMetric label="표시 방식" value="22D → 5축" meta="계산은 22D, 화면은 5축 요약" color={C.orange} />
      </section>

      <div className="workspace">
        <section className="hero-card">
          <div>
            <p className="eyebrow">VECTOR FACTOR LIST</p>
            <h1>콜카드 조건과 기사 운행패턴을 같은 22개 팩터로 비교합니다</h1>
            <p className="lead">
              콜카드는 현재 요청 조건을 22D로 만들고, 기사는 누적 운행패턴을 22D로 저장합니다.
              두 벡터의 방향이 얼마나 비슷한지 코사인 유사도로 계산하고, 화면에서는 5축으로 요약해 설명합니다.
            </p>
          </div>
          <div className="status-card" style={{ '--tone': loadError ? C.red : loading ? C.yellow : C.green } as CSSProperties}>
            <span>조회 상태</span>
            <strong>{loading ? '확인 중' : loadError ? '오류' : '정상'}</strong>
            <p>{loadError ?? `${calls.length.toLocaleString('ko-KR')}개 콜카드와 ${drivers.length.toLocaleString('ko-KR')}명 기사 벡터를 비교할 수 있습니다.`}</p>
          </div>
        </section>

        <section className="core-model" aria-label="팩터 계산 핵심 흐름">
          {coreModelCards.map((item) => (
            <article key={item.step} style={{ '--tone': item.color } as CSSProperties}>
              <span>{item.step}</span>
              <div>
                <h2>{item.title}</h2>
                <strong>{item.value}</strong>
                <p>{item.desc}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="factor-purpose">
          {factorPurpose.map((item) => (
            <article key={item.title} style={{ '--tone': item.color } as CSSProperties}>
              <span>{item.count}D</span>
              <h2>{item.title}</h2>
              <p>{item.desc}</p>
              <div>{item.keys.map((key) => <em key={key}>{key}</em>)}</div>
            </article>
          ))}
        </section>

        <section className="main-grid">
          <aside className="profile-panel">
            <SectionTitle label="CALLCARD" title="콜카드 팩터" />
            <select value={selectedCallId} onChange={(event) => setSelectedCallId(event.target.value)}>
              {calls.length === 0 ? (
                <option value="">{loading ? '콜카드 불러오는 중' : '조회된 콜카드 없음'}</option>
              ) : calls.map((call) => (
                <option key={call.callcard_id} value={call.callcard_id}>
                  {call.call_date} / {call.callcard_id}
                </option>
              ))}
            </select>
            <ProfileCard tone={C.cyan} label="REQUEST" score={callVector.length ? Math.round(callVector.reduce((sum, value) => sum + value, 0) * 12 + 36) : 0} badge="CALL">
              <strong>{selectedCall?.callcard_id ?? '-'}</strong>
              <p>{callSummary(selectedCall)}</p>
              <MiniGrid items={[
                ['거리', meters(selectedCall?.expected_distance)],
                ['요금', money(selectedCall?.expected_fare)],
                ['ETA', selectedCall?.eta_distance == null ? '-' : `${Math.round(selectedCall.eta_distance)}초`],
                ['상품', selectedCall?.is_surge ? '탄력' : '일반'],
              ]} />
            </ProfileCard>
            <AxisBars title="콜카드 5축" axis={callAxes} tone={C.cyan} />
          </aside>

          <section className="comparison-stage">
            <SectionTitle label="CORE" title="22D 팩터 비교" />
            <div className="match-summary">
              <div>
                <span>현재 비교</span>
                <h2>{selectedCall?.callcard_id ?? '-'} ↔ {selectedMatch?.driver.driver_id ?? '-'}</h2>
              </div>
              <strong>{pct(selectedMatch?.cosine)}</strong>
            </div>
            <FactorMatrix callVector={callVector} driverVector={selectedDriverVector} />
            <div className="axis-tabs">
              {DISPLAY_AXES.map((item, index) => (
                <button key={item.key} type="button" className={index === selectedAxis ? 'active' : ''} onClick={() => setSelectedAxis(index)}>
                  {item.name}
                </button>
              ))}
            </div>
            <div className="drill-card">
              <div className="drill-head">
                <span>5축 선택</span>
                <h3>{axis?.name}</h3>
              </div>
              {callFactors.map((factor, index) => {
                const driver = driverFactors[index]
                return (
                  <CompareRow
                    key={factor.key}
                    label={`${factor.group} · ${factor.label}`}
                    callScore={factor.score ?? 0}
                    driverScore={driver?.score ?? 0}
                  />
                )
              })}
            </div>
          </section>

          <aside className="profile-panel">
            <SectionTitle label="DRIVER" title="기사 능력치" />
            <DriverList ranked={ranked} selectedDriverId={selectedDriverId} onSelect={setSelectedDriverId} />
            <ProfileCard tone={C.green} label="CANDIDATE" score={selectedMatch ? Math.round(selectedMatch.cosine * 100) : 0} badge={selectedMatch?.grade ?? '-'}>
              <strong>{selectedMatch?.driver.driver_id ?? '선택 기사 없음'}</strong>
              <p>누적 데이터 {selectedMatch?.driver.data_days ?? '-'}일 · 신뢰도 {pct(selectedMatch?.driver.reliability)}</p>
              <MiniGrid items={[
                ['유사도', pct(selectedMatch?.cosine)],
                ['신뢰도', pct(selectedMatch?.driver.reliability)],
                ['ASP', selectedMatch?.driver.asp_id == null ? '-' : String(selectedMatch.driver.asp_id)],
                ['등급', selectedMatch?.grade ?? '-'],
              ]} />
            </ProfileCard>
            <AxisBars title="기사 5축" axis={driverAxes} tone={C.green} />
          </aside>
        </section>

        <section className="formula-card">
          <div>
            <p className="eyebrow">COSINE FORMULA</p>
            <h2>코사인 유사도 = 콜카드 22D와 기사 22D의 방향 유사성</h2>
          </div>
          <code>similarity = dot(callVector, driverVector) / (|callVector| × |driverVector|)</code>
          <p>
            유사도는 기사에게 콜을 반드시 보내라는 결정값이 아니라, 기존 배차 후보군 안에서 “누가 이 콜을 더 잘 받을 가능성이 있는가”를 정렬하는 기준입니다.
          </p>
        </section>
      </div>

      <style jsx>{pageCss}</style>
    </main>
  )
}

function Pill({ children, color }: { children: string; color: string }) {
  return <span className="pill" style={{ '--tone': color } as CSSProperties}>{children}</span>
}

function RailMetric({ label, value, meta, color }: { label: string; value: string; meta: string; color: string }) {
  return (
    <div className="rail-metric">
      <span>{label}</span>
      <b style={{ color }}>{value}</b>
      <em>{meta}</em>
    </div>
  )
}

function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="section-title">
      <span>{label}</span>
      <h2>{title}</h2>
    </div>
  )
}

function ProfileCard({ tone, label, score, badge, children }: { tone: string; label: string; score: number; badge: string; children: React.ReactNode }) {
  return (
    <div className="profile-card" style={{ '--tone': tone } as CSSProperties}>
      <div className="profile-top">
        <div>
          <span>{label}</span>
          <b>{score}</b>
        </div>
        <strong>{badge}</strong>
      </div>
      {children}
    </div>
  )
}

function MiniGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="mini-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  )
}

function DriverList({ ranked, selectedDriverId, onSelect }: { ranked: RankedDriver[]; selectedDriverId: string; onSelect: (id: string) => void }) {
  return (
    <div className="driver-list">
      {ranked.length === 0 ? (
        <div className="empty">추천 후보가 없습니다.</div>
      ) : ranked.slice(0, 5).map((row, index) => (
        <button key={row.driver.driver_id} type="button" className={row.driver.driver_id === selectedDriverId ? 'active' : ''} onClick={() => onSelect(row.driver.driver_id)}>
          <span>#{index + 1}</span>
          <b>{row.driver.driver_id}</b>
          <strong>{pct(row.cosine)}</strong>
        </button>
      ))}
    </div>
  )
}

function AxisBars({ title, axis, tone }: { title: string; axis: number[]; tone: string }) {
  return (
    <div className="axis-box">
      <h3>{title}</h3>
      {DISPLAY_AXES.map((item, index) => (
        <div key={item.key} className="axis-row">
          <span>{item.name}</span>
          <i><em style={{ width: `${axis[index] ?? 0}%`, background: tone }} /></i>
          <b>{Math.round(axis[index] ?? 0)}</b>
        </div>
      ))}
    </div>
  )
}

function FactorMatrix({ callVector, driverVector }: { callVector: number[]; driverVector: number[] }) {
  return (
    <div className="matrix">
      {VECTOR_DIMENSIONS.map((dimension, index) => {
        const callScore = scorePct(callVector[index])
        const driverScore = scorePct(driverVector[index])
        const gap = Math.abs(callScore - driverScore)
        return (
          <div key={dimension.key} className="matrix-cell">
            <span>{dimension.group}</span>
            <b>{dimension.label}</b>
            <div className="dual">
              <i><em style={{ width: `${callScore}%`, background: C.cyan }} /></i>
              <i><em style={{ width: `${driverScore}%`, background: C.green }} /></i>
            </div>
            <strong style={{ color: gap <= 20 ? C.green : gap <= 50 ? C.yellow : C.orange }}>{100 - gap}</strong>
          </div>
        )
      })}
    </div>
  )
}

function CompareRow({ label, callScore, driverScore }: { label: string; callScore: number; driverScore: number }) {
  return (
    <div className="compare-row">
      <b>{label}</b>
      <div><span>콜</span><i><em style={{ width: `${callScore}%`, background: C.cyan }} /></i><strong>{Math.round(callScore)}</strong></div>
      <div><span>기사</span><i><em style={{ width: `${driverScore}%`, background: C.green }} /></i><strong>{Math.round(driverScore)}</strong></div>
    </div>
  )
}

const pageCss = `
  .page {
    min-height: 100vh;
    color: ${C.ink};
    background:
      linear-gradient(90deg, rgba(34, 211, 238, 0.045) 1px, transparent 1px),
      linear-gradient(180deg, rgba(34, 211, 238, 0.035) 1px, transparent 1px),
      radial-gradient(circle at 18% 12%, rgba(34, 211, 238, 0.14), transparent 30rem),
      radial-gradient(circle at 82% 14%, rgba(139, 92, 246, 0.12), transparent 28rem),
      ${C.bg};
    background-size: 72px 72px, 72px 72px, auto, auto, auto;
    font-family: Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 20px;
  }
  .pill {
    min-height: 44px;
    display: inline-grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--tone) 45%, transparent);
    border-radius: 14px;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 14%, transparent);
    padding: 0 14px;
    font-size: 16px;
    font-weight: 950;
  }
  .top-rail {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-bottom: 1px solid ${C.line};
    background: rgba(5, 8, 16, 0.88);
  }
  .rail-metric {
    min-width: 0;
    border-right: 1px solid ${C.line};
    padding: 18px 24px;
    display: grid;
    gap: 4px;
  }
  .rail-metric span {
    color: ${C.muted};
    font-size: 20px;
    font-weight: 900;
  }
  .rail-metric b {
    font-size: clamp(30px, 2.5vw, 46px);
    line-height: 1;
    font-weight: 950;
    white-space: nowrap;
  }
  .rail-metric em {
    color: ${C.sub};
    font-size: 19px;
    font-style: normal;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .workspace {
    max-width: 1780px;
    margin: 0 auto;
    padding: 28px;
    display: grid;
    gap: 22px;
  }
  .hero-card,
  .profile-panel,
  .comparison-stage,
  .formula-card,
  .core-model article,
  .factor-purpose article {
    border: 1px solid ${C.line};
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.8), rgba(5, 8, 16, 0.88));
    box-shadow: 0 28px 90px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .hero-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 24px;
    padding: 32px;
  }
  .eyebrow,
  .section-title span {
    color: ${C.cyan};
    font-size: 20px;
    font-weight: 950;
    letter-spacing: 0;
    margin-bottom: 10px;
  }
  h1, h2, h3, p {
    margin: 0;
  }
  h1 {
    max-width: 980px;
    font-size: clamp(40px, 3.2vw, 64px);
    line-height: 1.06;
    font-weight: 950;
  }
  .lead,
  .status-card p,
  .formula-card p {
    margin-top: 16px;
    color: ${C.sub};
    font-size: 22px;
    line-height: 1.5;
    font-weight: 750;
  }
  .status-card {
    border: 1px solid color-mix(in srgb, var(--tone) 45%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--tone) 10%, transparent);
    padding: 24px;
  }
  .status-card span {
    color: ${C.sub};
    font-size: 20px;
    font-weight: 900;
  }
  .status-card strong {
    display: block;
    color: var(--tone);
    font-size: 54px;
    line-height: 1;
    font-weight: 950;
    margin-top: 10px;
  }
  .factor-purpose {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
  }
  .core-model {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .core-model article {
    display: grid;
    grid-template-columns: 70px minmax(0, 1fr);
    gap: 18px;
    align-items: start;
    padding: 24px;
    border-color: color-mix(in srgb, var(--tone) 42%, transparent);
    background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 12%, transparent), rgba(15, 23, 42, 0.72));
  }
  .core-model span {
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    color: var(--tone);
    background: rgba(5, 8, 16, 0.72);
    border: 1px solid color-mix(in srgb, var(--tone) 48%, transparent);
    font-size: 24px;
    font-weight: 950;
  }
  .core-model h2 {
    font-size: 28px;
    line-height: 1.1;
  }
  .core-model strong {
    display: block;
    margin-top: 8px;
    color: var(--tone);
    font-size: 34px;
    line-height: 1.05;
    font-weight: 950;
  }
  .core-model p {
    margin-top: 10px;
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.42;
    font-weight: 700;
  }
  .factor-purpose article {
    padding: 22px;
    border-color: color-mix(in srgb, var(--tone) 35%, ${C.line});
  }
  .factor-purpose span {
    color: var(--tone);
    font-size: 24px;
    font-weight: 950;
  }
  .factor-purpose h2 {
    margin-top: 10px;
    font-size: 28px;
  }
  .factor-purpose p {
    min-height: 90px;
    margin-top: 10px;
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.42;
  }
  .factor-purpose div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .factor-purpose em {
    border-radius: 999px;
    color: ${C.ink};
    background: rgba(255,255,255,.06);
    padding: 6px 10px;
    font-size: 18px;
    font-style: normal;
    font-weight: 850;
  }
  .main-grid {
    display: grid;
    grid-template-columns: minmax(320px, .85fr) minmax(620px, 1.55fr) minmax(340px, .95fr);
    gap: 20px;
    align-items: start;
  }
  .profile-panel,
  .comparison-stage,
  .formula-card {
    padding: 24px;
  }
  .section-title h2 {
    font-size: 34px;
    line-height: 1.1;
    font-weight: 950;
  }
  select {
    width: 100%;
    min-height: 58px;
    margin-top: 18px;
    border: 1px solid ${C.line};
    border-radius: 14px;
    color: ${C.ink};
    background: #08101F;
    padding: 0 16px;
    font-size: 20px;
    font-weight: 850;
  }
  .profile-card,
  .axis-box,
  .drill-card {
    margin-top: 18px;
    border: 1px solid color-mix(in srgb, var(--tone, ${C.cyan}) 35%, ${C.line});
    border-radius: 10px;
    background: color-mix(in srgb, var(--tone, ${C.cyan}) 8%, transparent);
    padding: 20px;
  }
  .profile-top {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: center;
  }
  .profile-top span {
    color: var(--tone);
    font-size: 20px;
    font-weight: 950;
  }
  .profile-top b {
    display: block;
    color: ${C.ink};
    font-size: 54px;
    line-height: .95;
    font-weight: 950;
  }
  .profile-top strong {
    width: 88px;
    height: 88px;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--tone) 45%, transparent);
    border-radius: 24px;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 14%, transparent);
    font-size: 34px;
    font-weight: 950;
  }
  .profile-card > strong {
    display: block;
    margin-top: 14px;
    color: ${C.ink};
    font-size: 24px;
    font-weight: 950;
    overflow-wrap: anywhere;
  }
  .profile-card p {
    margin-top: 8px;
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.4;
  }
  .mini-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 16px;
  }
  .mini-grid div {
    min-width: 0;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 12px;
    background: rgba(5,8,16,.42);
    padding: 12px;
  }
  .mini-grid span,
  .axis-row span,
  .compare-row span {
    color: ${C.muted};
    font-size: 19px;
    font-weight: 900;
  }
  .mini-grid b {
    display: block;
    margin-top: 4px;
    font-size: 21px;
    overflow-wrap: anywhere;
  }
  .axis-box {
    --tone: ${C.cyan};
  }
  .axis-box h3,
  .drill-head h3 {
    font-size: 25px;
    margin-bottom: 14px;
  }
  .axis-row {
    display: grid;
    grid-template-columns: minmax(150px, 1fr) minmax(120px, 1.2fr) 46px;
    gap: 10px;
    align-items: center;
    margin-top: 12px;
  }
  .axis-row i,
  .compare-row i,
  .dual i {
    height: 14px;
    border-radius: 999px;
    background: #1B2740;
    overflow: hidden;
  }
  .axis-row em,
  .compare-row em,
  .dual em {
    display: block;
    height: 100%;
    border-radius: inherit;
  }
  .axis-row b {
    text-align: right;
    font-size: 20px;
  }
  .match-summary {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 18px;
    align-items: end;
    border: 1px solid rgba(34,211,238,.26);
    border-radius: 10px;
    background: rgba(34,211,238,.06);
    padding: 20px;
    margin-top: 18px;
  }
  .match-summary span {
    color: ${C.sub};
    font-size: 20px;
    font-weight: 900;
  }
  .match-summary h2 {
    margin-top: 8px;
    font-size: clamp(30px, 2.2vw, 42px);
    overflow-wrap: anywhere;
  }
  .match-summary strong {
    color: ${C.cyan};
    font-size: clamp(52px, 4vw, 82px);
    line-height: .9;
    font-weight: 950;
  }
  .matrix {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 10px;
    margin-top: 18px;
  }
  .matrix-cell {
    min-width: 0;
    border: 1px solid ${C.line};
    border-radius: 10px;
    background: rgba(255,255,255,.028);
    padding: 12px;
  }
  .matrix-cell span {
    color: ${C.muted};
    font-size: 17px;
    font-weight: 900;
  }
  .matrix-cell b {
    display: block;
    margin-top: 4px;
    font-size: 20px;
  }
  .dual {
    display: grid;
    gap: 6px;
    margin-top: 12px;
  }
  .matrix-cell strong {
    display: block;
    margin-top: 10px;
    font-size: 24px;
  }
  .axis-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }
  .axis-tabs button {
    min-height: 52px;
    border: 1px solid ${C.line};
    border-radius: 14px;
    color: ${C.sub};
    background: rgba(255,255,255,.035);
    padding: 0 16px;
    font-size: 20px;
    font-weight: 950;
    cursor: pointer;
  }
  .axis-tabs button.active {
    color: ${C.bg};
    border-color: ${C.cyan};
    background: ${C.cyan};
  }
  .drill-card {
    --tone: ${C.cyan};
  }
  .drill-head span {
    color: ${C.muted};
    font-size: 20px;
    font-weight: 900;
  }
  .compare-row {
    border-top: 1px solid ${C.line};
    padding-top: 14px;
    margin-top: 14px;
    display: grid;
    grid-template-columns: minmax(180px, .8fr) 1fr 1fr;
    gap: 16px;
    align-items: center;
  }
  .compare-row > b {
    font-size: 21px;
  }
  .compare-row div {
    display: grid;
    grid-template-columns: 52px 1fr 42px;
    gap: 10px;
    align-items: center;
  }
  .compare-row strong {
    text-align: right;
    font-size: 20px;
  }
  .driver-list {
    display: grid;
    gap: 10px;
    margin-top: 18px;
  }
  .driver-list button {
    min-width: 0;
    min-height: 68px;
    border: 1px solid ${C.line};
    border-radius: 14px;
    color: ${C.ink};
    background: rgba(255,255,255,.028);
    padding: 12px;
    display: grid;
    grid-template-columns: 54px 1fr auto;
    gap: 10px;
    align-items: center;
    text-align: left;
    cursor: pointer;
  }
  .driver-list button.active {
    border-color: ${C.green};
    background: rgba(16,185,129,.09);
  }
  .driver-list span {
    color: ${C.orange};
    font-size: 20px;
    font-weight: 950;
  }
  .driver-list b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 21px;
  }
  .driver-list strong {
    color: ${C.cyan};
    font-size: 24px;
  }
  .empty {
    border: 1px dashed ${C.line};
    border-radius: 14px;
    padding: 18px;
    color: ${C.sub};
    font-size: 20px;
  }
  .formula-card {
    display: grid;
    grid-template-columns: 1fr minmax(360px, .8fr);
    gap: 20px;
    align-items: center;
  }
  .formula-card h2 {
    font-size: clamp(30px, 2.2vw, 44px);
  }
  .formula-card code {
    border: 1px solid rgba(34,211,238,.28);
    border-radius: 10px;
    color: ${C.cyan};
    background: rgba(34,211,238,.08);
    padding: 20px;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 21px;
    font-weight: 850;
    overflow-wrap: anywhere;
  }
  .formula-card p {
    grid-column: 1 / -1;
  }
  @media (max-width: 1380px) {
    .factor-purpose {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .main-grid {
      grid-template-columns: 1fr 1fr;
    }
    .comparison-stage {
      grid-column: 1 / -1;
      order: -1;
    }
    .matrix {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  @media (max-width: 920px) {
    .top-rail,
    .hero-card,
    .main-grid,
    .formula-card {
      grid-template-columns: 1fr;
    }
    .factor-purpose {
      grid-template-columns: 1fr;
    }
    .matrix {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .compare-row {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 620px) {
    .workspace {
      padding: 16px;
    }
    .matrix {
      grid-template-columns: 1fr;
    }
    .mini-grid {
      grid-template-columns: 1fr;
    }
  }
`
