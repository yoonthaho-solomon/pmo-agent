'use client'

import { PrimaryNav } from '@/app/components/PrimaryNav'
import { RouteMapPreview } from '@/app/components/RouteMapPreview'
import { adaptCallcardLocation, type CallcardLocationRow } from '@/lib/callcard-location-adapter'
import {
  callToVector,
  cosineSimilarity,
  driverToVector,
  type DriverVectorRow,
} from '@/lib/matching-vector'
import { DISPLAY_AXES, getDisplayAxisFactors, vectorToDisplayAxisBundle } from '@/lib/matching-display-axis'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

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
}

const C = {
  bg: '#070a10',
  panel: '#10151f',
  panel2: '#151b27',
  line: 'rgba(255,255,255,.09)',
  ink: '#f3f7ff',
  sub: '#b8c7da',
  muted: '#7f8da3',
  cyan: '#38bdf8',
  green: '#54d17a',
  orange: '#f59e42',
  violet: '#9b7cff',
  yellow: '#f2c14e',
  red: '#f15d64',
}

const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토']

const factorGroups = [
  { title: '시간대', count: 4, items: ['새벽', '오전', '주간', '야간'], color: C.violet },
  { title: '요일', count: 7, items: ['월', '화', '수', '목', '금', '토', '일'], color: C.green },
  { title: '거리', count: 3, items: ['단거리', '중거리', '장거리'], color: C.orange },
  { title: '요금·상품', count: 7, items: ['저요금', '중요금', '고요금', '유료콜', '무료콜', '탄력', '일반'], color: C.yellow },
  { title: '픽업 접근성', count: 1, items: ['ETA 근접도'], color: C.cyan },
]

function pct(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? '-' : `${Math.round(value * 100)}%`
}

function score100(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, Math.round(value)))
}

function money(value: number | null | undefined) {
  if (value == null) return '-'
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

function meters(value: number | null | undefined) {
  if (value == null) return '-'
  return value >= 1000 ? `${(value / 1000).toFixed(1)}km` : `${Math.round(value)}m`
}

function callSummary(call?: CallRow) {
  if (!call) return '-'
  const weekday = weekdayLabels[call.weekday] ?? '-'
  const paid = call.is_paid ? '유료호출' : '일반호출'
  const product = call.is_surge ? '탄력' : '일반'
  return `${call.hour_slot}시 · ${weekday}요일 · ${meters(call.expected_distance)} · ${money(call.expected_fare)} · ${paid} · ${product}`
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
          .select('callcard_id,asp_id,call_date,hour_slot,weekday,expected_distance,expected_fare,passenger_addr,dest_addr,passenger_lat,passenger_lng,dest_lat,dest_lng,s_hexagon,d_hexagon,is_paid,is_surge,eta_distance,product_type')
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
    return () => {
      cancelled = true
    }
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
        return { driver, vector, cosine: cosineSimilarity(callVector, vector) }
      })
      .sort((a, b) => b.cosine - a.cosine)
      .slice(0, 10)
  }, [drivers, selectedCall, callVector])

  useEffect(() => {
    if (!ranked.length) {
      queueMicrotask(() => setSelectedDriverId(''))
      return
    }
    if (!ranked.some((row) => row.driver.driver_id === selectedDriverId)) {
      queueMicrotask(() => setSelectedDriverId(ranked[0].driver.driver_id))
    }
  }, [ranked, selectedDriverId])

  const selectedMatch = ranked.find((row) => row.driver.driver_id === selectedDriverId) ?? ranked[0]
  const selectedDriverVector = selectedMatch?.vector ?? []
  const callAxes = vectorToDisplayAxisBundle(callVector).axis
  const driverAxes = vectorToDisplayAxisBundle(selectedDriverVector).axis
  const callFactors = getDisplayAxisFactors(callVector, selectedAxis)
  const driverFactors = getDisplayAxisFactors(selectedDriverVector, selectedAxis)
  const axisName = DISPLAY_AXES[selectedAxis]?.name ?? '5축'

  return (
    <main className="page">
      <PrimaryNav
        active="/vectors"
        title="KONAMOBILITY"
        subtitle="EMBEDDING FACTORS"
        rightSlot={<><Pill color={C.green}>실데이터</Pill><Pill color={C.cyan}>22D COSINE</Pill></>}
      />

      <section className="topRail" aria-label="임베딩 팩터 핵심 지표">
        <Kpi title="선택 콜카드" value={selectedCall ? '1건' : loading ? '조회 중' : '없음'} meta={`${calls.length.toLocaleString('ko-KR')}건 중 선택`} color={C.cyan} />
        <Kpi title="비교 기사" value={`${ranked.length}명`} meta={`${drivers.length.toLocaleString('ko-KR')}명 누적 패턴`} color={C.green} />
        <Kpi title="최고 유사도" value={pct(ranked[0]?.cosine)} meta="22D 코사인 기준" color={C.violet} />
        <Kpi title="팩터 구조" value="22D → 5축" meta="계산은 22개, 설명은 5개" color={C.orange} />
      </section>

      <div className="shell">
        <section className="hero">
          <div>
            <span className="eyebrow">EMBEDDING MODEL</span>
            <h1>콜카드 조건과 기사 운행패턴을 같은 숫자 언어로 비교합니다.</h1>
            <p>
              임베딩은 글자와 조건을 숫자로 바꾸는 과정입니다. 콜카드는 현재 호출 조건을,
              기사는 누적 운행패턴을 22개 기준으로 바꿔 코사인 유사도로 비교합니다.
            </p>
          </div>
          <StatusCard loading={loading} error={loadError} calls={calls.length} drivers={drivers.length} />
        </section>

        <section className="coreGrid">
          <article className="panel sourcePanel">
            <SectionTitle label="CALLCARD SOURCE" title="콜수락 판단에 필요한 원본 조건" />
            <select value={selectedCallId} onChange={(event) => setSelectedCallId(event.target.value)}>
              {calls.length === 0 ? (
                <option value="">{loading ? '콜카드 조회 중' : '조회된 콜카드 없음'}</option>
              ) : calls.map((call) => (
                <option key={call.callcard_id} value={call.callcard_id}>
                  {call.call_date} / {call.callcard_id}
                </option>
              ))}
            </select>
            <div className="factGrid">
              <Fact title="출발지" value={selectedCall?.passenger_addr ?? '주소 없음'} meta={selectedCallLocation?.route.pickup.h3Res7 ?? '출발 H3 없음'} color={C.cyan} />
              <Fact title="도착지" value={selectedCall?.dest_addr ?? '주소 없음'} meta={selectedCallLocation?.route.destination.h3Res7 ?? '도착 H3 없음'} color={C.green} />
              <Fact title="예상거리" value={meters(selectedCall?.expected_distance)} meta="거리 팩터로 변환" color={C.orange} />
              <Fact title="예상요금" value={money(selectedCall?.expected_fare)} meta="요금 팩터로 변환" color={C.yellow} />
              <Fact title="시간·요일" value={selectedCall ? `${selectedCall.hour_slot}시 · ${weekdayLabels[selectedCall.weekday] ?? '-'}요일` : '-'} meta="시간대·요일 팩터" color={C.violet} />
              <Fact title="호출유형" value={selectedCall?.is_paid ? '유료호출' : '일반호출'} meta={selectedCall?.is_surge ? '탄력 상품' : '일반 상품'} color={C.red} />
            </div>
          </article>

          <RouteMapPreview
            pickup={selectedCallLocation?.route.pickup}
            destination={selectedCallLocation?.route.destination}
            expectedDistanceMeters={selectedCall?.expected_distance}
            etaSeconds={selectedCall?.eta_distance}
            title="출발지·도착지 공간 조건"
            compact
          />
        </section>

        <section className="embeddingFlow">
          <SectionTitle label="HOW IT WORKS" title="원본 조건이 매칭 점수로 바뀌는 흐름" />
          <div className="steps">
            <Step no="01" title="콜카드 조건" text="출발지, 도착지, 시간, 요일, 거리, 요금, 호출유형을 읽습니다." color={C.cyan} />
            <Step no="02" title="22D 임베딩" text="비교 가능한 22개 숫자 기준으로 콜카드와 기사를 같은 형태로 바꿉니다." color={C.violet} />
            <Step no="03" title="코사인 유사도" text="두 벡터 방향이 얼마나 가까운지 계산해 가장 잘 맞는 기사 패턴을 찾습니다." color={C.green} />
            <Step no="04" title="공간 적합도 별도 계산" text="출발 H3와 도착 H3는 22D에 섞지 않고 별도 핵심 팩터로 봅니다." color={C.orange} />
          </div>
        </section>

        <section className="factorGroups">
          <SectionTitle label="22D FACTORS" title="현재 22개 임베딩 축" />
          <div className="groupGrid">
            {factorGroups.map((group) => (
              <article key={group.title} style={{ '--tone': group.color } as CSSProperties}>
                <span>{group.count}D</span>
                <h3>{group.title}</h3>
                <div>
                  {group.items.map((item) => <em key={item}>{item}</em>)}
                </div>
              </article>
            ))}
          </div>
          <p className="note">출발지·도착지 주소와 H3, OD 경로 키는 중요하지만 현재 22D 벡터에 억지로 넣지 않고 별도 공간 적합도로 계산합니다.</p>
        </section>

        <section className="compareGrid">
          <article className="panel">
            <SectionTitle label="MATCH RESULT" title="가장 가까운 기사 패턴" />
            <div className="matchHero">
              <div>
                <span>현재 콜카드</span>
                <strong>{selectedCall?.callcard_id ?? '-'}</strong>
                <p>{callSummary(selectedCall)}</p>
              </div>
              <b>{pct(selectedMatch?.cosine)}</b>
            </div>
            <div className="driverList">
              {ranked.slice(0, 5).map((row, index) => (
                <button
                  key={row.driver.driver_id}
                  type="button"
                  className={row.driver.driver_id === selectedDriverId ? 'active' : ''}
                  onClick={() => setSelectedDriverId(row.driver.driver_id)}
                >
                  <span>#{index + 1}</span>
                  <strong>{row.driver.driver_id}</strong>
                  <b>{pct(row.cosine)}</b>
                </button>
              ))}
            </div>
          </article>

          <article className="panel">
            <SectionTitle label="5-AXIS SUMMARY" title="콜카드와 기사 패턴 비교" />
            <AxisBars title="콜카드" axes={callAxes} color={C.cyan} />
            <AxisBars title="선택 기사" axes={driverAxes} color={C.green} />
          </article>

          <article className="panel">
            <SectionTitle label="DRILLDOWN" title={`${axisName} 세부 팩터`} />
            <div className="axisTabs">
              {DISPLAY_AXES.map((axis, index) => (
                <button key={axis.key} type="button" className={index === selectedAxis ? 'active' : ''} onClick={() => setSelectedAxis(index)}>
                  {axis.name}
                </button>
              ))}
            </div>
            <div className="compareRows">
              {callFactors.map((factor, index) => {
                const driver = driverFactors[index]
                return (
                  <CompareRow
                    key={factor.key}
                    label={factor.label}
                    callScore={factor.score ?? 0}
                    driverScore={driver?.score ?? 0}
                  />
                )
              })}
            </div>
          </article>
        </section>
      </div>

      <style jsx>{pageCss}</style>
    </main>
  )
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return <span className="pill" style={{ '--tone': color } as CSSProperties}>{children}</span>
}

function Kpi({ title, value, meta, color }: { title: string; value: string; meta: string; color: string }) {
  return (
    <article className="kpi">
      <span>{title}</span>
      <strong style={{ color }}>{value}</strong>
      <em>{meta}</em>
    </article>
  )
}

function StatusCard({ loading, error, calls, drivers }: { loading: boolean; error: string | null; calls: number; drivers: number }) {
  const color = error ? C.red : loading ? C.yellow : C.green
  return (
    <aside className="statusCard" style={{ '--tone': color } as CSSProperties}>
      <span>조회 상태</span>
      <strong>{loading ? '확인 중' : error ? '오류' : '정상'}</strong>
      <p>{error ?? `${calls.toLocaleString('ko-KR')}개 콜카드와 ${drivers.toLocaleString('ko-KR')}명 기사 패턴을 비교할 수 있습니다.`}</p>
    </aside>
  )
}

function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="sectionTitle">
      <span>{label}</span>
      <h2>{title}</h2>
    </div>
  )
}

function Fact({ title, value, meta, color }: { title: string; value: string; meta: string; color: string }) {
  return (
    <article className="fact" style={{ '--tone': color } as CSSProperties}>
      <span>{title}</span>
      <strong>{value}</strong>
      <em>{meta}</em>
    </article>
  )
}

function Step({ no, title, text, color }: { no: string; title: string; text: string; color: string }) {
  return (
    <article className="step" style={{ '--tone': color } as CSSProperties}>
      <span>{no}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  )
}

function AxisBars({ title, axes, color }: { title: string; axes: number[]; color: string }) {
  return (
    <div className="axisBars">
      <h3>{title}</h3>
      {axes.map((value, index) => (
        <div key={DISPLAY_AXES[index]?.key ?? index} className="axisLine">
          <span>{DISPLAY_AXES[index]?.name ?? `축 ${index + 1}`}</span>
          <div><i style={{ width: `${score100(value)}%`, background: color }} /></div>
          <b>{score100(value)}</b>
        </div>
      ))}
    </div>
  )
}

function CompareRow({ label, callScore, driverScore }: { label: string; callScore: number; driverScore: number }) {
  const callValue = score100(callScore)
  const driverValue = score100(driverScore)
  return (
    <div className="compareRow">
      <strong>{label}</strong>
      <div className="bars">
        <span>콜 {callValue}</span>
        <i><b style={{ width: `${callValue}%`, background: C.cyan }} /></i>
        <span>기사 {driverValue}</span>
        <i><b style={{ width: `${driverValue}%`, background: C.green }} /></i>
      </div>
    </div>
  )
}

const pageCss = `
  .page {
    min-height: 100vh;
    color: ${C.ink};
    background:
      linear-gradient(rgba(255,255,255,.024) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.024) 1px, transparent 1px),
      radial-gradient(circle at 25% 0%, rgba(56,189,248,.13), transparent 32rem),
      radial-gradient(circle at 78% 12%, rgba(155,124,255,.12), transparent 34rem),
      ${C.bg};
    background-size: 52px 52px, 52px 52px, auto, auto, auto;
  }
  .topRail {
    max-width: var(--maxw);
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-left: 1px solid ${C.line};
    border-bottom: 1px solid ${C.line};
  }
  .shell {
    max-width: var(--maxw);
    margin: 0 auto;
    padding: clamp(22px, 2.2vw, 38px) clamp(16px, 2vw, 28px) 72px;
  }
  .kpi {
    min-height: 118px;
    padding: 22px 24px;
    border-right: 1px solid ${C.line};
    background: rgba(7,10,16,.72);
    display: grid;
    align-content: center;
    gap: 8px;
    min-width: 0;
  }
  .kpi span {
    color: ${C.muted};
    font-size: 18px;
    font-weight: 850;
  }
  .kpi strong {
    font-size: clamp(28px, 2.4vw, 42px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.04em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kpi em {
    color: ${C.sub};
    font-size: 18px;
    line-height: 1.25;
    font-style: normal;
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 430px);
    gap: clamp(18px, 2vw, 28px);
    border: 1px solid ${C.line};
    border-radius: 24px;
    background: linear-gradient(135deg, rgba(16,21,31,.96), rgba(15,20,32,.78));
    box-shadow: 0 32px 120px rgba(0,0,0,.35);
    padding: clamp(24px, 3vw, 46px);
  }
  .eyebrow,
  .sectionTitle span {
    display: block;
    color: ${C.cyan};
    font-size: 18px;
    font-weight: 900;
    letter-spacing: .1em;
    text-transform: uppercase;
  }
  h1 {
    max-width: 17ch;
    margin: 16px 0 0;
    color: ${C.ink};
    font-size: clamp(42px, 5vw, 72px);
    line-height: .98;
    font-weight: 950;
    letter-spacing: -.06em;
  }
  .hero p {
    max-width: 66ch;
    margin: 24px 0 0;
    color: ${C.sub};
    font-size: clamp(20px, 1.45vw, 25px);
    line-height: 1.48;
    font-weight: 650;
  }
  .statusCard {
    border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--tone) 9%, transparent);
    padding: 28px;
    display: grid;
    align-content: center;
    gap: 12px;
  }
  .statusCard span {
    color: ${C.sub};
    font-size: 20px;
    font-weight: 850;
  }
  .statusCard strong {
    color: var(--tone);
    font-size: clamp(44px, 4vw, 64px);
    line-height: .95;
    font-weight: 950;
    letter-spacing: -.06em;
  }
  .statusCard p {
    margin: 0;
    color: ${C.sub};
    font-size: 18px;
    line-height: 1.45;
    font-weight: 650;
  }
  .coreGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(360px, .85fr);
    gap: 18px;
    margin-top: 18px;
  }
  .panel,
  .embeddingFlow,
  .factorGroups {
    border: 1px solid ${C.line};
    border-radius: 22px;
    background: rgba(16,21,31,.76);
    padding: clamp(20px, 2vw, 30px);
  }
  .sourcePanel select {
    width: 100%;
    margin-top: 20px;
    height: 54px;
    border: 1px solid ${C.line};
    border-radius: 14px;
    background: ${C.panel2};
    color: ${C.ink};
    padding: 0 16px;
    font-size: 18px;
    font-weight: 800;
  }
  .sectionTitle h2 {
    margin: 8px 0 0;
    color: ${C.ink};
    font-size: clamp(30px, 2.4vw, 44px);
    line-height: 1.08;
    font-weight: 950;
    letter-spacing: -.05em;
  }
  .factGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
  }
  .fact,
  .step,
  .groupGrid article {
    border: 1px solid color-mix(in srgb, var(--tone) 34%, transparent);
    border-radius: 18px;
    background: color-mix(in srgb, var(--tone) 8%, ${C.panel2});
    padding: 18px;
    min-width: 0;
  }
  .fact span,
  .step span,
  .groupGrid article span {
    display: block;
    color: var(--tone);
    font-size: 18px;
    font-weight: 950;
  }
  .fact strong {
    display: block;
    margin-top: 12px;
    color: ${C.ink};
    font-size: 22px;
    line-height: 1.18;
    font-weight: 950;
    overflow-wrap: anywhere;
  }
  .fact em {
    display: block;
    margin-top: 8px;
    color: ${C.sub};
    font-size: 17px;
    line-height: 1.35;
    font-style: normal;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .embeddingFlow,
  .factorGroups,
  .compareGrid {
    margin-top: 18px;
  }
  .steps,
  .groupGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 18px;
  }
  .step h3,
  .groupGrid h3 {
    margin: 16px 0 0;
    color: ${C.ink};
    font-size: 25px;
    line-height: 1.16;
    font-weight: 950;
    letter-spacing: -.04em;
  }
  .step p,
  .note {
    margin: 12px 0 0;
    color: ${C.sub};
    font-size: 18px;
    line-height: 1.5;
    font-weight: 650;
  }
  .groupGrid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .groupGrid article div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  .groupGrid em {
    color: ${C.ink};
    background: rgba(255,255,255,.06);
    border: 1px solid ${C.line};
    border-radius: 999px;
    padding: 7px 10px;
    font-size: 15px;
    font-style: normal;
    font-weight: 800;
  }
  .compareGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, .75fr) minmax(320px, .85fr);
    gap: 18px;
  }
  .matchHero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    margin-top: 18px;
    border: 1px solid ${C.line};
    border-radius: 18px;
    background: ${C.panel2};
    padding: 20px;
  }
  .matchHero span {
    color: ${C.sub};
    font-size: 18px;
    font-weight: 850;
  }
  .matchHero strong {
    display: block;
    margin-top: 8px;
    color: ${C.ink};
    font-size: 26px;
    line-height: 1.15;
    font-weight: 950;
    overflow-wrap: anywhere;
  }
  .matchHero p {
    margin: 8px 0 0;
    color: ${C.sub};
    font-size: 18px;
    line-height: 1.35;
    font-weight: 700;
  }
  .matchHero b {
    color: ${C.cyan};
    font-size: clamp(46px, 4vw, 72px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.06em;
  }
  .driverList {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }
  .driverList button {
    border: 1px solid ${C.line};
    border-radius: 16px;
    background: rgba(255,255,255,.035);
    color: ${C.ink};
    min-height: 64px;
    padding: 0 16px;
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }
  .driverList button.active {
    border-color: rgba(56,189,248,.75);
    background: rgba(56,189,248,.1);
  }
  .driverList span {
    color: ${C.orange};
    font-size: 18px;
    font-weight: 950;
  }
  .driverList strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 18px;
    font-weight: 900;
  }
  .driverList b {
    color: ${C.cyan};
    font-size: 28px;
    font-weight: 950;
  }
  .axisBars {
    display: grid;
    gap: 12px;
    margin-top: 18px;
  }
  .axisBars + .axisBars {
    margin-top: 28px;
  }
  .axisBars h3 {
    margin: 0;
    color: ${C.ink};
    font-size: 23px;
    font-weight: 950;
  }
  .axisLine {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr) 42px;
    gap: 12px;
    align-items: center;
  }
  .axisLine span,
  .axisLine b {
    color: ${C.sub};
    font-size: 17px;
    font-weight: 850;
  }
  .axisLine div {
    height: 12px;
    border-radius: 999px;
    background: rgba(255,255,255,.08);
    overflow: hidden;
  }
  .axisLine i {
    display: block;
    height: 100%;
    border-radius: inherit;
  }
  .axisTabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
  .axisTabs button {
    border: 1px solid ${C.line};
    border-radius: 999px;
    background: rgba(255,255,255,.04);
    color: ${C.sub};
    padding: 10px 14px;
    font-size: 16px;
    font-weight: 850;
    cursor: pointer;
  }
  .axisTabs button.active {
    color: #071018;
    background: ${C.cyan};
    border-color: ${C.cyan};
  }
  .compareRows {
    display: grid;
    gap: 12px;
    margin-top: 18px;
  }
  .compareRow {
    border: 1px solid ${C.line};
    border-radius: 16px;
    background: rgba(255,255,255,.035);
    padding: 16px;
  }
  .compareRow > strong {
    display: block;
    color: ${C.ink};
    font-size: 18px;
    font-weight: 950;
  }
  .bars {
    display: grid;
    grid-template-columns: 74px minmax(0, 1fr);
    gap: 8px 12px;
    align-items: center;
    margin-top: 12px;
  }
  .bars span {
    color: ${C.sub};
    font-size: 16px;
    font-weight: 850;
  }
  .bars i {
    display: block;
    height: 10px;
    border-radius: 999px;
    background: rgba(255,255,255,.08);
    overflow: hidden;
  }
  .bars b {
    display: block;
    height: 100%;
    border-radius: inherit;
  }
  .pill {
    color: var(--tone);
    border: 1px solid color-mix(in srgb, var(--tone) 46%, transparent);
    background: color-mix(in srgb, var(--tone) 12%, transparent);
    border-radius: 12px;
    padding: 9px 13px;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: .06em;
    white-space: nowrap;
  }
  @media (max-width: 1280px) {
    .topRail,
    .coreGrid,
    .steps,
    .groupGrid,
    .compareGrid {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 820px) {
    .topRail,
    .hero,
    .coreGrid,
    .steps,
    .groupGrid,
    .compareGrid,
    .factGrid {
      grid-template-columns: 1fr;
    }
    h1 {
      font-size: 42px;
    }
  }
`
