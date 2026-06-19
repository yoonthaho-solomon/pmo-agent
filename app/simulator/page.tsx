'use client'

import { PrimaryNav } from '@/app/components/PrimaryNav'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
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
import {
  adaptCallcardLocation,
  type AdaptCallcardLocationResult,
  type CallcardLocationRow,
} from '@/lib/callcard-location-adapter'
import {
  calculateSpatialScore,
  calculateV2FinalScore,
  type SpatialScoreResult,
} from '@/lib/h3-match-score'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'preview-build-key',
)

type DriverRow = DriverVectorRow & {
  driver_id: string
  asp_id: number
  reliability: number | null
  data_days: number | null
  pref_s_hexagons?: string[] | null
  pref_d_hexagons?: string[] | null
}

type SimulatorCallcardRow = CallcardLocationRow & {
  callcard_id: string
  asp_id: number | null
  call_date: string | null
  hour_slot?: number | null
  weekday?: number | null
  expected_distance?: number | null
  expected_fare?: number | null
  is_paid?: boolean | null
  eta_distance?: number | null
  is_surge?: boolean | null
  product_type?: string | null
  call_fee?: number | null
}

type Why = {
  type: 'up' | 'down'
  label: string
  value: number
}

type Ranked = {
  driver: DriverRow
  vector: number[]
  axis: number[]
  sub: number[][]
  cosine: number
  similarityScore: number
  acceptanceProbability: number
  completionProbability: number
  pickupAccessibilityScore: number
  spatial: SpatialScoreResult
  finalScore: number
  reliability: number
  simDistanceKm: number
  simEtaMin: number
  lead: string
  why: Why[]
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

const C = {
  body: '#050810',
  panel: '#0A101D',
  ink: '#F8FAFC',
  sub: '#AAB7CB',
  muted: '#70809A',
  line: '#24324C',
  cyan: '#22D3EE',
  purple: '#8B5CF6',
  green: '#10B981',
  orange: '#FB923C',
  yellow: '#F59E0B',
  red: '#F43F5E',
}

const aspOptions = [
  { value: 137000000000, label: '인천 137' },
  { value: 147000000000, label: '천안 147' },
  { value: 160000000000, label: '부산 160' },
]

const CALLCARD_LOCATION_COLS = [
  'callcard_id',
  'asp_id',
  'call_date',
  'passenger_lat',
  'passenger_lng',
  'dest_lat',
  'dest_lng',
  's_hexagon',
  'd_hexagon',
  'hour_slot',
  'weekday',
  'expected_distance',
  'expected_fare',
  'is_paid',
  'eta_distance',
  'is_surge',
  'product_type',
  'call_fee',
].join(',')

const weekdays = ['월', '화', '수', '목', '금', '토', '일']

function pct(n: number | null | undefined) {
  return n == null ? '-' : `${Math.round(n)}%`
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n))
}

function pseudoDistance(driverId: string, index: number) {
  const seed = Array.from(driverId).reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return 0.7 + ((seed + index * 17) % 82) / 10
}

function axisGap(callAxis: number[], driverAxis: number[], index: number) {
  return Math.abs((callAxis[index] ?? 0) - (driverAxis[index] ?? 0))
}

function makeLead(row: Pick<Ranked, 'axis' | 'similarityScore' | 'simEtaMin' | 'spatial'>, callAxis: number[]) {
  const bestAxis = DISPLAY_AXES
    .map((axis, index) => ({ axis: axis.name, diff: axisGap(callAxis, row.axis, index) }))
    .sort((a, b) => a.diff - b.diff)[0]
  const spatialReason = row.spatial.spatialScore == null
    ? '기사 선호 H3 데이터가 부족해 성향 유사도를 중심으로 추천했습니다.'
    : `출발지 ${pct(row.spatial.originScore)}, 목적지 ${pct(row.spatial.destinationScore)}로 공간 적합도 ${pct(row.spatial.spatialScore)}입니다.`
  return `${bestAxis.axis}이 가장 가깝고, 22D 성향 유사도는 ${Math.round(row.similarityScore)}점입니다. ETA ${row.simEtaMin}분은 실제 위치가 아닌 시뮬레이션 값입니다. ${spatialReason}`
}

function makeWhy(driverAxis: number[], callAxis: number[], acceptance: number, etaMin: number): Why[] {
  const matches = DISPLAY_AXES.map((axis, index) => ({
    label: axis.name,
    score: clamp(100 - axisGap(callAxis, driverAxis, index)),
  })).sort((a, b) => b.score - a.score)
  const gaps = DISPLAY_AXES.map((axis, index) => ({
    label: axis.name,
    gap: axisGap(callAxis, driverAxis, index),
  })).sort((a, b) => b.gap - a.gap)

  return [
    { type: 'up', label: `${matches[0].label} 일치`, value: Math.round(matches[0].score / 3) },
    { type: 'up', label: `예상 수락률 ${Math.round(acceptance)}%`, value: Math.round(acceptance / 4) },
    { type: etaMin <= 7 ? 'up' : 'down', label: `ETA ${etaMin}분`, value: etaMin <= 7 ? 18 : 16 },
    { type: 'down', label: `${gaps[0].label} 차이`, value: Math.round(gaps[0].gap / 3) },
  ]
}

function confidence(reliability: number, dataDays: number | null | undefined): Ranked['confidence'] {
  if (reliability >= 0.7 && Number(dataDays ?? 0) >= 30) return 'HIGH'
  if (reliability >= 0.45 && Number(dataDays ?? 0) >= 10) return 'MEDIUM'
  return 'LOW'
}

function formatKm(meter: number) {
  return meter >= 1000 ? `${(meter / 1000).toFixed(1)}km` : `${Math.round(meter)}m`
}

function formatFare(value: number) {
  return `${Math.round(value).toLocaleString()}원`
}

function sourceLabel(source: AdaptCallcardLocationResult['diagnostics']['pickupH3Source']) {
  if (source === 'STORED') return '저장 데이터'
  if (source === 'COORDINATE') return '좌표 계산'
  return '정보 없음'
}

function formatCoord(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return '정보 없음'
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

function h3DistanceLabel(distance: number | null) {
  if (distance == null) return '데이터 없음'
  if (distance === 0) return '동일 H3'
  if (distance >= 1 && distance <= 3) return `${distance}-ring`
  return '3-ring 밖'
}

function grade(score: number | null | undefined) {
  const value = Number(score ?? 0)
  if (value >= 85) return 'S'
  if (value >= 72) return 'A'
  if (value >= 60) return 'B'
  return 'C'
}

export default function SimulatorPage() {
  const [aspId, setAspId] = useState(147000000000)
  const [hour, setHour] = useState(21)
  const [weekday, setWeekday] = useState(4)
  const [distance, setDistance] = useState(18400)
  const [fare, setFare] = useState(21500)
  const [paid, setPaid] = useState(true)
  const [surge, setSurge] = useState(false)
  const [eta, setEta] = useState(240)
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [callcards, setCallcards] = useState<SimulatorCallcardRow[]>([])
  const [selectedCallcardId, setSelectedCallcardId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [callcardsLoading, setCallcardsLoading] = useState(false)
  const [driverLoadError, setDriverLoadError] = useState<string | null>(null)
  const [callcardLoadError, setCallcardLoadError] = useState<string | null>(null)
  const [showTop10, setShowTop10] = useState(false)
  const [selectedAxis, setSelectedAxis] = useState<number | null>(null)

  const applyCallcardInput = useCallback((callcard: SimulatorCallcardRow | null) => {
    if (!callcard) return
    if (Number.isFinite(callcard.hour_slot)) setHour(Number(callcard.hour_slot))
    if (Number.isFinite(callcard.weekday)) setWeekday(Number(callcard.weekday))
    if (Number.isFinite(callcard.expected_distance)) setDistance(Number(callcard.expected_distance))
    if (Number.isFinite(callcard.expected_fare)) setFare(Number(callcard.expected_fare))
    if (Number.isFinite(callcard.eta_distance)) setEta(Number(callcard.eta_distance))
    if (typeof callcard.is_paid === 'boolean') setPaid(callcard.is_paid)
    if (typeof callcard.is_surge === 'boolean') setSurge(callcard.is_surge)
  }, [])

  const selectCallcard = useCallback((callcardId: string) => {
    setSelectedCallcardId(callcardId)
    applyCallcardInput(callcards.find((row) => row.callcard_id === callcardId) ?? null)
  }, [applyCallcardInput, callcards])

  useEffect(() => {
    let cancelled = false
    async function loadDrivers() {
      setLoading(true)
      setDriverLoadError(null)
      const { data, error } = await supabase
        .from('driver_mbti')
        .select('*')
        .eq('asp_id', aspId)
        .order('reliability', { ascending: false })
        .limit(3000)

      if (!cancelled) {
        setDrivers((data ?? []) as DriverRow[])
        setDriverLoadError(error?.message ?? null)
        setLoading(false)
      }
    }
    loadDrivers()
    return () => {
      cancelled = true
    }
  }, [aspId])

  useEffect(() => {
    let cancelled = false
    async function loadCallcards() {
      setCallcardsLoading(true)
      setCallcardLoadError(null)
      const { data, error } = await supabase
        .from('callcard_mbti')
        .select(CALLCARD_LOCATION_COLS)
        .eq('asp_id', aspId)
        .order('call_date', { ascending: false })
        .limit(80)

      if (!cancelled) {
        const rows = (data ?? []) as unknown as SimulatorCallcardRow[]
        setCallcards(rows)
        setSelectedCallcardId((current) => {
          const nextId = rows.some((row) => row.callcard_id === current) ? current : rows[0]?.callcard_id ?? ''
          applyCallcardInput(rows.find((row) => row.callcard_id === nextId) ?? null)
          return nextId
        })
        setCallcardLoadError(error?.message ?? null)
        setCallcardsLoading(false)
      }
    }
    loadCallcards()
    return () => {
      cancelled = true
    }
  }, [aspId, applyCallcardInput])

  const callInput = useMemo(() => ({
    hour_slot: hour,
    weekday,
    expected_distance: distance,
    expected_fare: fare,
    is_paid: paid,
    is_surge: surge,
    eta_distance: eta,
  }), [hour, weekday, distance, fare, paid, surge, eta])

  const callVector = useMemo(() => callToVector(callInput), [callInput])
  const callBundle = useMemo(() => vectorToDisplayAxisBundle(callVector), [callVector])
  const selectedCallcard = callcards.find((row) => row.callcard_id === selectedCallcardId) ?? callcards[0] ?? null
  const adaptedLocation = useMemo(() => (
    selectedCallcard ? adaptCallcardLocation(selectedCallcard) : null
  ), [selectedCallcard])

  const ranked = useMemo<Ranked[]>(() => {
    return drivers
      .map((driver, index) => {
        const vector = driverToVector(driver)
        const bundle = vectorToDisplayAxisBundle(vector)
        const cosine = cosineSimilarity(callVector, vector)
        const similarityScore = clamp(cosine * 100)
        const reliability = Number(driver.reliability ?? 0)
        const simDistanceKm = pseudoDistance(driver.driver_id, index)
        const simEtaMin = Math.max(2, Math.round(simDistanceKm * 2.6 + ((index % 4) * 0.75)))
        const pickupAccessibilityScore = clamp(100 - simEtaMin * 4)
        const acceptanceProbability = clamp(similarityScore * 0.62 + reliability * 22 + pickupAccessibilityScore * 0.16)
        const completionProbability = clamp(acceptanceProbability * 0.82 + reliability * 18)
        const spatial = calculateSpatialScore({
          originH3: adaptedLocation?.route.pickup.h3Res7 ?? null,
          destinationH3: adaptedLocation?.route.destination.h3Res7 ?? null,
          preferredOriginH3Cells: driver.pref_s_hexagons,
          preferredDestinationH3Cells: driver.pref_d_hexagons,
        })
        const finalScore = calculateV2FinalScore(similarityScore, spatial.spatialScore)
        const base = {
          driver,
          vector,
          axis: bundle.axis,
          sub: bundle.sub,
          cosine,
          similarityScore,
          acceptanceProbability,
          completionProbability,
          pickupAccessibilityScore,
          spatial,
          finalScore,
          reliability,
          simDistanceKm,
          simEtaMin,
          confidence: confidence(reliability, driver.data_days),
        }
        return {
          ...base,
          lead: makeLead(base, callBundle.axis),
          why: makeWhy(bundle.axis, callBundle.axis, acceptanceProbability, simEtaMin),
        }
      })
      .sort((a, b) => (
        b.finalScore - a.finalScore ||
        b.similarityScore - a.similarityScore ||
        b.reliability - a.reliability ||
        a.driver.driver_id.localeCompare(b.driver.driver_id)
      ))
      .slice(0, 10)
  }, [drivers, callVector, callBundle.axis, adaptedLocation])

  useEffect(() => {
    const nextDriverId = !selectedDriverId && ranked[0]
      ? ranked[0].driver.driver_id
      : selectedDriverId && ranked.length && !ranked.some((row) => row.driver.driver_id === selectedDriverId)
        ? ranked[0].driver.driver_id
        : null
    if (nextDriverId) queueMicrotask(() => setSelectedDriverId(nextDriverId))
  }, [ranked, selectedDriverId])

  const selected = ranked.find((row) => row.driver.driver_id === selectedDriverId) ?? ranked[0]
  const visibleRanked = showTop10 ? ranked : ranked.slice(0, 4)
  const statusLabel = loading || callcardsLoading ? '조회 중' : driverLoadError || callcardLoadError ? '오류' : '정상'

  async function runSimulation() {
    setRunning(true)
    await new Promise((resolve) => setTimeout(resolve, 520))
    setSelectedDriverId(ranked[0]?.driver.driver_id ?? '')
    setRunning(false)
  }

  return (
    <main className="sim-page">
      <PrimaryNav
        active="/simulator"
        title="Happycall PMO"
        subtitle="콜카드 ↔ 기사 매칭 시뮬레이터"
        rightSlot={<button type="button" onClick={runSimulation} disabled={running}>{running ? '재정렬 중' : '시뮬레이션 실행'}</button>}
      />

      <section className="kpi-row" aria-label="시뮬레이터 상태">
        <Kpi label="조회 상태" value={statusLabel} tone={statusLabel === '정상' ? C.green : C.yellow} />
        <Kpi label="실제 콜카드" value={`${callcards.length.toLocaleString()}건`} tone={C.cyan} />
        <Kpi label="후보 기사" value={`${drivers.length.toLocaleString()}명`} tone={C.green} />
        <Kpi label="최고 추천점수" value={selected ? `${Math.round(selected.finalScore)}점` : '-'} tone={C.purple} />
        <Kpi label="정렬 기준" value="최종점수" tone={C.orange} />
      </section>

      <section className="sim-grid">
        <aside className="panel call-panel">
          <SectionEyebrow>CALLCARD INPUT</SectionEyebrow>
          <h1>콜 조건을 바꾸면 기사 후보군이 다시 정렬됩니다</h1>
          <p className="intro">실제 콜카드를 선택하거나 조건을 조정해 22D 성향 유사도와 H3 공간 적합도를 함께 확인합니다.</p>

          <label className="field wide">
            <span>지역</span>
            <select value={aspId} onChange={(event) => setAspId(Number(event.target.value))}>
              {aspOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="field wide">
            <span>실제 콜카드</span>
            <select
              value={selectedCallcardId}
              onChange={(event) => selectCallcard(event.target.value)}
              disabled={callcardsLoading || callcards.length === 0}
            >
              {callcards.length === 0 ? (
                <option value="">{callcardsLoading ? '불러오는 중' : '콜카드 없음'}</option>
              ) : callcards.map((callcard) => (
                <option key={callcard.callcard_id} value={callcard.callcard_id}>
                  {callcard.call_date ?? '-'} / {callcard.callcard_id}
                </option>
              ))}
            </select>
          </label>

          <CallcardSummary
            callcard={selectedCallcard}
            adaptedLocation={adaptedLocation}
            distance={distance}
            fare={fare}
            paid={paid}
            surge={surge}
            eta={eta}
            hour={hour}
            weekday={weekday}
          />

          <div className="input-logic">
            <strong>입력값 조정 가능</strong>
            <span>아래 조건을 바꾸면 콜카드 22D 벡터가 즉시 바뀌고, 기사 Top 후보도 다시 계산됩니다.</span>
          </div>

          <div className="input-grid">
            <NumberField label="시간" value={hour} min={0} max={23} onChange={setHour} suffix="시" />
            <label className="field">
              <span>요일</span>
              <select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
                {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </label>
            <NumberField label="예상거리" value={distance} onChange={setDistance} suffix="m" />
            <NumberField label="예상요금" value={fare} onChange={setFare} suffix="원" />
            <NumberField label="픽업 ETA" value={eta} onChange={setEta} suffix="초" />
          </div>

          <div className="toggle-row">
            <label><input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} /> 유료콜</label>
            <label><input type="checkbox" checked={surge} onChange={(event) => setSurge(event.target.checked)} /> 탄력/프리미엄</label>
          </div>

          <AxisBars title="콜카드 5축 표시" axis={callBundle.axis} tone={C.cyan} />
        </aside>

        <section className="panel stage-panel">
          <div className="stage-head">
            <div>
              <SectionEyebrow>MATCHING FIELD</SectionEyebrow>
              <h2>{selected ? `1순위 ${selected.driver.driver_id}` : '콜카드 입력 대기'}</h2>
              <p>중앙의 콜카드를 기준으로 후보 기사가 최종점수 순으로 배치됩니다. 선이 굵을수록 매칭 우선도가 높습니다.</p>
            </div>
            <div className="score-hero">
              <span>BEST</span>
              <b>{selected ? Math.round(selected.finalScore) : '-'}</b>
              <em>최종점수</em>
            </div>
          </div>

          <ReadinessCard
            drivers={drivers.length}
            callcards={callcards.length}
            ranked={ranked.length}
            driverLoading={loading}
            callcardLoading={callcardsLoading}
            driverError={driverLoadError}
            callcardError={callcardLoadError}
          />

          <MatchField
            ranked={ranked}
            selectedId={selectedDriverId}
            onSelect={setSelectedDriverId}
            callcardId={selectedCallcard?.callcard_id ?? ''}
          />

          <div className="score-split">
            <ScoreTile label="성향 유사도" value={pct(selected?.similarityScore)} desc="콜카드 22D와 기사 22D 코사인 유사도" tone={C.purple} />
            <ScoreTile label="공간 적합도" value={pct(selected?.spatial.spatialScore)} desc="출발·도착 H3와 기사 선호 H3 비교" tone={C.green} />
            <ScoreTile label="예상 수락률" value={pct(selected?.acceptanceProbability)} desc="실제 운영 검증 전 시뮬레이션 비교값" tone={C.yellow} />
            <ScoreTile label="픽업거리/ETA" value={selected ? `${selected.simDistanceKm.toFixed(1)}km · ${selected.simEtaMin}분` : '-'} desc="기사 위치가 없어 데모용 가상 위치 사용" tone={C.orange} />
          </div>

          <p className="lead">{selected?.lead ?? '콜카드와 기사 벡터를 불러오면 추천 근거가 표시됩니다.'}</p>

          <div className="lower-grid">
            <RadarCard
              callAxis={callBundle.axis}
              driverAxis={selected?.axis ?? []}
              selectedAxis={selectedAxis}
              setSelectedAxis={setSelectedAxis}
            />
            <WaterfallCard why={selected?.why ?? []} />
          </div>
        </section>

        <aside className="panel driver-panel">
          <SectionEyebrow>RECOMMENDATION</SectionEyebrow>
          <h2>최종 추천 랭킹</h2>
          <p className="intro">Top 4는 우선발송 후보, Top 10은 검증용 전체 후보입니다.</p>

          <div className="rank-list">
            {ranked.length === 0 ? (
              <div className="empty">추천 후보가 없습니다. 콜카드와 기사 벡터 조회 상태를 확인하세요.</div>
            ) : visibleRanked.map((row, index) => (
              <button
                key={row.driver.driver_id}
                type="button"
                className={row.driver.driver_id === selectedDriverId ? 'rank active' : 'rank'}
                onClick={() => setSelectedDriverId(row.driver.driver_id)}
              >
                <span className="rank-no">#{index + 1}</span>
                <span className="rank-main">
                  <b>{row.driver.driver_id}</b>
                  <em>성향 {pct(row.similarityScore)} · 공간 {pct(row.spatial.spatialScore)}</em>
                </span>
                <strong>{Math.round(row.finalScore)}</strong>
              </button>
            ))}
          </div>

          {ranked.length > 4 && (
            <button type="button" className="show-all" onClick={() => setShowTop10((value) => !value)}>
              {showTop10 ? 'Top 4만 보기' : `Top 10 전체 보기 (${ranked.length}명)`}
            </button>
          )}

          <DriverCard selected={selected} />
          <RadiusCard ranked={ranked} selectedId={selectedDriverId} onSelect={setSelectedDriverId} />
        </aside>
      </section>

      {selectedAxis != null && (
        <FactorDrawer
          axisIndex={selectedAxis}
          callVector={callVector}
          driverVector={selected?.vector ?? []}
          onClose={() => setSelectedAxis(null)}
        />
      )}

      <style jsx global>{`
        body {
          background: ${C.body};
        }
      `}</style>
      <style jsx>{pageCss}</style>
    </main>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <b style={{ color: tone }}>{value}</b>
      <style jsx>{`
        .kpi {
          min-width: 0;
          border-right: 1px solid ${C.line};
          padding: 18px 22px;
          display: grid;
          gap: 4px;
        }
        .kpi span {
          color: ${C.muted};
          font-size: 20px;
          font-weight: 900;
        }
        .kpi b {
          font-size: clamp(28px, 2.4vw, 44px);
          line-height: 1;
          font-weight: 950;
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}

function SectionEyebrow({ children }: { children: string }) {
  return <div className="eyebrow">{children}</div>
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-wrap">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  )
}

function CallcardSummary({
  callcard,
  adaptedLocation,
  distance,
  fare,
  paid,
  surge,
  eta,
  hour,
  weekday,
}: {
  callcard: SimulatorCallcardRow | null
  adaptedLocation: AdaptCallcardLocationResult | null
  distance: number
  fare: number
  paid: boolean
  surge: boolean
  eta: number
  hour: number
  weekday: number
}) {
  const route = adaptedLocation?.route
  const diagnostics = adaptedLocation?.diagnostics
  const mismatch = diagnostics?.pickupH3Mismatch || diagnostics?.destinationH3Mismatch
  return (
    <div className="call-card">
      <div className="call-top">
        <span>{callcard?.call_date ?? '조건 입력'}</span>
        <b>{callcard?.callcard_id ?? '수동 시뮬레이션'}</b>
      </div>
      <div className="call-facts">
        <Fact label="시간" value={`${hour}시 ${weekdays[weekday] ?? '-'}`} />
        <Fact label="거리" value={formatKm(distance)} />
        <Fact label="요금" value={formatFare(fare)} />
        <Fact label="콜유형" value={`${paid ? '유료콜' : '무료콜'}${surge ? ' · 탄력' : ''}`} />
        <Fact label="출발 좌표" value={formatCoord(route?.pickup.lat, route?.pickup.lng)} />
        <Fact label="도착 좌표" value={formatCoord(route?.destination.lat, route?.destination.lng)} />
        <Fact label="출발 H3" value={route?.pickup.h3Res7 ?? '정보 없음'} mono />
        <Fact label="도착 H3" value={route?.destination.h3Res7 ?? '정보 없음'} mono />
      </div>
      <div className="od">
        <span>OD 경로 키</span>
        <b>{route?.originDestinationKey ?? '정보 없음'}</b>
      </div>
      <p className="diag">
        H3 출처: 출발 {sourceLabel(diagnostics?.pickupH3Source ?? 'NONE')} · 도착 {sourceLabel(diagnostics?.destinationH3Source ?? 'NONE')}
        <br />
        좌표 검증: 출발 {diagnostics?.pickupCoordinateValid ? '정상' : '정보 없음'} · 도착 {diagnostics?.destinationCoordinateValid ? '정상' : '정보 없음'} · 입력 ETA {eta}초
      </p>
      {mismatch && <div className="warn">주의: 저장 H3와 좌표 기반 H3가 일치하지 않습니다.</div>}
    </div>
  )
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={mono ? 'fact mono' : 'fact'}>
      <span>{label}</span>
      <b>{value}</b>
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

function ReadinessCard({
  drivers,
  callcards,
  ranked,
  driverLoading,
  callcardLoading,
  driverError,
  callcardError,
}: {
  drivers: number
  callcards: number
  ranked: number
  driverLoading: boolean
  callcardLoading: boolean
  driverError: string | null
  callcardError: string | null
}) {
  const state = driverLoading || callcardLoading
    ? { tone: C.yellow, title: '데이터 조회 중', body: 'callcard_mbti와 driver_mbti를 읽고 있습니다.' }
    : driverError || callcardError
      ? { tone: C.red, title: '데이터 조회 오류', body: driverError ?? callcardError ?? '알 수 없는 조회 오류입니다.' }
      : callcards === 0 || drivers === 0
        ? { tone: C.red, title: '추천 준비 부족', body: `콜카드 ${callcards.toLocaleString()}건 · 기사 ${drivers.toLocaleString()}명입니다.` }
        : { tone: C.green, title: '시뮬레이션 가능', body: `${callcards.toLocaleString()}개 콜카드와 ${drivers.toLocaleString()}명 기사 벡터로 ${ranked.toLocaleString()}명 Top 후보를 계산했습니다.` }
  return (
    <div className="ready" style={{ borderColor: `${state.tone}66`, background: `${state.tone}14` }}>
      <b style={{ color: state.tone }}>{state.title}</b>
      <span>{state.body}</span>
    </div>
  )
}

function MatchField({
  ranked,
  selectedId,
  onSelect,
  callcardId,
}: {
  ranked: Ranked[]
  selectedId: string
  onSelect: (id: string) => void
  callcardId: string
}) {
  const nodes = ranked.slice(0, 10).map((row, index) => {
    const angle = -90 + index * 36
    const radius = index < 4 ? 39 : 47
    const x = 50 + radius * Math.cos(angle * Math.PI / 180)
    const y = 50 + radius * Math.sin(angle * Math.PI / 180)
    return { row, index, x, y }
  })

  return (
    <div className="match-field">
      <svg className="links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {nodes.map(({ row, index, x, y }) => {
          const active = row.driver.driver_id === selectedId
          const width = active ? 1.4 : Math.max(0.25, row.finalScore / 90)
          return (
            <line
              key={row.driver.driver_id}
              x1="50"
              y1="50"
              x2={x}
              y2={y}
              stroke={active ? C.cyan : index < 4 ? C.green : '#64748B'}
              strokeWidth={width}
              opacity={active ? 0.9 : 0.38}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      <div className="call-node">
        <span>CALLCARD</span>
        <b>22D</b>
        <em>{callcardId ? callcardId.slice(0, 14) : '조건 입력'}</em>
      </div>
      {nodes.map(({ row, index, x, y }) => (
        <button
          key={row.driver.driver_id}
          type="button"
          className={row.driver.driver_id === selectedId ? 'driver-node active' : 'driver-node'}
          style={{ left: `${x}%`, top: `${y}%` }}
          onClick={() => onSelect(row.driver.driver_id)}
        >
          <span>{grade(row.finalScore)}</span>
          <b>{Math.round(row.finalScore)}</b>
          <em>#{index + 1}</em>
        </button>
      ))}
    </div>
  )
}

function ScoreTile({ label, value, desc, tone }: { label: string; value: string; desc: string; tone: string }) {
  return (
    <div className="score-tile" style={{ borderColor: `${tone}55`, background: `${tone}10` }}>
      <span style={{ color: tone }}>{label}</span>
      <b>{value}</b>
      <p>{desc}</p>
    </div>
  )
}

function RadarCard({
  callAxis,
  driverAxis,
  selectedAxis,
  setSelectedAxis,
}: {
  callAxis: number[]
  driverAxis: number[]
  selectedAxis: number | null
  setSelectedAxis: (index: number | null) => void
}) {
  return (
    <div className="sub-card">
      <div className="card-head">
        <b>5축 레이더</b>
        <span>계산은 22D · 표시는 5축</span>
      </div>
      <svg className="radar" viewBox="0 0 320 320" role="img" aria-label="콜카드와 기사 5축 레이더 비교">
        {[25, 50, 75, 100].map((value) => (
          <polygon key={value} points={polygonPoints(Array(5).fill(value), 145)} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="1" />
        ))}
        {DISPLAY_AXES.map((axis, index) => {
          const [x, y] = radarPoint(160, 160, 145, index, 108)
          const [lineX, lineY] = radarPoint(160, 160, 145, index, 100)
          return (
            <g key={axis.key} onClick={() => setSelectedAxis(index)} className="axis-label">
              <line x1="160" y1="160" x2={lineX} y2={lineY} stroke="rgba(255,255,255,.10)" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill={selectedAxis === index ? C.cyan : C.sub}>{axis.name}</text>
            </g>
          )
        })}
        <polygon points={polygonPoints(callAxis, 145)} fill="rgba(34,211,238,.16)" stroke={C.cyan} strokeWidth="4" />
        <polygon points={polygonPoints(driverAxis, 145)} fill="rgba(251,146,60,.24)" stroke={C.orange} strokeWidth="4" />
      </svg>
      <div className="radar-legend"><span><i className="call" />콜카드</span><span><i className="driver" />기사</span><span>축 클릭: 22팩터 드릴다운</span></div>
    </div>
  )
}

function radarPoint(cx: number, cy: number, r: number, i: number, value: number) {
  const angle = -Math.PI / 2 + i * 2 * Math.PI / DISPLAY_AXES.length
  return [cx + r * (value / 100) * Math.cos(angle), cy + r * (value / 100) * Math.sin(angle)]
}

function polygonPoints(values: number[], r: number) {
  return values.map((value, index) => radarPoint(160, 160, r, index, value).join(',')).join(' ')
}

function WaterfallCard({ why }: { why: Why[] }) {
  return (
    <div className="sub-card">
      <div className="card-head">
        <b>추천 근거</b>
        <span>왜 이 기사가 올라왔는지</span>
      </div>
      <div className="waterfall">
        {why.map((item) => (
          <div key={item.label} className="why-row">
            <span>{item.label}</span>
            <i><em className={item.type} style={{ width: `${Math.min(item.value * 2, 100)}%` }} /></i>
            <b>{item.type === 'up' ? '+' : '-'}{item.value}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function DriverCard({ selected }: { selected?: Ranked }) {
  if (!selected) {
    return <div className="driver-card empty">선택된 기사가 없습니다.</div>
  }
  return (
    <div className="driver-card">
      <div className="driver-hero">
        <div>
          <span>CANDIDATE</span>
          <b>{selected.driver.driver_id}</b>
        </div>
        <strong>{grade(selected.finalScore)}</strong>
      </div>
      <div className="metric-grid">
        <Metric label="최종점수" value={`${Math.round(selected.finalScore)}점`} />
        <Metric label="성향 유사도" value={pct(selected.similarityScore)} />
        <Metric label="공간 적합도" value={pct(selected.spatial.spatialScore)} />
        <Metric label="신뢰도" value={pct(selected.reliability * 100)} />
        <Metric label="출발지 적합도" value={`${pct(selected.spatial.originScore)} · ${h3DistanceLabel(selected.spatial.originBestDistance)}`} />
        <Metric label="목적지 적합도" value={`${pct(selected.spatial.destinationScore)} · ${h3DistanceLabel(selected.spatial.destinationBestDistance)}`} />
        <Metric label="예상 픽업거리" value={`${selected.simDistanceKm.toFixed(1)}km · 시뮬레이션`} />
        <Metric label="예상 ETA" value={`${selected.simEtaMin}분 · 시뮬레이션`} />
        <Metric label="데이터 기간" value={`${selected.driver.data_days ?? 0}일`} />
        <Metric label="판정 신뢰" value={selected.confidence} />
      </div>
      <AxisBars title="기사 5축 표시" axis={selected.axis} tone={C.green} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function RadiusCard({
  ranked,
  selectedId,
  onSelect,
}: {
  ranked: Ranked[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const tiers = [
    { label: '1차 반경', radius: 2.5 },
    { label: '2차 반경', radius: 5 },
    { label: '3차 반경', radius: 8 },
  ].map((tier) => ({
    ...tier,
    candidates: ranked.filter((row) => row.simDistanceKm <= tier.radius),
  }))

  return (
    <div className="radius-card">
      <div className="card-head">
        <b>반경 확장</b>
        <span>거리/ETA는 시뮬레이션</span>
      </div>
      {tiers.map((tier) => {
        const best = tier.candidates[0]
        return (
          <button
            key={tier.label}
            type="button"
            className={best?.driver.driver_id === selectedId ? 'tier active' : 'tier'}
            disabled={!best}
            onClick={() => best && onSelect(best.driver.driver_id)}
          >
            <span>{tier.label}</span>
            <b>{tier.radius.toFixed(1)}km</b>
            <em>{tier.candidates.length}명 · {best ? `${best.driver.driver_id} ${Math.round(best.finalScore)}점` : '후보 없음'}</em>
          </button>
        )
      })}
    </div>
  )
}

function FactorDrawer({
  axisIndex,
  callVector,
  driverVector,
  onClose,
}: {
  axisIndex: number
  callVector: number[]
  driverVector: number[]
  onClose: () => void
}) {
  const axis = DISPLAY_AXES[axisIndex]
  const callFactors = getDisplayAxisFactors(callVector, axisIndex)
  const driverFactors = getDisplayAxisFactors(driverVector, axisIndex)
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <section className="drawer" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose}>닫기</button>
        <SectionEyebrow>22D FACTOR DRILLDOWN</SectionEyebrow>
        <h2>{axis?.name ?? '팩터'} 세부 계산</h2>
        <p>콜카드 원본 벡터와 선택 기사 벡터를 같은 팩터 순서로 비교합니다.</p>
        <div className="factor-table">
          {callFactors.map((factor, index) => {
            const driver = driverFactors[index]
            const callScore = factor.score ?? 0
            const driverScore = driver?.score ?? 0
            return (
              <div key={factor.key} className="factor-row">
                <div>
                  <b>{factor.label}</b>
                  <span>{factor.group}</span>
                </div>
                <CompareBar label="콜" value={callScore} tone={C.cyan} />
                <CompareBar label="기사" value={driverScore} tone={C.orange} />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function CompareBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="compare">
      <span>{label}</span>
      <i><em style={{ width: `${value}%`, background: tone }} /></i>
      <b>{Math.round(value)}</b>
    </div>
  )
}

const pageCss = `
  .sim-page {
    min-height: 100vh;
    color: ${C.ink};
    background:
      radial-gradient(circle at 50% 0%, rgba(34,211,238,.14), transparent 28%),
      linear-gradient(180deg, #050810 0%, #070B15 100%);
    font-family: Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 20px;
  }
  .kpi-row {
    position: sticky;
    top: 76px;
    z-index: 80;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    border-bottom: 1px solid ${C.line};
    background: rgba(5,8,16,.92);
    backdrop-filter: blur(16px);
  }
  .sim-grid {
    display: grid;
    grid-template-columns: minmax(330px, 0.9fr) minmax(560px, 1.8fr) minmax(360px, 1fr);
    gap: 20px;
    padding: 20px;
    align-items: start;
  }
  .panel {
    min-width: 0;
    border: 1px solid ${C.line};
    border-radius: 28px;
    background: linear-gradient(180deg, rgba(14,22,39,.96), rgba(7,12,24,.96));
    box-shadow: 0 26px 80px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.05);
    padding: 22px;
  }
  .call-panel,
  .driver-panel {
    position: sticky;
    top: 178px;
    max-height: calc(100vh - 198px);
    overflow: auto;
  }
  .eyebrow {
    color: ${C.cyan};
    font-size: 20px;
    line-height: 1;
    font-weight: 950;
    letter-spacing: 0;
    margin-bottom: 12px;
  }
  h1, h2, h3, p {
    margin: 0;
  }
  h1 {
    font-size: clamp(34px, 2.7vw, 54px);
    line-height: 1.08;
    font-weight: 950;
  }
  h2 {
    font-size: clamp(32px, 2.4vw, 50px);
    line-height: 1.06;
    font-weight: 950;
  }
  .intro,
  .stage-head p {
    color: ${C.sub};
    font-size: 21px;
    line-height: 1.45;
    margin-top: 12px;
  }
  .field {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .field.wide {
    margin-top: 18px;
  }
  .field span,
  .call-top span,
  .fact span,
  .od span,
  .metric span {
    color: ${C.muted};
    font-size: 20px;
    font-weight: 900;
  }
  select,
  input[type="number"] {
    width: 100%;
    min-width: 0;
    min-height: 56px;
    border: 1px solid ${C.line};
    border-radius: 16px;
    color: ${C.ink};
    background: #08101F;
    padding: 0 16px;
    font-size: 20px;
    font-weight: 850;
  }
  .number-wrap {
    position: relative;
  }
  .number-wrap em {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: ${C.muted};
    font-size: 20px;
    font-style: normal;
    font-weight: 900;
  }
  .input-logic {
    display: grid;
    gap: 8px;
    margin-top: 18px;
    padding: 18px;
    border: 1px solid rgba(34, 211, 238, 0.34);
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(34, 211, 238, 0.11), rgba(16, 185, 129, 0.08));
  }
  .input-logic strong {
    color: ${C.cyan};
    font-size: 24px;
    line-height: 1.15;
    font-weight: 950;
  }
  .input-logic span {
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.42;
    font-weight: 750;
  }
  .input-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 18px;
  }
  .toggle-row {
    display: grid;
    gap: 10px;
    margin: 18px 0;
  }
  .toggle-row label {
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid ${C.line};
    border-radius: 16px;
    background: rgba(255,255,255,.03);
    padding: 0 16px;
    font-size: 21px;
    font-weight: 900;
  }
  .call-card,
  .driver-card,
  .radius-card,
  .axis-box,
  .sub-card {
    border: 1px solid rgba(34,211,238,.20);
    border-radius: 22px;
    background: rgba(34,211,238,.045);
    padding: 18px;
    margin-top: 18px;
  }
  .call-top {
    display: grid;
    gap: 4px;
  }
  .call-top b {
    color: ${C.ink};
    font-size: 25px;
    font-weight: 950;
    overflow-wrap: anywhere;
  }
  .call-facts,
  .metric-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 16px;
  }
  .fact,
  .metric {
    min-width: 0;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 16px;
    background: rgba(4,8,18,.55);
    padding: 14px;
    display: grid;
    gap: 6px;
  }
  .fact b,
  .metric b {
    color: ${C.ink};
    font-size: 21px;
    font-weight: 950;
    overflow-wrap: anywhere;
  }
  .mono b {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  }
  .od {
    margin-top: 12px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 16px;
    background: rgba(4,8,18,.55);
    padding: 14px;
    display: grid;
    gap: 6px;
  }
  .od b {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 20px;
    overflow-wrap: anywhere;
  }
  .diag {
    margin-top: 12px;
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.45;
  }
  .warn {
    margin-top: 12px;
    border: 1px solid ${C.yellow};
    border-radius: 14px;
    color: ${C.yellow};
    background: rgba(245,158,11,.08);
    padding: 12px;
    font-size: 20px;
    font-weight: 900;
  }
  .axis-box h3 {
    font-size: 24px;
    margin-bottom: 12px;
  }
  .axis-row,
  .compare {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) minmax(120px, 1.4fr) 42px;
    gap: 10px;
    align-items: center;
    margin-top: 10px;
  }
  .axis-row span,
  .compare span {
    color: ${C.sub};
    font-size: 20px;
    font-weight: 900;
  }
  .axis-row i,
  .compare i {
    height: 14px;
    border-radius: 999px;
    background: #1B2740;
    overflow: hidden;
  }
  .axis-row em,
  .compare em {
    display: block;
    height: 100%;
    border-radius: inherit;
  }
  .axis-row b,
  .compare b {
    font-size: 20px;
    text-align: right;
  }
  .stage-head {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 22px;
    align-items: start;
  }
  .score-hero {
    min-width: 150px;
    border: 1px solid rgba(139,92,246,.42);
    border-radius: 24px;
    background: rgba(139,92,246,.12);
    padding: 18px;
    text-align: center;
  }
  .score-hero span,
  .score-hero em {
    display: block;
    color: ${C.sub};
    font-size: 20px;
    font-style: normal;
    font-weight: 950;
  }
  .score-hero b {
    display: block;
    color: ${C.cyan};
    font-size: clamp(54px, 5vw, 88px);
    line-height: .95;
    font-weight: 950;
  }
  .ready {
    margin-top: 18px;
    border: 1px solid;
    border-radius: 18px;
    padding: 16px 18px;
    display: grid;
    gap: 5px;
  }
  .ready b {
    font-size: 22px;
  }
  .ready span {
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.4;
  }
  .match-field {
    position: relative;
    height: clamp(440px, 48vh, 640px);
    margin-top: 20px;
    border: 1px solid rgba(34,211,238,.22);
    border-radius: 30px;
    overflow: hidden;
    background:
      linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
      radial-gradient(circle at center, rgba(34,211,238,.18), transparent 28%),
      rgba(4,8,18,.58);
    background-size: 42px 42px, 42px 42px, auto, auto;
  }
  .links {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .call-node {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 190px;
    height: 160px;
    transform: translate(-50%, -50%);
    border: 2px solid ${C.cyan};
    border-radius: 28px;
    background: rgba(34,211,238,.18);
    display: grid;
    place-items: center;
    align-content: center;
    box-shadow: 0 0 70px rgba(34,211,238,.25);
  }
  .call-node span,
  .call-node em {
    color: #9DEFFF;
    font-size: 20px;
    font-style: normal;
    font-weight: 950;
  }
  .call-node b {
    color: ${C.ink};
    font-size: 58px;
    line-height: 1;
    font-weight: 950;
  }
  .driver-node {
    position: absolute;
    width: 84px;
    height: 84px;
    transform: translate(-50%, -50%);
    border: 2px solid ${C.line};
    border-radius: 22px;
    color: ${C.ink};
    background: rgba(12,18,35,.88);
    display: grid;
    place-items: center;
    align-content: center;
    cursor: pointer;
  }
  .driver-node.active {
    border-color: ${C.cyan};
    background: rgba(34,211,238,.18);
    box-shadow: 0 0 32px rgba(34,211,238,.3);
  }
  .driver-node span {
    color: ${C.green};
    font-size: 26px;
    font-weight: 950;
  }
  .driver-node b {
    font-size: 22px;
    line-height: 1;
  }
  .driver-node em {
    color: ${C.muted};
    font-size: 18px;
    font-style: normal;
    font-weight: 900;
  }
  .score-split,
  .lower-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 18px;
  }
  .score-tile {
    min-width: 0;
    border: 1px solid;
    border-radius: 20px;
    padding: 16px;
  }
  .score-tile span {
    font-size: 20px;
    font-weight: 950;
  }
  .score-tile b {
    display: block;
    margin-top: 8px;
    color: ${C.ink};
    font-size: 34px;
    font-weight: 950;
  }
  .score-tile p {
    margin-top: 6px;
    color: ${C.sub};
    font-size: 20px;
    line-height: 1.35;
  }
  .lead {
    margin-top: 18px;
    border: 1px solid rgba(16,185,129,.32);
    border-radius: 20px;
    background: rgba(16,185,129,.09);
    color: #BDF7D7;
    padding: 18px;
    font-size: 22px;
    line-height: 1.45;
    font-weight: 850;
  }
  .lower-grid {
    grid-template-columns: minmax(360px, 1.1fr) minmax(300px, .9fr);
  }
  .card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 14px;
  }
  .card-head b {
    font-size: 25px;
  }
  .card-head span {
    color: ${C.yellow};
    font-size: 20px;
    font-weight: 900;
  }
  .radar {
    width: 100%;
    min-height: 360px;
  }
  .axis-label {
    cursor: pointer;
  }
  .axis-label text {
    font-size: 18px;
    font-weight: 900;
  }
  .radar-legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    color: ${C.sub};
    font-size: 20px;
    font-weight: 900;
  }
  .radar-legend i {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 5px;
    margin-right: 6px;
    vertical-align: -2px;
  }
  .radar-legend .call {
    background: ${C.cyan};
  }
  .radar-legend .driver {
    background: ${C.orange};
  }
  .waterfall {
    display: grid;
    gap: 14px;
  }
  .why-row {
    display: grid;
    grid-template-columns: minmax(130px, 1fr) minmax(150px, 1.2fr) 54px;
    gap: 12px;
    align-items: center;
  }
  .why-row span {
    color: ${C.sub};
    font-size: 20px;
    font-weight: 900;
  }
  .why-row i {
    height: 20px;
    border-radius: 999px;
    background: #1B2740;
    overflow: hidden;
  }
  .why-row em {
    display: block;
    height: 100%;
    border-radius: inherit;
  }
  .why-row em.up {
    background: ${C.green};
  }
  .why-row em.down {
    background: ${C.red};
  }
  .why-row b {
    text-align: right;
    font-size: 21px;
  }
  .rank-list {
    display: grid;
    gap: 12px;
    margin-top: 18px;
  }
  .rank {
    width: 100%;
    min-width: 0;
    border: 1px solid ${C.line};
    border-radius: 18px;
    color: ${C.ink};
    background: rgba(255,255,255,.025);
    padding: 14px;
    display: grid;
    grid-template-columns: 62px 1fr auto;
    gap: 12px;
    align-items: center;
    text-align: left;
    cursor: pointer;
  }
  .rank.active {
    border-color: ${C.orange};
    background: rgba(251,146,60,.10);
    box-shadow: 0 0 0 1px ${C.orange};
  }
  .rank-no {
    width: 58px;
    height: 58px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, ${C.orange}, #C2410C);
    font-size: 22px;
    font-weight: 950;
  }
  .rank-main {
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .rank-main b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 22px;
  }
  .rank-main em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${C.muted};
    font-size: 20px;
    font-style: normal;
    font-weight: 850;
  }
  .rank strong {
    color: ${C.cyan};
    font-size: 40px;
  }
  .show-all {
    width: 100%;
    min-height: 58px;
    margin-top: 14px;
    border: 1px solid rgba(34,211,238,.36);
    border-radius: 18px;
    color: ${C.cyan};
    background: rgba(34,211,238,.08);
    font-size: 21px;
    font-weight: 950;
    cursor: pointer;
  }
  .driver-hero {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
  }
  .driver-hero span {
    color: ${C.green};
    font-size: 20px;
    font-weight: 950;
  }
  .driver-hero b {
    display: block;
    margin-top: 5px;
    font-size: 26px;
    overflow-wrap: anywhere;
  }
  .driver-hero strong {
    width: 82px;
    height: 82px;
    display: grid;
    place-items: center;
    border-radius: 24px;
    color: ${C.green};
    background: rgba(16,185,129,.15);
    border: 1px solid rgba(16,185,129,.4);
    font-size: 46px;
  }
  .tier {
    width: 100%;
    min-height: 78px;
    border: 1px solid ${C.line};
    border-radius: 18px;
    color: ${C.ink};
    background: rgba(255,255,255,.025);
    padding: 14px;
    margin-top: 10px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    text-align: left;
    cursor: pointer;
  }
  .tier.active {
    border-color: ${C.cyan};
    background: rgba(34,211,238,.08);
  }
  .tier:disabled {
    cursor: not-allowed;
    opacity: .5;
  }
  .tier span {
    color: ${C.sub};
    font-size: 20px;
    font-weight: 950;
  }
  .tier b {
    color: ${C.cyan};
    font-size: 24px;
  }
  .tier em {
    grid-column: 1 / -1;
    color: ${C.muted};
    font-size: 20px;
    font-style: normal;
    font-weight: 850;
    overflow-wrap: anywhere;
  }
  .empty {
    border: 1px dashed ${C.line};
    border-radius: 18px;
    padding: 18px;
    color: ${C.sub};
    font-size: 21px;
    line-height: 1.4;
  }
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    background: rgba(0,0,0,.68);
    padding: 24px;
  }
  .drawer {
    width: min(920px, 100%);
    max-height: 88vh;
    overflow: auto;
    border: 1px solid rgba(34,211,238,.35);
    border-radius: 28px;
    background: #08101F;
    padding: 24px;
    box-shadow: 0 30px 100px rgba(0,0,0,.55);
  }
  .drawer > button {
    float: right;
    min-height: 50px;
    border: 1px solid ${C.line};
    border-radius: 16px;
    color: ${C.ink};
    background: rgba(255,255,255,.05);
    padding: 0 18px;
    font-size: 20px;
    font-weight: 950;
    cursor: pointer;
  }
  .drawer h2 {
    margin-top: 10px;
  }
  .drawer p {
    margin-top: 10px;
    color: ${C.sub};
    font-size: 21px;
  }
  .factor-table {
    display: grid;
    gap: 12px;
    margin-top: 20px;
  }
  .factor-row {
    border: 1px solid ${C.line};
    border-radius: 18px;
    background: rgba(255,255,255,.025);
    padding: 14px;
    display: grid;
    grid-template-columns: 180px 1fr 1fr;
    gap: 14px;
    align-items: center;
  }
  .factor-row b {
    display: block;
    font-size: 22px;
  }
  .factor-row span {
    color: ${C.muted};
    font-size: 20px;
    font-weight: 850;
  }
  @media (max-width: 1320px) {
    .sim-grid {
      grid-template-columns: minmax(320px, .95fr) minmax(520px, 1.5fr);
    }
    .driver-panel {
      grid-column: 1 / -1;
      position: static;
      max-height: none;
    }
  }
  @media (max-width: 980px) {
    .kpi-row {
      position: static;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .sim-grid {
      grid-template-columns: 1fr;
    }
    .call-panel {
      position: static;
      max-height: none;
    }
    .stage-head,
    .lower-grid,
    .score-split {
      grid-template-columns: 1fr;
    }
    .match-field {
      height: 520px;
    }
    .factor-row {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 640px) {
    .sim-page {
      font-size: 20px;
    }
    .sim-grid {
      padding: 14px;
    }
    .panel {
      padding: 18px;
      border-radius: 22px;
    }
    .input-grid,
    .call-facts,
    .metric-grid {
      grid-template-columns: 1fr;
    }
    .kpi-row {
      grid-template-columns: 1fr;
    }
    .match-field {
      height: 460px;
    }
    .call-node {
      width: 150px;
      height: 132px;
    }
    .driver-node {
      width: 72px;
      height: 72px;
    }
  }
`
