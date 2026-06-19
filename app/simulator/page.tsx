'use client'

import { PrimaryNav } from '@/app/components/PrimaryNav'
import { RouteMapPreview } from '@/app/components/RouteMapPreview'
import { adaptCallcardLocation, type CallcardLocationRow } from '@/lib/callcard-location-adapter'
import { calculateSpatialScore, calculateV2FinalScore, type SpatialScoreResult } from '@/lib/h3-match-score'
import { callToVector, cosineSimilarity, driverToVector, type DriverVectorRow } from '@/lib/matching-vector'
import { DISPLAY_AXES, getDisplayAxisFactors, vectorToDisplayAxisBundle } from '@/lib/matching-display-axis'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

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
  passenger_addr?: string | null
  dest_addr?: string | null
  is_paid?: boolean | null
  eta_distance?: number | null
  is_surge?: boolean | null
  product_type?: string | null
}

type Ranked = {
  driver: DriverRow
  vector: number[]
  axis: number[]
  similarityScore: number
  spatial: SpatialScoreResult
  finalScore: number
  reliabilityScore: number
  simDistanceKm: number
  simEtaMin: number
  acceptanceHint: number
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

const aspOptions = [
  { value: 137000000000, label: '인천 137' },
  { value: 147000000000, label: '천안 147' },
  { value: 160000000000, label: '부산 160' },
]

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

const CALLCARD_LOCATION_COLS = [
  'callcard_id',
  'asp_id',
  'call_date',
  'passenger_lat',
  'passenger_lng',
  'dest_lat',
  'dest_lng',
  'passenger_addr',
  'dest_addr',
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
].join(',')

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function pct(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? '-' : `${Math.round(value)}%`
}

function score100(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? 0 : clamp(Math.round(value))
}

function money(value: number | null | undefined) {
  if (value == null) return '-'
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

function meters(value: number | null | undefined) {
  if (value == null) return '-'
  return value >= 1000 ? `${(value / 1000).toFixed(1)}km` : `${Math.round(value)}m`
}

function pseudoDistance(driverId: string, index: number) {
  const seed = Array.from(driverId).reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return 0.7 + ((seed + index * 17) % 82) / 10
}

function sourceLabel(source: 'STORED' | 'COORDINATE' | 'NONE') {
  if (source === 'STORED') return '저장 데이터'
  if (source === 'COORDINATE') return '좌표 계산'
  return '정보 없음'
}

function formatCoord(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return '정보 없음'
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

function callSummary(call?: SimulatorCallcardRow | null) {
  if (!call) return '-'
  const hour = Number(call.hour_slot ?? 0)
  const weekday = weekdays[Number(call.weekday ?? 0)] ?? '-'
  const paid = call.is_paid ? '유료호출' : '일반호출'
  const product = call.is_surge ? '탄력' : '일반'
  return `${hour}시 · ${weekday}요일 · ${meters(call.expected_distance)} · ${money(call.expected_fare)} · ${paid} · ${product}`
}

export default function SimulatorPage() {
  const [aspId, setAspId] = useState(147000000000)
  const [hour, setHour] = useState(21)
  const [weekday, setWeekday] = useState(4)
  const [distance, setDistance] = useState(18400)
  const [fare, setFare] = useState(21500)
  const [eta, setEta] = useState(240)
  const [paid, setPaid] = useState(true)
  const [surge, setSurge] = useState(false)
  const [searchRadiusKm, setSearchRadiusKm] = useState(2)
  const [simulatorMode, setSimulatorMode] = useState<'actual' | 'manual'>('actual')
  const [manualPickupLat, setManualPickupLat] = useState(36.79778)
  const [manualPickupLng, setManualPickupLng] = useState(127.13976)
  const [manualDestinationLat, setManualDestinationLat] = useState(36.77324)
  const [manualDestinationLng, setManualDestinationLng] = useState(127.12915)
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [callcards, setCallcards] = useState<SimulatorCallcardRow[]>([])
  const [selectedCallcardId, setSelectedCallcardId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [loadingCallcards, setLoadingCallcards] = useState(false)
  const [driverError, setDriverError] = useState<string | null>(null)
  const [callcardError, setCallcardError] = useState<string | null>(null)
  const [showTop10, setShowTop10] = useState(false)
  const [selectedAxis, setSelectedAxis] = useState(0)

  function applyCallcard(callcard: SimulatorCallcardRow | null) {
    if (!callcard) return
    if (Number.isFinite(callcard.hour_slot)) setHour(Number(callcard.hour_slot))
    if (Number.isFinite(callcard.weekday)) setWeekday(Number(callcard.weekday))
    if (Number.isFinite(callcard.expected_distance)) setDistance(Number(callcard.expected_distance))
    if (Number.isFinite(callcard.expected_fare)) setFare(Number(callcard.expected_fare))
    if (Number.isFinite(callcard.eta_distance)) setEta(Number(callcard.eta_distance))
    if (typeof callcard.is_paid === 'boolean') setPaid(callcard.is_paid)
    if (typeof callcard.is_surge === 'boolean') setSurge(callcard.is_surge)
  }

  useEffect(() => {
    let cancelled = false
    async function loadDrivers() {
      setLoadingDrivers(true)
      setDriverError(null)
      const { data, error } = await supabase
        .from('driver_mbti')
        .select('*')
        .eq('asp_id', aspId)
        .order('reliability', { ascending: false })
        .limit(3000)

      if (cancelled) return
      setDrivers((data ?? []) as DriverRow[])
      setDriverError(error?.message ?? null)
      setLoadingDrivers(false)
    }
    loadDrivers()
    return () => {
      cancelled = true
    }
  }, [aspId])

  useEffect(() => {
    let cancelled = false
    async function loadCallcards() {
      setLoadingCallcards(true)
      setCallcardError(null)
      const { data, error } = await supabase
        .from('callcard_mbti')
        .select(CALLCARD_LOCATION_COLS)
        .eq('asp_id', aspId)
        .order('call_date', { ascending: false })
        .limit(80)

      if (cancelled) return
      const rows = (data ?? []) as unknown as SimulatorCallcardRow[]
      setCallcards(rows)
      setCallcardError(error?.message ?? null)
      const nextId = rows[0]?.callcard_id ?? ''
      setSelectedCallcardId(nextId)
      applyCallcard(rows[0] ?? null)
      setLoadingCallcards(false)
    }
    loadCallcards()
    return () => {
      cancelled = true
    }
  }, [aspId])

  const selectedActualCallcard = callcards.find((row) => row.callcard_id === selectedCallcardId) ?? callcards[0] ?? null
  const manualCallcard = useMemo<SimulatorCallcardRow>(() => ({
    callcard_id: '직접 입력 콜카드',
    asp_id: aspId,
    call_date: '직접 입력',
    passenger_lat: manualPickupLat,
    passenger_lng: manualPickupLng,
    dest_lat: manualDestinationLat,
    dest_lng: manualDestinationLng,
    passenger_addr: '직접 입력 출발지',
    dest_addr: '직접 입력 도착지',
    s_hexagon: null,
    d_hexagon: null,
    hour_slot: hour,
    weekday,
    expected_distance: distance,
    expected_fare: fare,
    eta_distance: eta,
    is_paid: paid,
    is_surge: surge,
    product_type: surge ? '탄력' : '일반',
  }), [aspId, manualPickupLat, manualPickupLng, manualDestinationLat, manualDestinationLng, hour, weekday, distance, fare, eta, paid, surge])

  const selectedCallcard = simulatorMode === 'manual' ? manualCallcard : selectedActualCallcard
  const adaptedLocation = useMemo(() => (
    selectedCallcard ? adaptCallcardLocation(selectedCallcard) : null
  ), [selectedCallcard])

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
  const callAxes = useMemo(() => vectorToDisplayAxisBundle(callVector).axis, [callVector])

  const ranked = useMemo<Ranked[]>(() => {
    return drivers
      .map((driver, index) => {
        const vector = driverToVector(driver)
        const axis = vectorToDisplayAxisBundle(vector).axis
        const cosine = cosineSimilarity(callVector, vector)
        const similarityScore = clamp(cosine * 100)
        const spatial = calculateSpatialScore({
          originH3: adaptedLocation?.route.pickup.h3Res7 ?? null,
          destinationH3: adaptedLocation?.route.destination.h3Res7 ?? null,
          preferredOriginH3Cells: driver.pref_s_hexagons,
          preferredDestinationH3Cells: driver.pref_d_hexagons,
        })
        const finalScore = calculateV2FinalScore(similarityScore, spatial.spatialScore)
        const simDistanceKm = pseudoDistance(driver.driver_id, index)
        const simEtaMin = Math.max(2, Math.round(simDistanceKm * 2.6 + (index % 4) * 0.75))
        const reliabilityScore = clamp(Number(driver.reliability ?? 0) * 100)
        const acceptanceHint = clamp(similarityScore * 0.62 + reliabilityScore * 0.22 + (100 - simEtaMin * 4) * 0.16)
        return {
          driver,
          vector,
          axis,
          similarityScore,
          spatial,
          finalScore,
          reliabilityScore,
          simDistanceKm,
          simEtaMin,
          acceptanceHint,
        }
      })
      .sort((a, b) => (
        b.finalScore - a.finalScore ||
        b.similarityScore - a.similarityScore ||
        b.reliabilityScore - a.reliabilityScore ||
        a.driver.driver_id.localeCompare(b.driver.driver_id)
      ))
      .slice(0, 10)
  }, [drivers, callVector, adaptedLocation])

  useEffect(() => {
    if (!ranked.length) {
      queueMicrotask(() => setSelectedDriverId(''))
      return
    }
    if (!ranked.some((row) => row.driver.driver_id === selectedDriverId)) {
      queueMicrotask(() => setSelectedDriverId(ranked[0].driver.driver_id))
    }
  }, [ranked, selectedDriverId])

  const selected = ranked.find((row) => row.driver.driver_id === selectedDriverId) ?? ranked[0]
  const visibleRanked = showTop10 ? ranked : ranked.slice(0, 4)
  const driverAxes = selected?.axis ?? []
  const callFactors = getDisplayAxisFactors(callVector, selectedAxis)
  const driverFactors = getDisplayAxisFactors(selected?.vector ?? [], selectedAxis)
  const statusLabel = loadingDrivers || loadingCallcards ? '확인 중' : driverError || callcardError ? '오류' : '정상'

  function selectCallcard(callcardId: string) {
    setSimulatorMode('actual')
    setSelectedCallcardId(callcardId)
    applyCallcard(callcards.find((row) => row.callcard_id === callcardId) ?? null)
  }

  return (
    <main className="page">
      <PrimaryNav
        active="/simulator"
        title="KONAMOBILITY"
        subtitle="MATCH SIMULATOR"
        rightSlot={<Pill color={C.cyan}>콜수락율 우선배차</Pill>}
      />

      <section className="topRail" aria-label="시뮬레이터 핵심 지표">
        <Kpi title="조회 상태" value={statusLabel} meta={driverError ?? callcardError ?? 'Supabase 실데이터 기준'} color={statusLabel === '정상' ? C.green : C.yellow} />
        <Kpi title="콜카드" value={selectedCallcard ? '1건 선택' : '-'} meta={`${callcards.length.toLocaleString('ko-KR')}건 후보`} color={C.cyan} />
        <Kpi title="후보 기사" value={`${ranked.length}명`} meta={`${drivers.length.toLocaleString('ko-KR')}명 누적 패턴`} color={C.green} />
        <Kpi title="우선발송 점수" value={selected ? `${Math.round(selected.finalScore)}점` : '-'} meta="성향 75% + 공간 25%" color={C.orange} />
      </section>

      <div className="shell">
        <section className="hero">
          <div>
            <span className="eyebrow">MATCH SIMULATOR</span>
            <h1>콜 조건을 넣으면 먼저 보내볼 기사 순서를 보여줍니다.</h1>
            <p>
              지역, 요일, 시간, 출발지, 도착지, 예상거리, 예상요금, 호출유형을 기준으로
              누적 기사 운행패턴과 비교해 콜수락 가능성이 높은 후보를 정렬합니다.
            </p>
          </div>
          <Winner selected={selected} />
        </section>

        <section className="mainGrid">
          <aside className="panel inputPanel">
            <SectionTitle label="CALLCARD INPUT" title="콜카드 조건" />
            <label className="field">
              <span>지역</span>
              <select value={aspId} onChange={(event) => setAspId(Number(event.target.value))}>
                {aspOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <div className="modeSwitch">
              <button type="button" className={simulatorMode === 'actual' ? 'active' : ''} onClick={() => setSimulatorMode('actual')}>실제 콜카드</button>
              <button type="button" className={simulatorMode === 'manual' ? 'active' : ''} onClick={() => setSimulatorMode('manual')}>직접 입력</button>
            </div>
            <label className="field">
              <span>실제 콜카드 선택</span>
              <select value={selectedCallcardId} disabled={simulatorMode === 'manual'} onChange={(event) => selectCallcard(event.target.value)}>
                {callcards.length === 0 ? <option value="">콜카드 없음</option> : callcards.map((callcard) => (
                  <option key={callcard.callcard_id} value={callcard.callcard_id}>
                    {callcard.call_date ?? '-'} / {callcard.callcard_id}
                  </option>
                ))}
              </select>
            </label>

            {simulatorMode === 'manual' && (
              <div className="manualGrid">
                <NumberField label="출발 위도" value={manualPickupLat} onChange={setManualPickupLat} />
                <NumberField label="출발 경도" value={manualPickupLng} onChange={setManualPickupLng} />
                <NumberField label="도착 위도" value={manualDestinationLat} onChange={setManualDestinationLat} />
                <NumberField label="도착 경도" value={manualDestinationLng} onChange={setManualDestinationLng} />
              </div>
            )}

            <CallcardCard callcard={selectedCallcard} adaptedLocation={adaptedLocation} />

            <div className="controlGrid">
              <NumberField label="시간" value={hour} min={0} max={23} onChange={setHour} suffix="시" />
              <label className="field">
                <span>요일</span>
                <select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
                  {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
                </select>
              </label>
              <NumberField label="예상거리" value={distance} onChange={setDistance} suffix="m" />
              <NumberField label="예상요금" value={fare} onChange={setFare} suffix="원" />
              <NumberField label="탑승 ETA" value={eta} onChange={setEta} suffix="초" />
            </div>

            <label className="rangeField">
              <span>탐색 반경 <b>{searchRadiusKm}km</b></span>
              <input type="range" min={1} max={3} step={1} value={searchRadiusKm} onChange={(event) => setSearchRadiusKm(Number(event.target.value))} />
              <em>실시간 기사 위치가 연결되기 전까지 반경은 시뮬레이션 기준입니다.</em>
            </label>

            <div className="toggleRow">
              <label><input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} /> 유료호출</label>
              <label><input type="checkbox" checked={surge} onChange={(event) => setSurge(event.target.checked)} /> 탄력/프리미엄</label>
            </div>
          </aside>

          <section className="panel resultPanel">
            <SectionTitle label="RECOMMENDATION" title="먼저 보내볼 기사 후보" />
            <div className="resultHero">
              <div>
                <span>현재 콜카드</span>
                <strong>{selectedCallcard?.callcard_id ?? '-'}</strong>
                <p>{callSummary(selectedCallcard)}</p>
              </div>
              <b>{selected ? Math.round(selected.finalScore) : '-'}</b>
            </div>

            <div className="scoreGrid">
              <ScoreBox title="성향 유사도" value={pct(selected?.similarityScore)} meta="콜카드 22D와 기사 22D" color={C.violet} />
              <ScoreBox title="공간 적합도" value={pct(selected?.spatial.spatialScore)} meta="출발·도착 H3 선호" color={C.green} />
              <ScoreBox title="수락 가능성 참고값" value={pct(selected?.acceptanceHint)} meta="운영 검증 전 비교값" color={C.yellow} />
              <ScoreBox title="거리/ETA 시뮬레이션" value={selected ? `${selected.simDistanceKm.toFixed(1)}km · ${selected.simEtaMin}분` : '-'} meta="실시간 위치 미연동" color={C.orange} />
            </div>

            <RouteMapPreview
              pickup={adaptedLocation?.route.pickup}
              destination={adaptedLocation?.route.destination}
              expectedDistanceMeters={distance}
              etaSeconds={eta}
              title="콜카드 출발지·도착지"
              compact
            />

            <div className="axisCompare">
              <AxisBars title="콜카드 5축" axes={callAxes} color={C.cyan} />
              <AxisBars title="선택 기사 5축" axes={driverAxes} color={C.green} />
            </div>
          </section>

          <aside className="panel rankPanel">
            <SectionTitle label="TOP CANDIDATES" title="우선발송 순서" />
            <div className="rankList">
              {visibleRanked.length === 0 ? (
                <div className="empty">후보 기사가 없습니다.</div>
              ) : visibleRanked.map((row, index) => (
                <button
                  key={row.driver.driver_id}
                  type="button"
                  className={row.driver.driver_id === selectedDriverId ? 'active' : ''}
                  onClick={() => setSelectedDriverId(row.driver.driver_id)}
                >
                  <span>#{index + 1}</span>
                  <strong>{row.driver.driver_id}</strong>
                  <em>성향 {pct(row.similarityScore)} · 공간 {pct(row.spatial.spatialScore)}</em>
                  <b>{Math.round(row.finalScore)}</b>
                </button>
              ))}
            </div>
            {ranked.length > 4 && (
              <button type="button" className="showAll" onClick={() => setShowTop10((value) => !value)}>
                {showTop10 ? '상위 4명만 보기' : `후보 10명 전체 보기 (${ranked.length}명)`}
              </button>
            )}

            <DriverSummary selected={selected} />
            <RadiusScenario ranked={ranked} radius={searchRadiusKm} />
          </aside>
        </section>

        <section className="panel drillPanel">
          <SectionTitle label="FACTOR DRILLDOWN" title="왜 이 기사가 가까운가" />
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
              return <CompareRow key={factor.key} label={factor.label} callScore={factor.score} driverScore={driver?.score} />
            })}
          </div>
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

function Winner({ selected }: { selected?: Ranked }) {
  return (
    <aside className="winner">
      <span>1순위 후보</span>
      <strong>{selected?.driver.driver_id ?? '-'}</strong>
      <b>{selected ? `${Math.round(selected.finalScore)}점` : '-'}</b>
      <p>우선발송 점수 기준으로 가장 먼저 보내볼 기사입니다.</p>
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

function NumberField({ label, value, onChange, min, max, suffix }: {
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
      <div className="numberWrap">
        <input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  )
}

function CallcardCard({ callcard, adaptedLocation }: {
  callcard: SimulatorCallcardRow | null
  adaptedLocation: ReturnType<typeof adaptCallcardLocation> | null
}) {
  const diagnostics = adaptedLocation?.diagnostics
  return (
    <article className="callcardCard">
      <span>선택 콜카드</span>
      <strong>{callcard?.callcard_id ?? '-'}</strong>
      <p>{callSummary(callcard)}</p>
      <div>
        <Fact label="출발 좌표" value={formatCoord(adaptedLocation?.route.pickup.lat, adaptedLocation?.route.pickup.lng)} />
        <Fact label="도착 좌표" value={formatCoord(adaptedLocation?.route.destination.lat, adaptedLocation?.route.destination.lng)} />
        <Fact label="출발 H3" value={adaptedLocation?.route.pickup.h3Res7 ?? '-'} />
        <Fact label="도착 H3" value={adaptedLocation?.route.destination.h3Res7 ?? '-'} />
        <Fact label="H3 출처" value={`${sourceLabel(diagnostics?.pickupH3Source ?? 'NONE')} · ${sourceLabel(diagnostics?.destinationH3Source ?? 'NONE')}`} />
        <Fact label="OD 경로 키" value={adaptedLocation?.route.originDestinationKey ?? '-'} />
      </div>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function ScoreBox({ title, value, meta, color }: { title: string; value: string; meta: string; color: string }) {
  return (
    <article className="scoreBox" style={{ '--tone': color } as CSSProperties}>
      <span>{title}</span>
      <strong>{value}</strong>
      <em>{meta}</em>
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

function DriverSummary({ selected }: { selected?: Ranked }) {
  return (
    <article className="driverSummary">
      <span>선택 기사</span>
      <strong>{selected?.driver.driver_id ?? '-'}</strong>
      <div>
        <Fact label="데이터 일수" value={selected?.driver.data_days == null ? '-' : `${selected.driver.data_days}일`} />
        <Fact label="신뢰도" value={pct(selected?.reliabilityScore)} />
        <Fact label="출발지 적합도" value={pct(selected?.spatial.originScore)} />
        <Fact label="도착지 적합도" value={pct(selected?.spatial.destinationScore)} />
      </div>
    </article>
  )
}

function RadiusScenario({ ranked, radius }: { ranked: Ranked[]; radius: number }) {
  const rounds = [
    { label: '1차 탐색', radius, count: ranked.slice(0, 3).length },
    { label: '2차 확장', radius: radius + 1, count: ranked.slice(3, 7).length },
    { label: '3차 확장', radius: radius + 2, count: ranked.slice(7, 10).length },
  ]
  return (
    <article className="radius">
      <span>미수락 시 반경 확장</span>
      {rounds.map((round) => (
        <div key={round.label}>
          <b>{round.label}</b>
          <em>{round.radius}km · 후보 {round.count}명</em>
        </div>
      ))}
      <p>현재 기사 위치는 실제 운영값이 아니므로 반경은 시뮬레이션 표시입니다.</p>
    </article>
  )
}

function CompareRow({ label, callScore, driverScore }: { label: string; callScore: number | null | undefined; driverScore: number | null | undefined }) {
  const callValue = score100(callScore)
  const driverValue = score100(driverScore)
  return (
    <div className="compareRow">
      <strong>{label}</strong>
      <div>
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
      radial-gradient(circle at 22% 0%, rgba(56,189,248,.14), transparent 34rem),
      radial-gradient(circle at 82% 10%, rgba(84,209,122,.12), transparent 34rem),
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
  .shell {
    max-width: var(--maxw);
    margin: 0 auto;
    padding: clamp(22px, 2.2vw, 38px) clamp(16px, 2vw, 28px) 72px;
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
  .winner {
    border: 1px solid rgba(56,189,248,.42);
    border-radius: 20px;
    background: rgba(56,189,248,.09);
    padding: 28px;
    display: grid;
    align-content: center;
    gap: 12px;
  }
  .winner span,
  .callcardCard > span,
  .driverSummary > span,
  .radius > span {
    color: ${C.sub};
    font-size: 20px;
    font-weight: 850;
  }
  .winner strong,
  .callcardCard > strong,
  .driverSummary > strong {
    color: ${C.ink};
    font-size: 28px;
    line-height: 1.15;
    font-weight: 950;
    overflow-wrap: anywhere;
  }
  .winner b {
    color: ${C.cyan};
    font-size: clamp(48px, 4vw, 70px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.06em;
  }
  .mainGrid {
    display: grid;
    grid-template-columns: minmax(320px, .92fr) minmax(0, 1.35fr) minmax(320px, .9fr);
    gap: 18px;
    margin-top: 18px;
    align-items: start;
  }
  .panel,
  .drillPanel {
    border: 1px solid ${C.line};
    border-radius: 22px;
    background: rgba(16,21,31,.76);
    padding: clamp(20px, 2vw, 30px);
    min-width: 0;
  }
  .sectionTitle h2 {
    margin: 8px 0 0;
    color: ${C.ink};
    font-size: clamp(30px, 2.4vw, 44px);
    line-height: 1.08;
    font-weight: 950;
    letter-spacing: -.05em;
  }
  .field {
    display: grid;
    gap: 8px;
    margin-top: 16px;
  }
  .field span,
  .rangeField span {
    color: ${C.sub};
    font-size: 18px;
    font-weight: 850;
  }
  .field select,
  .field input {
    width: 100%;
    height: 52px;
    border: 1px solid ${C.line};
    border-radius: 14px;
    background: ${C.panel2};
    color: ${C.ink};
    padding: 0 14px;
    font-size: 18px;
    font-weight: 800;
  }
  .numberWrap {
    position: relative;
  }
  .numberWrap em {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: ${C.sub};
    font-style: normal;
    font-size: 15px;
    font-weight: 800;
  }
  .modeSwitch,
  .toggleRow {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 18px;
  }
  .modeSwitch button,
  .showAll,
  .axisTabs button {
    min-height: 46px;
    border: 1px solid ${C.line};
    border-radius: 999px;
    background: rgba(255,255,255,.04);
    color: ${C.sub};
    padding: 0 16px;
    font-size: 17px;
    font-weight: 900;
    cursor: pointer;
  }
  .modeSwitch button.active,
  .axisTabs button.active {
    color: #071018;
    border-color: ${C.cyan};
    background: ${C.cyan};
  }
  .manualGrid,
  .controlGrid,
  .scoreGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 18px;
  }
  .callcardCard,
  .driverSummary,
  .radius {
    margin-top: 18px;
    border: 1px solid ${C.line};
    border-radius: 18px;
    background: ${C.panel2};
    padding: 20px;
  }
  .callcardCard p {
    color: ${C.sub};
    font-size: 18px;
    line-height: 1.4;
    font-weight: 700;
  }
  .callcardCard > div,
  .driverSummary > div {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }
  .fact {
    min-width: 0;
    border: 1px solid ${C.line};
    border-radius: 14px;
    background: rgba(255,255,255,.035);
    padding: 13px;
  }
  .fact span {
    color: ${C.muted};
    font-size: 15px;
    font-weight: 850;
  }
  .fact b {
    display: block;
    margin-top: 7px;
    color: ${C.ink};
    font-size: 17px;
    line-height: 1.25;
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .rangeField {
    display: grid;
    gap: 10px;
    margin-top: 18px;
  }
  .rangeField input {
    width: 100%;
  }
  .rangeField em,
  .scoreBox em,
  .radius p {
    color: ${C.sub};
    font-size: 16px;
    line-height: 1.4;
    font-style: normal;
    font-weight: 650;
  }
  .toggleRow label {
    color: ${C.ink};
    border: 1px solid ${C.line};
    border-radius: 14px;
    background: rgba(255,255,255,.04);
    min-height: 48px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 17px;
    font-weight: 850;
  }
  .resultHero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 20px;
    align-items: center;
    margin-top: 18px;
    border: 1px solid rgba(56,189,248,.36);
    border-radius: 20px;
    background: rgba(56,189,248,.08);
    padding: 22px;
  }
  .resultHero span {
    color: ${C.sub};
    font-size: 18px;
    font-weight: 850;
  }
  .resultHero strong {
    display: block;
    margin-top: 8px;
    color: ${C.ink};
    font-size: 28px;
    line-height: 1.15;
    font-weight: 950;
    overflow-wrap: anywhere;
  }
  .resultHero p {
    margin: 8px 0 0;
    color: ${C.sub};
    font-size: 18px;
    line-height: 1.35;
    font-weight: 700;
  }
  .resultHero b {
    color: ${C.cyan};
    font-size: clamp(58px, 5vw, 88px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.06em;
  }
  .scoreBox {
    border: 1px solid color-mix(in srgb, var(--tone) 38%, transparent);
    border-radius: 18px;
    background: color-mix(in srgb, var(--tone) 8%, ${C.panel2});
    padding: 18px;
  }
  .scoreBox span {
    color: var(--tone);
    font-size: 18px;
    font-weight: 950;
  }
  .scoreBox strong {
    display: block;
    margin-top: 10px;
    color: ${C.ink};
    font-size: 34px;
    line-height: 1;
    font-weight: 950;
  }
  .axisCompare {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
    margin-top: 18px;
  }
  .axisBars {
    display: grid;
    gap: 12px;
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
    font-size: 16px;
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
  .rankList {
    display: grid;
    gap: 10px;
    margin-top: 18px;
  }
  .rankList button {
    border: 1px solid ${C.line};
    border-radius: 18px;
    background: rgba(255,255,255,.035);
    color: ${C.ink};
    min-height: 82px;
    padding: 14px;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    gap: 4px 12px;
    align-items: center;
    cursor: pointer;
  }
  .rankList button.active {
    border-color: rgba(56,189,248,.75);
    background: rgba(56,189,248,.1);
  }
  .rankList span {
    grid-row: 1 / 3;
    color: ${C.orange};
    font-size: 18px;
    font-weight: 950;
  }
  .rankList strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 18px;
    font-weight: 950;
  }
  .rankList em {
    color: ${C.sub};
    font-size: 15px;
    font-style: normal;
    font-weight: 700;
  }
  .rankList b {
    grid-row: 1 / 3;
    color: ${C.cyan};
    font-size: 34px;
    font-weight: 950;
  }
  .showAll {
    width: 100%;
    margin-top: 12px;
  }
  .radius div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid ${C.line};
    padding-top: 12px;
    margin-top: 12px;
  }
  .radius b {
    color: ${C.ink};
    font-size: 18px;
    font-weight: 950;
  }
  .radius em {
    color: ${C.sub};
    font-size: 17px;
    font-style: normal;
    font-weight: 800;
  }
  .drillPanel {
    margin-top: 18px;
  }
  .axisTabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
  .compareRows {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
    color: ${C.ink};
    font-size: 18px;
    font-weight: 950;
  }
  .compareRow > div {
    display: grid;
    grid-template-columns: 74px minmax(0, 1fr);
    gap: 8px 12px;
    align-items: center;
    margin-top: 12px;
  }
  .compareRow span {
    color: ${C.sub};
    font-size: 16px;
    font-weight: 850;
  }
  .compareRow i {
    display: block;
    height: 10px;
    border-radius: 999px;
    background: rgba(255,255,255,.08);
    overflow: hidden;
  }
  .compareRow b {
    display: block;
    height: 100%;
    border-radius: inherit;
  }
  .empty {
    color: ${C.sub};
    border: 1px solid ${C.line};
    border-radius: 16px;
    background: rgba(255,255,255,.035);
    padding: 20px;
    font-size: 18px;
    font-weight: 800;
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
  @media (max-width: 1380px) {
    .mainGrid,
    .axisCompare,
    .compareRows {
      grid-template-columns: 1fr 1fr;
    }
    .rankPanel {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 880px) {
    .topRail,
    .hero,
    .mainGrid,
    .axisCompare,
    .manualGrid,
    .controlGrid,
    .scoreGrid,
    .compareRows {
      grid-template-columns: 1fr;
    }
    h1 {
      font-size: 42px;
    }
  }
`
