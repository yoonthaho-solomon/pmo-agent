'use client'

import { DispatchFlow } from '@/app/components/DispatchFlow'
import { PrimaryNav } from '@/app/components/PrimaryNav'
import { RouteMapPreview } from '@/app/components/RouteMapPreview'
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
import { adaptCallcardLocation, type CallcardLocationRow } from '@/lib/callcard-location-adapter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'preview-build-key',
)

type CallRow = CallcardLocationRow & {
  callcard_id: string
  asp_id: number
  call_date: string
  hour_slot: number
  weekday: number
  expected_distance: number
  expected_fare: number
  passenger_addr?: string | null
  dest_addr?: string | null
  is_paid: boolean
  is_surge: boolean
  eta_distance: number | null
  call_fee?: number | null
  product_type: string | null
}

type DriverRow = DriverVectorRow & {
  driver_id: string
  asp_id: number
  data_days: number | null
  reliability: number | null
  pref_s_hexagons?: string[] | null
  pref_d_hexagons?: string[] | null
}

type RankedDriver = {
  driver: DriverRow
  vector: number[]
  cosine: number
  grade: string
}

// Palette mirrors app/globals.css :root. Keys kept (cyan/green/…) so the
// categorical factor tones stay distinguishable but muted.
const C = {
  bg: '#0a0c10',
  ink: '#e7ebf2',
  sub: '#9aa6b8',
  muted: '#6a7688',
  line: 'rgba(255, 255, 255, 0.07)',
  cyan: '#38bdf8',
  green: '#3fb950',
  yellow: '#d29922',
  orange: '#d98a4a',
  red: '#f85149',
  purple: '#a78bfa',
} as const

const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']

const spatialPurpose = [
  {
    title: '승객 출발지',
    value: 'passenger_addr · s_hexagon',
    desc: '콜이 시작되는 주소와 출발 H3입니다. 기사 선호 출발 H3와 비교해 출발지 적합도를 계산합니다.',
    color: C.cyan,
  },
  {
    title: '승객 도착지',
    value: 'dest_addr · d_hexagon',
    desc: '콜이 끝나는 주소와 도착 H3입니다. 기사 선호 도착 H3와 비교해 목적지 적합도를 계산합니다.',
    color: C.green,
  },
  {
    title: 'OD 경로 키',
    value: 's_hexagon → d_hexagon',
    desc: '출발 H3와 도착 H3를 묶은 경로 키입니다. 향후 권역·OD 패턴과 다음 콜 효율 분석의 기준이 됩니다.',
    color: C.orange,
  },
] as const
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
          .select('callcard_id,asp_id,call_date,hour_slot,weekday,expected_distance,expected_fare,passenger_addr,dest_addr,passenger_lat,passenger_lng,dest_lat,dest_lng,s_hexagon,d_hexagon,is_paid,is_surge,eta_distance,call_fee,product_type')
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
  const selectedCallLocation = useMemo(() => (
    selectedCall ? adaptCallcardLocation(selectedCall) : null
  ), [selectedCall])

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
        title="KONAMOBILITY"
        subtitle="콜 조건·기사 패턴 임베딩"
        rightSlot={<><Pill color={C.green}>실데이터</Pill><Pill color={C.cyan}>22D COSINE</Pill></>}
      />

      <DispatchFlow active={['callcard', 'similarity']} compact />

      <section className="top-rail" aria-label="팩터리스트 핵심 지표">
        <RailMetric label="선택 콜카드" value={selectedCall ? '1건 선택' : loading ? '조회 중' : '없음'} meta={`${calls.length.toLocaleString('ko-KR')}건 중 선택`} color={C.cyan} />
        <RailMetric label="비교 기사" value={`${ranked.length}명`} meta={`${drivers.length.toLocaleString('ko-KR')}명 누적 운행패턴`} color={C.green} />
        <RailMetric label="가장 가까운 패턴" value={pct(ranked[0]?.cosine)} meta="콜 조건과 기사 패턴의 22D 코사인 유사도" color={C.purple} />
        <RailMetric label="화면 요약" value="22D → 5축" meta="계산은 22개, 설명은 5개 축" color={C.orange} />
      </section>

      <div className="workspace">
        <section className="hero-card">
          <div>
            <p className="eyebrow">VECTOR FACTOR LIST</p>
            <h1>콜카드 조건과 기사 운행패턴을 같은 숫자 언어로 비교합니다</h1>
            <p className="lead">
              출발지, 도착지, 예상거리, 예상요금, 요일, 시간, 호출유형을 기준으로 콜카드를 만들고,
              기사 누적 운행패턴과 같은 22개 기준으로 비교합니다.
            </p>
          </div>
          <div className="status-card" style={{ '--tone': loadError ? C.red : loading ? C.yellow : C.green } as CSSProperties}>
            <span>조회 상태</span>
            <strong>{loading ? '확인 중' : loadError ? '오류' : '정상'}</strong>
            <p>{loadError ?? `${calls.length.toLocaleString('ko-KR')}개 콜카드와 ${drivers.length.toLocaleString('ko-KR')}명 기사 벡터를 비교할 수 있습니다.`}</p>
          </div>
        </section>

        <section className="raw-call">
          <SectionTitle label="CALLCARD SOURCE" title="콜수락 판단에 필요한 원본 조건" />
          <div className="raw-grid">
            <RawFact title="승객 출발지" value={selectedCall?.passenger_addr ?? '주소 정보 없음'} sub={selectedCallLocation?.route.pickup.h3Res7 ?? '출발 H3 없음'} color={C.cyan} />
            <RawFact title="승객 도착지" value={selectedCall?.dest_addr ?? '주소 정보 없음'} sub={selectedCallLocation?.route.destination.h3Res7 ?? '도착 H3 없음'} color={C.green} />
            <RawFact title="예상 운행거리" value={meters(selectedCall?.expected_distance)} sub="22D 거리 구간으로 변환" color={C.orange} />
            <RawFact title="예상요금" value={money(selectedCall?.expected_fare)} sub="22D 요금 구간으로 변환" color={C.yellow} />
            <RawFact title="승객 탑승 ETA" value={selectedCall?.eta_distance == null ? '-' : `${Math.round(selectedCall.eta_distance)}초`} sub="픽업 접근성 보조값" color={C.purple} />
            <RawFact title="OD 경로 키" value={selectedCallLocation?.route.originDestinationKey ?? 'OD 정보 없음'} sub="22D가 아닌 공간 적합도 기준" color={C.red} mono />
          </div>
        </section>

        <RouteMapPreview
          pickup={selectedCallLocation?.route.pickup}
          destination={selectedCallLocation?.route.destination}
          expectedDistanceMeters={selectedCall?.expected_distance}
          etaSeconds={selectedCall?.eta_distance}
          title="콜카드 출발·도착 공간 프리뷰"
        />

        <section className="spatial-purpose">
          <SectionTitle label="SPATIAL FACTORS" title="출발지·도착지는 별도로 보는 핵심 팩터" />
          <div className="spatial-grid">
            {spatialPurpose.map((item) => (
              <article key={item.title} style={{ '--tone': item.color } as CSSProperties}>
                <span>{item.title}</span>
                <b>{item.value}</b>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
          <div className="driver-h3-note">
            <span>선택 기사 공간 선호</span>
            <b>출발 선호 H3 {selectedMatch?.driver.pref_s_hexagons?.length ?? 0}개 · 도착 선호 H3 {selectedMatch?.driver.pref_d_hexagons?.length ?? 0}개</b>
            <p>최종 추천점수는 22D 성향 유사도에 이 출발·도착 H3 적합도를 별도로 더해 계산합니다.</p>
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

function RawFact({
  title,
  value,
  sub,
  color,
  mono = false,
}: {
  title: string
  value: string
  sub: string
  color: string
  mono?: boolean
}) {
  return (
    <article className="raw-fact" style={{ '--tone': color } as CSSProperties}>
      <span>{title}</span>
      <strong className={mono ? 'mono' : ''}>{value}</strong>
      <p>{sub}</p>
    </article>
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
      radial-gradient(820px 320px at 28% -8%, rgba(56,189,248,.06), transparent 62%),
      ${C.bg};
    font-size: var(--fs-base);
  }
  .pill {
    display: inline-grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--tone) 44%, transparent);
    border-radius: 8px;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 14%, transparent);
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .06em;
    white-space: nowrap;
  }
  .top-rail {
    max-width: var(--maxw);
    margin: 0 auto;
    padding: 14px clamp(16px, 2vw, 28px) 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .rail-metric {
    min-width: 0;
    border: 1px solid ${C.line};
    border-radius: 12px;
    background: var(--bg-1);
    padding: 14px 16px;
    display: grid;
    gap: 3px;
  }
  .rail-metric span {
    color: ${C.muted};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .rail-metric b {
    font-size: clamp(18px, 1.6vw, 24px);
    line-height: 1.1;
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .rail-metric em {
    color: ${C.sub};
    font-size: 11.5px;
    font-style: normal;
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .workspace {
    max-width: var(--maxw);
    margin: 0 auto;
    padding: 14px clamp(16px, 2vw, 28px) 56px;
    display: grid;
    gap: 14px;
  }
  .hero-card,
  .raw-call,
  .profile-panel,
  .comparison-stage,
  .formula-card,
  .core-model article,
  .factor-purpose article,
  .spatial-purpose,
  .spatial-grid article,
  .driver-h3-note {
    border: 1px solid ${C.line};
    border-radius: 14px;
    background: var(--bg-1);
  }
  .hero-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 16px;
    padding: clamp(18px, 2vw, 28px);
  }
  .eyebrow,
  .section-title span {
    display: block;
    color: ${C.cyan};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .14em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  h1, h2, h3, p { margin: 0; }
  h1 {
    max-width: 32ch;
    font-size: clamp(20px, 2vw, 28px);
    line-height: 1.25;
    font-weight: 650;
    letter-spacing: -.02em;
  }
  .lead,
  .status-card p,
  .formula-card p {
    margin-top: 10px;
    color: ${C.sub};
    font-size: 14px;
    line-height: 1.62;
    font-weight: 400;
  }
  .status-card {
    border: 1px solid color-mix(in srgb, var(--tone) 40%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--tone) 9%, transparent);
    padding: 20px;
    align-self: start;
  }
  .status-card span {
    color: ${C.muted};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .1em;
  }
  .status-card strong {
    display: block;
    color: var(--tone);
    font-size: clamp(28px, 3vw, 40px);
    line-height: 1;
    font-weight: 700;
    margin-top: 8px;
  }
  .raw-call { padding: clamp(18px, 1.8vw, 24px); }
  .raw-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .raw-fact {
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 8px;
    padding: 16px;
    border: 1px solid ${C.line} !important;
    border-left: 2px solid var(--tone) !important;
    border-radius: 12px;
    background: var(--bg-2);
  }
  .raw-fact span {
    color: var(--tone);
    font-size: 11px;
    line-height: 1.15;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .raw-fact strong {
    min-width: 0;
    color: ${C.ink};
    font-size: 16px;
    line-height: 1.35;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .raw-fact strong.mono {
    font-family: var(--ff-mono);
    font-size: 12.5px;
  }
  .raw-fact p {
    color: ${C.sub};
    font-size: 12px;
    line-height: 1.45;
    font-weight: 400;
  }
  .spatial-purpose { padding: clamp(18px, 1.8vw, 24px); }
  .spatial-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 4px;
  }
  .spatial-grid article {
    padding: 16px;
    border-left: 2px solid var(--tone) !important;
    background: var(--bg-2) !important;
  }
  .spatial-grid span {
    color: var(--tone);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .spatial-grid b {
    display: block;
    margin-top: 6px;
    color: ${C.ink};
    font-size: 13.5px;
    font-weight: 600;
    font-family: var(--ff-mono);
    overflow-wrap: anywhere;
  }
  .spatial-grid p {
    margin-top: 8px;
    color: ${C.sub};
    font-size: 12.5px;
    line-height: 1.5;
  }
  .driver-h3-note {
    margin-top: 12px;
    padding: 16px;
    background: var(--bg-2) !important;
  }
  .driver-h3-note span {
    color: ${C.muted};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .driver-h3-note b {
    display: block;
    margin-top: 6px;
    color: ${C.ink};
    font-size: 14px;
    font-weight: 600;
  }
  .driver-h3-note p {
    margin-top: 6px;
    color: ${C.sub};
    font-size: 12.5px;
    line-height: 1.5;
  }
  .core-model {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .core-model article {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 14px;
    align-items: start;
    padding: 18px;
    border-left: 2px solid var(--tone) !important;
  }
  .core-model span {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--tone) 35%, transparent);
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .core-model h2 {
    font-size: 13px;
    line-height: 1.2;
    font-weight: 600;
    color: ${C.sub};
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .core-model strong {
    display: block;
    margin-top: 4px;
    color: ${C.ink};
    font-size: 18px;
    line-height: 1.15;
    font-weight: 650;
  }
  .core-model p {
    margin-top: 8px;
    color: ${C.sub};
    font-size: 12.5px;
    line-height: 1.5;
    font-weight: 400;
  }
  .factor-purpose {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }
  .factor-purpose article {
    padding: 16px;
    border-left: 2px solid var(--tone) !important;
  }
  .factor-purpose span {
    color: var(--tone);
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .factor-purpose h2 {
    margin-top: 6px;
    font-size: 15px;
    font-weight: 600;
  }
  .factor-purpose p {
    min-height: 72px;
    margin-top: 8px;
    color: ${C.sub};
    font-size: 12.5px;
    line-height: 1.5;
  }
  .factor-purpose div {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .factor-purpose em {
    border-radius: 999px;
    color: ${C.sub};
    background: rgba(255,255,255,.05);
    border: 1px solid ${C.line};
    padding: 4px 9px;
    font-size: 11.5px;
    font-style: normal;
    font-weight: 500;
  }
  .main-grid {
    display: grid;
    grid-template-columns: minmax(300px, .85fr) minmax(560px, 1.6fr) minmax(320px, .95fr);
    gap: 14px;
    align-items: start;
  }
  .profile-panel,
  .comparison-stage,
  .formula-card {
    padding: clamp(16px, 1.6vw, 22px);
  }
  .section-title h2 {
    font-size: 17px;
    line-height: 1.2;
    font-weight: 650;
    letter-spacing: -.01em;
  }
  select {
    width: 100%;
    min-height: 40px;
    margin-top: 14px;
    border: 1px solid ${C.line};
    border-radius: 10px;
    color: ${C.ink};
    background: var(--bg-input);
    padding: 0 12px;
    font-size: 13px;
    font-weight: 500;
  }
  .profile-card,
  .axis-box,
  .drill-card {
    margin-top: 14px;
    border: 1px solid color-mix(in srgb, var(--tone, ${C.cyan}) 26%, ${C.line});
    border-radius: 12px;
    background: color-mix(in srgb, var(--tone, ${C.cyan}) 6%, var(--bg-2));
    padding: 16px;
  }
  .profile-top {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
  }
  .profile-top span {
    color: var(--tone);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .profile-top b {
    display: block;
    margin-top: 4px;
    color: ${C.ink};
    font-size: 34px;
    line-height: .95;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .profile-top strong {
    width: 54px;
    height: 54px;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--tone) 40%, transparent);
    border-radius: 14px;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 12%, transparent);
    font-size: 20px;
    font-weight: 700;
  }
  .profile-card > strong {
    display: block;
    margin-top: 12px;
    color: ${C.ink};
    font-size: 15px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .profile-card p {
    margin-top: 6px;
    color: ${C.sub};
    font-size: 12.5px;
    line-height: 1.45;
  }
  .mini-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 14px;
  }
  .mini-grid div {
    min-width: 0;
    border: 1px solid ${C.line};
    border-radius: 8px;
    background: rgba(0,0,0,.25);
    padding: 10px;
  }
  .mini-grid span,
  .axis-row span,
  .compare-row span {
    color: ${C.muted};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .mini-grid b {
    display: block;
    margin-top: 3px;
    font-size: 13.5px;
    font-weight: 600;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  .axis-box { --tone: ${C.cyan}; }
  .axis-box h3,
  .drill-head h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .axis-row {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) minmax(110px, 1.2fr) 34px;
    gap: 10px;
    align-items: center;
    margin-top: 9px;
  }
  .axis-row i,
  .compare-row i,
  .dual i {
    height: 8px;
    border-radius: 999px;
    background: rgba(255,255,255,.07);
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
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .match-summary {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 14px;
    align-items: end;
    border: 1px solid color-mix(in srgb, ${C.cyan} 28%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, ${C.cyan} 8%, transparent);
    padding: 16px;
    margin-top: 14px;
  }
  .match-summary span {
    color: ${C.sub};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .match-summary h2 {
    margin-top: 6px;
    font-size: clamp(16px, 1.5vw, 22px);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .match-summary strong {
    color: ${C.cyan};
    font-size: clamp(34px, 3.4vw, 52px);
    line-height: .9;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .matrix {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
    margin-top: 14px;
  }
  .matrix-cell {
    min-width: 0;
    border: 1px solid ${C.line};
    border-radius: 10px;
    background: var(--bg-2);
    padding: 11px;
  }
  .matrix-cell span {
    color: ${C.muted};
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .matrix-cell b {
    display: block;
    margin-top: 3px;
    font-size: 12.5px;
    font-weight: 600;
  }
  .dual {
    display: grid;
    gap: 5px;
    margin-top: 10px;
  }
  .matrix-cell strong {
    display: block;
    margin-top: 8px;
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .axis-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  .axis-tabs button {
    min-height: 34px;
    border: 1px solid ${C.line};
    border-radius: 8px;
    color: ${C.sub};
    background: rgba(255,255,255,.03);
    padding: 0 13px;
    font-size: 12.5px;
    font-weight: 550;
    cursor: pointer;
    transition: color 140ms ease, border-color 140ms ease, background 140ms ease;
  }
  .axis-tabs button:hover {
    color: ${C.ink};
    border-color: rgba(255,255,255,.16);
  }
  .axis-tabs button.active {
    color: ${C.bg};
    border-color: ${C.cyan};
    background: ${C.cyan};
    font-weight: 600;
  }
  .drill-card { --tone: ${C.cyan}; }
  .drill-head span {
    color: ${C.muted};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .compare-row {
    border-top: 1px solid ${C.line};
    padding-top: 12px;
    margin-top: 12px;
    display: grid;
    grid-template-columns: minmax(160px, .8fr) 1fr 1fr;
    gap: 14px;
    align-items: center;
  }
  .compare-row > b {
    font-size: 13px;
    font-weight: 500;
  }
  .compare-row div {
    display: grid;
    grid-template-columns: 36px 1fr 32px;
    gap: 8px;
    align-items: center;
  }
  .compare-row strong {
    text-align: right;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .driver-list {
    display: grid;
    gap: 8px;
    margin-top: 14px;
  }
  .driver-list button {
    min-width: 0;
    min-height: 48px;
    border: 1px solid ${C.line};
    border-radius: 10px;
    color: ${C.ink};
    background: rgba(255,255,255,.025);
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 36px 1fr auto;
    gap: 10px;
    align-items: center;
    text-align: left;
    cursor: pointer;
    transition: border-color 140ms ease, background 140ms ease;
  }
  .driver-list button:hover {
    border-color: rgba(255,255,255,.16);
  }
  .driver-list button.active {
    border-color: ${C.green};
    background: color-mix(in srgb, ${C.green} 12%, transparent);
  }
  .driver-list span {
    color: ${C.muted};
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .driver-list b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
  }
  .driver-list strong {
    color: ${C.cyan};
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .empty {
    border: 1px dashed ${C.line};
    border-radius: 10px;
    padding: 16px;
    color: ${C.sub};
    font-size: 13px;
  }
  .formula-card {
    display: grid;
    grid-template-columns: 1fr minmax(320px, .8fr);
    gap: 16px;
    align-items: center;
  }
  .formula-card h2 {
    font-size: clamp(16px, 1.6vw, 22px);
    font-weight: 600;
    line-height: 1.3;
  }
  .formula-card code {
    border: 1px solid color-mix(in srgb, ${C.cyan} 26%, transparent);
    border-radius: 10px;
    color: ${C.cyan};
    background: color-mix(in srgb, ${C.cyan} 9%, transparent);
    padding: 16px;
    font-family: var(--ff-mono);
    font-size: 12.5px;
    font-weight: 500;
    overflow-wrap: anywhere;
    line-height: 1.5;
  }
  .formula-card p {
    grid-column: 1 / -1;
  }
  @media (max-width: 1380px) {
    .factor-purpose { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .raw-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .spatial-grid { grid-template-columns: 1fr; }
    .main-grid { grid-template-columns: 1fr 1fr; }
    .comparison-stage { grid-column: 1 / -1; order: -1; }
    .matrix { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
  @media (max-width: 920px) {
    .top-rail,
    .hero-card,
    .main-grid,
    .formula-card { grid-template-columns: 1fr; }
    .factor-purpose { grid-template-columns: 1fr; }
    .raw-grid { grid-template-columns: 1fr; }
    .core-model { grid-template-columns: 1fr; }
    .matrix { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .compare-row { grid-template-columns: 1fr; }
  }
  @media (max-width: 620px) {
    .workspace { padding: 16px; }
    .matrix { grid-template-columns: 1fr; }
    .mini-grid { grid-template-columns: 1fr; }
  }
`
