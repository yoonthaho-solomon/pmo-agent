'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  VECTOR_DIMENSIONS,
  callToVector,
  cosineSimilarity,
  driverToVector,
  type DriverVectorRow,
} from '@/lib/matching-vector'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type DriverRow = DriverVectorRow & {
  driver_id: string
  asp_id: number
  reliability: number | null
  data_days: number | null
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
  card: '#0A101D',
  ink: '#E2E8F0',
  sub: '#94A3B8',
  muted: '#64748B',
  line: '#1E293B',
  cyan: '#22D3EE',
  purple: '#8B5CF6',
  green: '#10B981',
  red: '#F43F5E',
  orange: '#FB923C',
  yellow: '#F59E0B',
}

const BASELINE_ACCEPTANCE = 29

const aspOptions = [
  { value: 137000000000, label: '인천 137' },
  { value: 147000000000, label: '천안 147' },
  { value: 160000000000, label: '부산 160' },
]

const weekdays = ['월', '화', '수', '목', '금', '토', '일']

const AXES = [
  { name: '픽업 수용도', indexes: [21, 11, 12, 13] },
  { name: '출발지·지역 친숙도', indexes: [0, 1, 2, 3] },
  { name: '목적지 선호도', indexes: [4, 5, 6, 7, 8] },
  { name: '운행거리·시간', indexes: [9, 10, 18, 19, 20] },
  { name: '수익 매력도', indexes: [14, 15, 16, 17] },
] as const

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

function toScore(value: number | null | undefined) {
  return clamp(Number(value ?? 0) * 100)
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toAxisBundle(vector: number[]) {
  const sub = AXES.map((axis) => axis.indexes.map((index) => toScore(vector[index])))
  const axis = sub.map((values) => average(values))
  return { axis, sub }
}

function axisGap(callAxis: number[], driverAxis: number[], index: number) {
  return Math.abs((callAxis[index] ?? 0) - (driverAxis[index] ?? 0))
}

function makeLead(row: Pick<Ranked, 'axis' | 'similarityScore' | 'simEtaMin'>, callAxis: number[]) {
  const bestAxis = AXES
    .map((axis, index) => ({ axis: axis.name, diff: axisGap(callAxis, row.axis, index) }))
    .sort((a, b) => a.diff - b.diff)[0]
  return `${bestAxis.axis}이 가장 잘 맞고, 픽업 ETA ${row.simEtaMin}분 조건에서 성향 유사도 ${Math.round(row.similarityScore)}점입니다.`
}

function makeWhy(driverAxis: number[], callAxis: number[], acceptance: number, etaMin: number): Why[] {
  const matches = AXES.map((axis, index) => ({
    label: axis.name,
    score: clamp(100 - axisGap(callAxis, driverAxis, index)),
  })).sort((a, b) => b.score - a.score)
  const gaps = AXES.map((axis, index) => ({
    label: axis.name,
    gap: axisGap(callAxis, driverAxis, index),
  })).sort((a, b) => b.gap - a.gap)

  return [
    { type: 'up', label: `${matches[0].label} 일치`, value: Math.round(matches[0].score / 3) },
    { type: 'up', label: `예상 수락률 ${Math.round(acceptance)}%`, value: Math.round(acceptance / 4) },
    { type: etaMin <= 7 ? 'up' : 'down', label: `픽업 ETA ${etaMin}분`, value: etaMin <= 7 ? 18 : 16 },
    { type: 'down', label: `${gaps[0].label} 차이`, value: Math.round(gaps[0].gap / 3) },
  ]
}

function confidence(reliability: number, dataDays: number | null | undefined): Ranked['confidence'] {
  if (reliability >= 0.7 && Number(dataDays ?? 0) >= 30) return 'HIGH'
  if (reliability >= 0.45 && Number(dataDays ?? 0) >= 10) return 'MEDIUM'
  return 'LOW'
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
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('driver_mbti')
        .select('*')
        .eq('asp_id', aspId)
        .order('reliability', { ascending: false })
        .limit(3000)

      if (!cancelled) {
        setDrivers((data ?? []) as DriverRow[])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [aspId])

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
  const callBundle = useMemo(() => toAxisBundle(callVector), [callVector])

  const ranked = useMemo<Ranked[]>(() => {
    return drivers
      .map((driver, index) => {
        const vector = driverToVector(driver)
        const bundle = toAxisBundle(vector)
        const cosine = cosineSimilarity(callVector, vector)
        const similarityScore = clamp(cosine * 100)
        const reliability = Number(driver.reliability ?? 0)
        const simDistanceKm = pseudoDistance(driver.driver_id, index)
        const simEtaMin = Math.max(2, Math.round(simDistanceKm * 2.6 + ((index % 4) * 0.75)))
        const pickupAccessibilityScore = clamp(100 - simEtaMin * 4)
        const acceptanceProbability = clamp(similarityScore * 0.62 + reliability * 22 + pickupAccessibilityScore * 0.16)
        const completionProbability = clamp(acceptanceProbability * 0.82 + reliability * 18)
        const finalScore = clamp(
          acceptanceProbability * 0.4 +
          similarityScore * 0.25 +
          pickupAccessibilityScore * 0.2 +
          completionProbability * 0.1 +
          reliability * 100 * 0.05
        )
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
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 10)
  }, [drivers, callVector, callBundle.axis])

  useEffect(() => {
    if (!selectedDriverId && ranked[0]) setSelectedDriverId(ranked[0].driver.driver_id)
    if (selectedDriverId && ranked.length && !ranked.some((row) => row.driver.driver_id === selectedDriverId)) {
      setSelectedDriverId(ranked[0].driver.driver_id)
    }
  }, [ranked, selectedDriverId])

  const selected = ranked.find((row) => row.driver.driver_id === selectedDriverId) ?? ranked[0]

  async function runSimulation() {
    setRunning(true)
    await new Promise((resolve) => setTimeout(resolve, 650))
    setSelectedDriverId(ranked[0]?.driver.driver_id ?? '')
    setRunning(false)
  }

  return (
    <main className="sim-page">
      <Topbar running={running} onRun={runSimulation} />

      <section className="sim-shell">
        <CallcardPanel
          aspId={aspId}
          setAspId={setAspId}
          hour={hour}
          setHour={setHour}
          weekday={weekday}
          setWeekday={setWeekday}
          distance={distance}
          setDistance={setDistance}
          fare={fare}
          setFare={setFare}
          paid={paid}
          setPaid={setPaid}
          surge={surge}
          setSurge={setSurge}
          eta={eta}
          setEta={setEta}
          callBundle={callBundle}
          running={running}
        />

        <section className="panel center-panel">
          <div className="headline">
            {loading ? '기사 벡터를 불러오는 중입니다' : selected ? (
              <>추천 1순위 <b>{selected.driver.driver_id}</b> · 유사도 {pct(selected.similarityScore)}</>
            ) : '추천 후보를 기다리는 중입니다'}
          </div>
          <div className="legend">
            <span><i style={{ background: C.cyan }} />콜 요구</span>
            <span><i style={{ background: C.orange }} />기사 성향</span>
            <span className="hint">축 클릭 시 22팩터 드릴다운</span>
          </div>
          <DataSourceStrip driverCount={drivers.length} />
          <MatchRadar callAxis={callBundle.axis} driverAxis={selected?.axis ?? []} callSub={callBundle.sub} driverSub={selected?.sub ?? []} />
          <div className="lead">{selected ? selected.lead : '콜 조건과 기사 성향을 비교할 준비가 됐습니다.'}</div>
          <DispatchPipeline selected={selected} />
          <RadiusExpansionPanel ranked={ranked} selectedId={selectedDriverId} onSelect={setSelectedDriverId} />
          <MatchWaterfall why={selected?.why ?? []} />
        </section>

        <DecisionPanel
          ranked={ranked}
          selectedId={selectedDriverId}
          setSelectedId={setSelectedDriverId}
          selected={selected}
        />
      </section>

      <style jsx global>{`
        html { font-size: clamp(15px, 1.1vw, 20px); }
        body { background: ${C.body}; }
      `}</style>
      <style jsx>{`
        .sim-page {
          min-height: 100vh;
          background: ${C.body};
          color: ${C.ink};
          font-family: Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .sim-shell {
          display: grid;
          grid-template-columns: minmax(220px, 300px) 1fr minmax(260px, 360px);
          gap: 1.2rem;
          padding: 1.2rem 1.6rem;
          align-items: stretch;
        }
        .panel {
          background: ${C.card};
          border: 1px solid ${C.line};
          border-radius: 20px;
          padding: 1.3rem;
          min-width: 0;
        }
        .center-panel {
          border-color: rgba(34, 211, 238, .3);
          box-shadow: inset 0 0 40px rgba(34, 211, 238, .03);
        }
        .headline {
          min-height: 1.6em;
          text-align: center;
          font-size: clamp(1.3rem, 3vw, 1.7rem);
          line-height: 1.2;
          font-weight: 900;
        }
        .headline b {
          color: ${C.cyan};
          text-shadow: 0 0 15px rgba(34, 211, 238, .5);
        }
        .legend {
          display: flex;
          justify-content: center;
          gap: 1.2rem;
          color: ${C.sub};
          font-size: clamp(.8rem, 1.4vw, .9rem);
          margin: .75rem 0;
          flex-wrap: wrap;
        }
        .legend i {
          display: inline-block;
          width: .9rem;
          height: .9rem;
          border-radius: 4px;
          margin-right: .4rem;
          vertical-align: -2px;
        }
        .hint { color: ${C.purple}; }
        .lead {
          background: rgba(16, 185, 129, .08);
          border: 1px solid rgba(16, 185, 129, .25);
          border-radius: 12px;
          padding: .85rem 1.1rem;
          font-size: clamp(.95rem, 1.8vw, 1.1rem);
          font-weight: 700;
          text-align: center;
          margin: .6rem 0;
        }
        @media (max-width: 1100px) {
          .sim-shell {
            grid-template-columns: 1fr 1fr;
            grid-template-areas:
              "left center"
              "right center";
          }
          .left-panel { grid-area: left; }
          .center-panel { grid-area: center; }
          .right-panel { grid-area: right; }
        }
        @media (max-width: 760px) {
          html { font-size: clamp(15px, 4vw, 18px); }
          .sim-shell {
            grid-template-columns: 1fr;
            grid-template-areas: none;
            padding: 1rem;
          }
          .center-panel { order: -1; }
        }
      `}</style>
    </main>
  )
}

function Topbar({ running, onRun }: { running: boolean; onRun: () => void }) {
  const nav = [
    ['적재현황', '/ingest'],
    ['벡터리스트', '/vectors'],
    ['시뮬레이터', '/simulator'],
    ['배차로직', '/dispatch-logic'],
  ]

  return (
    <header className="topbar">
      <Link href="/dashboard" className="brand">
        <span className="dot" />
        <span>콜카드 <b>↔</b> 기사 매칭 시뮬레이터</span>
      </Link>
      <nav>
        {nav.map(([label, href]) => (
          <Link key={href} href={href} className={href === '/simulator' ? 'active' : ''}>{label}</Link>
        ))}
      </nav>
      <button type="button" onClick={onRun} disabled={running}>{running ? '계산 중' : '시뮬레이션 가동'}</button>
      <style jsx>{`
        .topbar {
          min-height: 64px;
          padding: 1rem 1.6rem;
          display: grid;
          grid-template-columns: minmax(260px, 1fr) auto auto;
          gap: 1rem;
          align-items: center;
          border-bottom: 1px solid ${C.line};
          background: rgba(10, 16, 29, .84);
        }
        .brand {
          color: ${C.ink};
          text-decoration: none;
          font-size: clamp(1.05rem, 2.2vw, 1.4rem);
          font-weight: 950;
          display: flex;
          align-items: center;
          gap: .75rem;
        }
        .brand b { color: ${C.cyan}; }
        .dot {
          width: .85rem;
          height: .85rem;
          border-radius: 999px;
          background: ${C.cyan};
          box-shadow: 0 0 16px ${C.cyan};
        }
        nav {
          display: flex;
          gap: .45rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        nav a {
          color: ${C.sub};
          text-decoration: none;
          border: 1px solid ${C.line};
          border-radius: 10px;
          padding: .55rem .7rem;
          font-size: .82rem;
          font-weight: 850;
          background: rgba(15, 23, 42, .7);
        }
        nav a.active {
          color: ${C.cyan};
          border-color: ${C.cyan};
          background: rgba(34, 211, 238, .1);
        }
        button {
          border: 0;
          border-radius: 12px;
          padding: .75rem 1.1rem;
          color: white;
          background: linear-gradient(135deg, ${C.cyan}, ${C.purple});
          font: inherit;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(34, 211, 238, .24);
        }
        button:disabled {
          opacity: .55;
          cursor: wait;
        }
        @media (max-width: 920px) {
          .topbar { grid-template-columns: 1fr; }
          nav { justify-content: flex-start; }
          button { justify-self: start; }
        }
      `}</style>
    </header>
  )
}

function CallcardPanel(props: {
  aspId: number
  setAspId: (v: number) => void
  hour: number
  setHour: (v: number) => void
  weekday: number
  setWeekday: (v: number) => void
  distance: number
  setDistance: (v: number) => void
  fare: number
  setFare: (v: number) => void
  paid: boolean
  setPaid: (v: boolean) => void
  surge: boolean
  setSurge: (v: boolean) => void
  eta: number
  setEta: (v: number) => void
  callBundle: { axis: number[]; sub: number[][] }
  running: boolean
}) {
  const tags = AXES.flatMap((axis) => axis.indexes.map((index) => VECTOR_DIMENSIONS[index].label))
  return (
    <aside className="panel left-panel">
      <PanelTitle color={C.cyan}>입력된 콜카드</PanelTitle>
      <div className="route"><span>출발 H3 준비</span><b>→</b><span>도착 H3 준비</span></div>
      <AxisSnapshot axis={props.callBundle.axis} />
      <div className="rows">
        <Select label="지역" value={props.aspId} onChange={props.setAspId} options={aspOptions} />
        <Two>
          <NumberInput label="시간" value={props.hour} min={0} max={23} onChange={props.setHour} />
          <label className="field">요일
            <select value={props.weekday} onChange={(event) => props.setWeekday(Number(event.target.value))}>
              {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
          </label>
        </Two>
        <NumberInput label="예상거리 m" value={props.distance} onChange={props.setDistance} />
        <NumberInput label="예상요금 원" value={props.fare} onChange={props.setFare} />
        <NumberInput label="픽업 ETA 초" value={props.eta} onChange={props.setEta} />
        <label className="check"><input type="checkbox" checked={props.paid} onChange={(event) => props.setPaid(event.target.checked)} /> 유료콜</label>
        <label className="check"><input type="checkbox" checked={props.surge} onChange={(event) => props.setSurge(event.target.checked)} /> 탄력/프리미엄</label>
      </div>

      <PanelTitle color={C.purple}>22 벡터 팩터</PanelTitle>
      <div className="factors">
        {tags.map((tag, index) => <span key={`${tag}-${index}`} className={props.running ? 'active' : ''}>{tag}</span>)}
      </div>
      <style jsx>{panelCss}</style>
    </aside>
  )
}

function AxisSnapshot({ axis }: { axis: number[] }) {
  return (
    <div className="axis-snapshot">
      {AXES.map((item, index) => (
        <div key={item.name} className="axis-card">
          <span>{item.name}</span>
          <b>{Math.round(axis[index] ?? 0)}</b>
          <i style={{ width: `${axis[index] ?? 0}%` }} />
        </div>
      ))}
      <style jsx>{`
        .axis-snapshot {
          display: grid;
          grid-template-columns: 1fr;
          gap: .5rem;
          margin: .85rem 0 1rem;
        }
        .axis-card {
          position: relative;
          min-height: 3.2rem;
          overflow: hidden;
          border: 1px solid rgba(34,211,238,.18);
          border-radius: 12px;
          background: rgba(34,211,238,.045);
          padding: .7rem .75rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .7rem;
        }
        .axis-card span {
          position: relative;
          z-index: 2;
          color: ${C.sub};
          font-size: clamp(.74rem, 1.3vw, .86rem);
          font-weight: 850;
          line-height: 1.2;
        }
        .axis-card b {
          position: relative;
          z-index: 2;
          color: ${C.cyan};
          font-size: clamp(1.05rem, 2vw, 1.35rem);
          font-weight: 950;
        }
        .axis-card i {
          position: absolute;
          inset: auto auto 0 0;
          height: 3px;
          background: linear-gradient(90deg, ${C.cyan}, ${C.purple});
          box-shadow: 0 0 16px rgba(34,211,238,.35);
          transition: width .55s ease;
        }
      `}</style>
    </div>
  )
}

function DataSourceStrip({ driverCount }: { driverCount: number }) {
  const items = [
    { label: '계산', value: '22D 코사인', tone: C.cyan },
    { label: '기사군', value: `driver_mbti ${driverCount.toLocaleString()}명`, tone: C.green },
    { label: '레이더', value: '5축 표시용', tone: C.purple },
    { label: '위치/H3', value: '미연결', tone: C.yellow },
  ]

  return (
    <div className="source-strip">
      {items.map((item) => (
        <div key={item.label} className="source-item">
          <span>{item.label}</span>
          <b style={{ color: item.tone }}>{item.value}</b>
        </div>
      ))}
      <style jsx>{`
        .source-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: .55rem;
          margin: .75rem 0 1rem;
        }
        .source-item {
          min-width: 0;
          border: 1px solid ${C.line};
          border-radius: 12px;
          background: rgba(255,255,255,.025);
          padding: .55rem .65rem;
          text-align: center;
        }
        .source-item span {
          display: block;
          color: ${C.muted};
          font-size: clamp(.66rem, 1.2vw, .74rem);
          font-weight: 850;
          margin-bottom: .18rem;
        }
        .source-item b {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: clamp(.76rem, 1.35vw, .9rem);
          font-weight: 950;
        }
        @media (max-width: 760px) {
          .source-strip { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  )
}

function DispatchPipeline({ selected }: { selected?: Ranked }) {
  const steps = [
    { title: '후보 생성', desc: '현재는 ASP 기사군 기준', state: '실데이터' },
    { title: '상태 필터', desc: '온라인·공차·위치 최신성 필요', state: '미연결' },
    { title: '22D 랭킹', desc: selected ? `${selected.driver.driver_id} 우선` : '후보 대기', state: '실계산' },
    { title: '콜카드 발송', desc: '실배차 API 계약 단계', state: '준비' },
  ]

  return (
    <div className="pipeline">
      {steps.map((step, index) => (
        <div key={step.title} className="pipe-step">
          <span>{index + 1}</span>
          <b>{step.title}</b>
          <small>{step.desc}</small>
          <em data-state={step.state}>{step.state}</em>
        </div>
      ))}
      <style jsx>{`
        .pipeline {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: .6rem;
          margin: .75rem 0 .4rem;
        }
        .pipe-step {
          position: relative;
          min-width: 0;
          border: 1px solid ${C.line};
          border-radius: 14px;
          background: rgba(15,23,42,.58);
          padding: .75rem;
          display: grid;
          gap: .24rem;
        }
        .pipe-step span {
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: ${C.body};
          background: ${C.cyan};
          font-size: .78rem;
          font-weight: 950;
        }
        .pipe-step b {
          color: ${C.ink};
          font-size: clamp(.8rem, 1.45vw, .95rem);
          font-weight: 950;
        }
        .pipe-step small {
          color: ${C.muted};
          font-size: clamp(.68rem, 1.2vw, .78rem);
          line-height: 1.25;
        }
        .pipe-step em {
          justify-self: start;
          margin-top: .15rem;
          border-radius: 999px;
          padding: .18rem .45rem;
          color: ${C.sub};
          background: rgba(255,255,255,.05);
          font-size: .66rem;
          font-style: normal;
          font-weight: 950;
        }
        .pipe-step em[data-state="실데이터"],
        .pipe-step em[data-state="실계산"] {
          color: ${C.green};
          background: rgba(16,185,129,.12);
        }
        .pipe-step em[data-state="미연결"] {
          color: ${C.yellow};
          background: rgba(245,158,11,.12);
        }
        @media (max-width: 760px) {
          .pipeline { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  )
}

function RadiusExpansionPanel({
  ranked,
  selectedId,
  onSelect,
}: {
  ranked: Ranked[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const tiers = [
    { label: '1차', radius: 2.5, note: '근거리 우선 발송' },
    { label: '2차', radius: 5, note: '미수락 시 확장' },
    { label: '3차', radius: 8, note: '순차 배차 전 마지막 후보군' },
  ].map((tier) => ({
    ...tier,
    candidates: ranked.filter((row) => row.simDistanceKm <= tier.radius),
  }))

  return (
    <div className="radius-panel">
      <div className="radius-head">
        <b>반경 확장 시나리오</b>
        <span>실시간 위치 연결 전까지 거리/ETA는 시뮬레이션 값</span>
      </div>
      <div className="rings">
        {tiers.map((tier) => {
          const best = tier.candidates[0]
          const isSelected = best?.driver.driver_id === selectedId
          return (
            <button
              key={tier.label}
              type="button"
              className={isSelected ? 'ring active' : 'ring'}
              onClick={() => best && onSelect(best.driver.driver_id)}
              disabled={!best}
            >
              <span>{tier.label}</span>
              <b>{tier.radius.toFixed(1)}km</b>
              <small>{tier.candidates.length}명 · {best ? `${best.driver.driver_id} / ${Math.round(best.similarityScore)}%` : '후보 없음'}</small>
              <em>{tier.note}</em>
            </button>
          )
        })}
      </div>
      <style jsx>{`
        .radius-panel {
          border: 1px solid rgba(34,211,238,.18);
          border-radius: 16px;
          background:
            radial-gradient(circle at 16% 50%, rgba(34,211,238,.14), transparent 28%),
            rgba(255,255,255,.025);
          padding: .9rem;
          margin: .75rem 0 .4rem;
        }
        .radius-head {
          display: flex;
          justify-content: space-between;
          gap: .8rem;
          align-items: baseline;
          margin-bottom: .7rem;
          flex-wrap: wrap;
        }
        .radius-head b {
          color: ${C.ink};
          font-size: clamp(.95rem, 1.7vw, 1.1rem);
          font-weight: 950;
        }
        .radius-head span {
          color: ${C.yellow};
          font-size: clamp(.72rem, 1.25vw, .82rem);
          font-weight: 850;
        }
        .rings {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: .65rem;
        }
        .ring {
          min-width: 0;
          border: 1px solid ${C.line};
          border-radius: 14px;
          background: rgba(5,8,16,.56);
          color: ${C.ink};
          padding: .78rem;
          text-align: left;
          display: grid;
          gap: .18rem;
          cursor: pointer;
        }
        .ring:disabled {
          cursor: not-allowed;
          opacity: .45;
        }
        .ring.active {
          border-color: ${C.cyan};
          box-shadow: 0 0 0 1px ${C.cyan}, 0 0 22px rgba(34,211,238,.18);
          background: rgba(34,211,238,.09);
        }
        .ring span {
          color: ${C.muted};
          font-size: .72rem;
          font-weight: 950;
        }
        .ring b {
          color: ${C.cyan};
          font-size: clamp(1.15rem, 2vw, 1.45rem);
          font-weight: 950;
        }
        .ring small {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: ${C.sub};
          font-size: clamp(.72rem, 1.25vw, .82rem);
          font-weight: 850;
        }
        .ring em {
          color: ${C.muted};
          font-size: .68rem;
          font-style: normal;
          font-weight: 800;
        }
        @media (max-width: 760px) {
          .rings { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}

function DecisionPanel({
  ranked,
  selectedId,
  setSelectedId,
  selected,
}: {
  ranked: Ranked[]
  selectedId: string
  setSelectedId: (id: string) => void
  selected?: Ranked
}) {
  const [showAll, setShowAll] = useState(false)
  const delta = Math.round((selected?.acceptanceProbability ?? 0) - BASELINE_ACCEPTANCE)
  const visible = showAll ? ranked : ranked.slice(0, 4)
  return (
    <aside className="panel right-panel">
      <PanelTitle color={C.orange}>{showAll ? '유사도 랭킹 Top 10' : '유사도 랭킹 Top 4'}</PanelTitle>
      <div className="data-note">
        기사 성향은 Supabase `driver_mbti` 기준입니다. 거리와 ETA는 실시간 위치 테이블 연결 전까지 시뮬레이션용 표시값입니다.
      </div>
      <div className="rank-list">
        {ranked.length === 0 ? (
          <div className="empty-rank">
            <b>추천 후보 없음</b>
            <span>선택한 ASP에 기사 벡터가 없거나 아직 로딩 중입니다.</span>
          </div>
        ) : visible.map((row, index) => (
          <button
            key={row.driver.driver_id}
            className={row.driver.driver_id === selectedId ? 'driver active' : 'driver'}
            onClick={() => setSelectedId(row.driver.driver_id)}
          >
            <span className="badge">{index + 1}</span>
            <span className="meta">
              <b>{row.driver.driver_id}</b>
              <small>{row.simDistanceKm.toFixed(1)}km · ETA {row.simEtaMin}분 · {row.confidence}</small>
            </span>
            <span className="score">{Math.round(row.similarityScore)}<small>%</small></span>
          </button>
        ))}
      </div>
      {ranked.length > 4 && (
        <button type="button" className="toggle-rank" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Top 4만 보기' : `Top 10 전체 보기 (${ranked.length}명)`}
        </button>
      )}

      <PanelTitle color={C.green}>예상 수락률 KPI</PanelTitle>
      <div className="kpi-box">
        <KpiRow label="기존 순번" value={BASELINE_ACCEPTANCE} color={C.muted} />
        <KpiRow label="우선 배차" value={Math.round(selected?.acceptanceProbability ?? 0)} color={C.green} delta={delta} />
      </div>

      <PanelTitle color={C.cyan}>점수 분리</PanelTitle>
      <div className="split">
        <Metric label="성향 유사도" value={pct(selected?.similarityScore)} />
        <Metric label="예상 수락률" value={pct(selected?.acceptanceProbability)} />
        <Metric label="완료 가능성" value={pct(selected?.completionProbability)} />
        <Metric label="최종 추천점수" value={pct(selected?.finalScore)} />
      </div>
      <style jsx>{`
        .rank-list { display: grid; gap: .75rem; margin-bottom: 1.2rem; }
        .toggle-rank {
          width: 100%;
          border: 1px solid rgba(34,211,238,.32);
          border-radius: 12px;
          background: rgba(34,211,238,.08);
          color: ${C.cyan};
          padding: .7rem;
          font: inherit;
          font-size: clamp(.78rem, 1.35vw, .9rem);
          font-weight: 950;
          cursor: pointer;
          margin: -.45rem 0 1.2rem;
        }
        .data-note {
          border: 1px solid rgba(245,158,11,.24);
          border-radius: 12px;
          background: rgba(245,158,11,.08);
          color: #FDBA74;
          padding: .75rem;
          line-height: 1.45;
          font-size: clamp(.76rem, 1.35vw, .86rem);
          font-weight: 800;
          margin-bottom: .85rem;
        }
        .empty-rank {
          border: 1px dashed ${C.line};
          border-radius: 14px;
          padding: 1rem;
          display: grid;
          gap: .35rem;
          color: ${C.sub};
          background: rgba(255,255,255,.025);
        }
        .empty-rank b { color: ${C.ink}; }
        .driver {
          width: 100%;
          border: 1px solid ${C.line};
          border-radius: 14px;
          background: rgba(255,255,255,.025);
          color: ${C.ink};
          padding: .85rem;
          display: grid;
          grid-template-columns: 2.6rem 1fr auto;
          align-items: center;
          gap: .75rem;
          text-align: left;
          cursor: pointer;
          opacity: .75;
        }
        .driver.active {
          opacity: 1;
          border-color: ${C.orange};
          background: rgba(251,146,60,.08);
          box-shadow: 0 0 0 1px ${C.orange};
        }
        .badge {
          width: 2.6rem;
          height: 2.6rem;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-weight: 950;
          background: linear-gradient(135deg, ${C.orange}, #EA580C);
        }
        .meta { min-width: 0; display: grid; gap: .2rem; }
        .meta b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .meta small { color: ${C.muted}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .score { color: ${C.cyan}; font-size: clamp(1.25rem, 2.4vw, 1.75rem); font-weight: 950; }
        .score small { color: ${C.muted}; font-size: .55em; }
        .kpi-box {
          border: 1px solid rgba(16,185,129,.2);
          border-radius: 16px;
          background: rgba(16,185,129,.05);
          padding: 1rem;
          margin-bottom: 1.2rem;
        }
        .split { display: grid; gap: .7rem; }
      `}</style>
    </aside>
  )
}

function MatchRadar({
  callAxis,
  driverAxis,
  callSub,
  driverSub,
}: {
  callAxis: number[]
  driverAxis: number[]
  callSub: number[][]
  driverSub: number[][]
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [selectedAxis, setSelectedAxis] = useState<number | null>(null)
  const hitRef = useRef<{ x: number; y: number; i: number }[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const context = ctx

    let raf = 0
    let start = performance.now()
    const dpr = window.devicePixelRatio || 1

    function sizeCanvas() {
      if (!canvas || !wrap) return
      const side = Math.max(Math.min(wrap.clientWidth, wrap.clientHeight, 600), 220)
      canvas.style.width = `${side}px`
      canvas.style.height = `${side}px`
      canvas.width = side * dpr
      canvas.height = side * dpr
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function point(cx: number, cy: number, r: number, i: number, value: number) {
      const angle = -Math.PI / 2 + i * 2 * Math.PI / AXES.length
      return [cx + r * (value / 100) * Math.cos(angle), cy + r * (value / 100) * Math.sin(angle)]
    }

    function drawPoly(cx: number, cy: number, r: number, vals: number[], stroke: string, fill: string, progress = 1) {
      const next = vals.map((value) => value * progress)
      context.beginPath()
      for (let i = 0; i <= AXES.length; i++) {
        const [x, y] = point(cx, cy, r, i % AXES.length, next[i % AXES.length] ?? 0)
        if (i === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.closePath()
      context.fillStyle = fill
      context.fill()
      context.shadowBlur = 15
      context.shadowColor = stroke
      context.strokeStyle = stroke
      context.lineWidth = 3
      context.stroke()
      context.shadowBlur = 0
      next.forEach((value, i) => {
        const [x, y] = point(cx, cy, r, i, value)
        context.beginPath()
        context.arc(x, y, 4, 0, Math.PI * 2)
        context.fillStyle = '#fff'
        context.fill()
        context.strokeStyle = stroke
        context.lineWidth = 2
        context.stroke()
      })
    }

    function draw(now: number) {
      if (!canvas) return
      sizeCanvas()
      const w = Number.parseFloat(canvas.style.width)
      const h = Number.parseFloat(canvas.style.height)
      context.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const labelFont = Math.max(11, Math.min(w * 0.032, 17))
      const r = Math.min(w, h) / 2 - Math.max(48, w * 0.1)
      hitRef.current = []

      for (let g = 1; g <= 4; g++) {
        context.beginPath()
        for (let i = 0; i <= AXES.length; i++) {
          const [x, y] = point(cx, cy, r, i % AXES.length, g * 25)
          if (i === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.strokeStyle = 'rgba(255,255,255,.08)'
        context.lineWidth = 1
        context.stroke()
      }

      context.font = `800 ${labelFont}px Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      AXES.forEach((axis, i) => {
        const [x, y] = point(cx, cy, r, i, 100)
        context.beginPath()
        context.moveTo(cx, cy)
        context.lineTo(x, y)
        context.strokeStyle = 'rgba(255,255,255,.1)'
        context.stroke()
        const [lx, ly] = point(cx, cy, r + labelFont * 1.7, i, 100)
        context.fillStyle = selectedAxis === i ? C.cyan : '#94A3B8'
        context.fillText(axis.name, lx, ly)
        hitRef.current.push({ x: lx, y: ly, i })
      })

      drawPoly(cx, cy, r, callAxis, C.cyan, 'rgba(34,211,238,.16)')
      const p = Math.min((now - start) / 620, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      context.globalCompositeOperation = 'screen'
      drawPoly(cx, cy, r, driverAxis, C.orange, 'rgba(251,146,60,.28)', eased)
      context.globalCompositeOperation = 'source-over'
      if (p < 1) raf = requestAnimationFrame(draw)
    }

    start = performance.now()
    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', sizeCanvas)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', sizeCanvas)
    }
  }, [callAxis, driverAxis, selectedAxis])

  function onCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = event.clientX - rect.left
    const my = event.clientY - rect.top
    const hit = hitRef.current
      .map((item) => ({ ...item, d: (item.x - mx) ** 2 + (item.y - my) ** 2 }))
      .sort((a, b) => a.d - b.d)[0]
    if (hit && hit.d < 55 * 55) setSelectedAxis(hit.i)
  }

  return (
    <>
      <div className="radar-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} onClick={onCanvasClick} />
      </div>
      {selectedAxis != null && (
        <FactorDrilldown
          axisIndex={selectedAxis}
          callValues={callSub[selectedAxis] ?? []}
          driverValues={driverSub[selectedAxis] ?? []}
          onClose={() => setSelectedAxis(null)}
        />
      )}
      <style jsx>{`
        .radar-wrap {
          min-height: clamp(260px, 42vh, 480px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        canvas {
          width: 100%;
          height: 100%;
          max-width: 600px;
          cursor: pointer;
        }
        @media (max-width: 760px) {
          .radar-wrap { min-height: clamp(280px, 70vw, 380px); }
        }
      `}</style>
    </>
  )
}

function MatchWaterfall({ why }: { why: Why[] }) {
  return (
    <div className="waterfall">
      {why.map((item, index) => {
        const width = Math.min(item.value * 1.5, 48)
        return (
          <div key={`${item.label}-${index}`} className="wf-row">
            <div className="wf-label">{item.type === 'down' ? item.label : ''}</div>
            <div className="wf-track">
              <div className="wf-center" />
              <div className={item.type === 'up' ? 'wf-bar pos' : 'wf-bar neg'} style={{ width: `${width}%` }}>
                {item.type === 'up' ? '+' : '-'}{item.value}
              </div>
            </div>
            <div className="wf-label right">{item.type === 'up' ? item.label : ''}</div>
          </div>
        )
      })}
      <style jsx>{`
        .waterfall {
          margin-top: .75rem;
          padding-top: 1rem;
          border-top: 1px solid ${C.line};
          display: grid;
          gap: .6rem;
        }
        .wf-row {
          display: grid;
          grid-template-columns: 1fr minmax(120px, 1.4fr) 1fr;
          gap: .7rem;
          align-items: center;
          font-size: clamp(.8rem, 1.5vw, .95rem);
          font-weight: 700;
        }
        .wf-label { color: ${C.muted}; text-align: right; line-height: 1.25; }
        .wf-label.right { text-align: left; }
        .wf-track {
          position: relative;
          height: 1.9rem;
          background: rgba(255,255,255,.035);
          border-radius: 14px;
          overflow: hidden;
        }
        .wf-center {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 2px;
          background: rgba(255,255,255,.2);
          transform: translateX(-50%);
          z-index: 2;
        }
        .wf-bar {
          position: absolute;
          top: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          padding: 0 .6rem;
          color: white;
          font-weight: 950;
          font-size: clamp(.78rem, 1.4vw, .9rem);
        }
        .wf-bar.pos {
          left: 50%;
          justify-content: flex-end;
          background: linear-gradient(90deg, transparent, ${C.green});
          border-right: 2px solid ${C.green};
        }
        .wf-bar.neg {
          right: 50%;
          justify-content: flex-start;
          background: linear-gradient(270deg, transparent, ${C.red});
          border-left: 2px solid ${C.red};
        }
      `}</style>
    </div>
  )
}

function FactorDrilldown({
  axisIndex,
  callValues,
  driverValues,
  onClose,
}: {
  axisIndex: number
  callValues: number[]
  driverValues: number[]
  onClose: () => void
}) {
  const axis = AXES[axisIndex]
  return (
    <div className="modal-bg" onClick={(event) => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <div className="modal">
        <h3>{axis.name}</h3>
        <p>이 축을 구성하는 원본 팩터입니다. 위쪽은 콜카드, 아래쪽은 선택 기사입니다.</p>
        <div className="items">
          {axis.indexes.map((dimensionIndex, index) => (
            <div key={dimensionIndex} className="factor-row">
              <span>{VECTOR_DIMENSIONS[dimensionIndex].label}</span>
              <div className="bar">
                <i className="call" style={{ width: `${callValues[index] ?? 0}%` }} />
                <i className="driver" style={{ width: `${driverValues[index] ?? 0}%` }} />
              </div>
              <b>{Math.round(callValues[index] ?? 0)} / {Math.round(driverValues[index] ?? 0)}</b>
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose}>닫기</button>
      </div>
      <style jsx>{`
        .modal-bg {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: rgba(5,8,16,.86);
          backdrop-filter: blur(8px);
        }
        .modal {
          width: min(620px, 100%);
          max-height: 88vh;
          overflow: auto;
          border: 1px solid ${C.line};
          border-radius: 20px;
          background: ${C.card};
          padding: 1.5rem;
          box-shadow: 0 20px 50px rgba(0,0,0,.5);
        }
        h3 { color: ${C.cyan}; font-size: clamp(1.25rem, 2.4vw, 1.5rem); margin: 0; }
        p { color: ${C.sub}; line-height: 1.5; }
        .items { display: grid; gap: .9rem; margin-top: 1rem; }
        .factor-row {
          display: grid;
          grid-template-columns: minmax(90px, 140px) 1fr minmax(70px, auto);
          gap: .8rem;
          align-items: center;
        }
        .factor-row span { color: ${C.ink}; font-weight: 800; text-align: right; }
        .factor-row b { color: ${C.sub}; text-align: right; }
        .bar {
          height: 1.55rem;
          border-radius: 8px;
          background: rgba(255,255,255,.05);
          position: relative;
          overflow: hidden;
        }
        .bar i { position: absolute; left: 0; height: 50%; }
        .bar .call { top: 0; background: ${C.cyan}; }
        .bar .driver { bottom: 0; background: ${C.orange}; }
        button {
          width: 100%;
          margin-top: 1.4rem;
          border: 0;
          border-radius: 12px;
          background: ${C.line};
          color: white;
          padding: .9rem;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

function KpiRow({ label, value, color, delta }: { label: string; value: number; color: string; delta?: number }) {
  return (
    <div className="kpi-row">
      <span>{label}</span>
      <div><i style={{ width: `${value}%`, background: color }} /></div>
      <b>{value}% {delta != null && <em style={{ color: delta >= 0 ? C.green : C.red }}>{delta >= 0 ? `↑${delta}%p` : `↓${Math.abs(delta)}%p`}</em>}</b>
      <style jsx>{`
        .kpi-row {
          display: grid;
          grid-template-columns: 4.8rem 1fr 6.4rem;
          gap: .7rem;
          align-items: center;
          margin-top: .7rem;
        }
        .kpi-row:first-child { margin-top: 0; }
        span { color: ${C.sub}; font-weight: 850; }
        div { height: 1.6rem; background: rgba(255,255,255,.05); border-radius: 8px; overflow: hidden; }
        i { display: block; height: 100%; border-radius: 8px; transition: width .8s cubic-bezier(.22,1,.36,1); }
        b { text-align: right; font-size: 1.2rem; }
        em { font-style: normal; font-size: .58em; margin-left: .15rem; }
      `}</style>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <b>{value}</b>
      <style jsx>{`
        .metric {
          border: 1px solid ${C.line};
          border-radius: 12px;
          background: rgba(255,255,255,.025);
          padding: .75rem;
          display: flex;
          justify-content: space-between;
          gap: .8rem;
        }
        span { color: ${C.sub}; font-weight: 800; }
        b { color: ${C.cyan}; }
      `}</style>
    </div>
  )
}

function PanelTitle({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div className="panel-title">
      <span style={{ background: color }} />
      {children}
      <style jsx>{`
        .panel-title {
          margin: 0 0 1rem;
          display: flex;
          align-items: center;
          gap: .55rem;
          color: ${C.muted};
          font-size: clamp(.72rem, 1.3vw, .84rem);
          font-weight: 950;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        span {
          width: 4px;
          height: 1rem;
          border-radius: 99px;
        }
      `}</style>
    </div>
  )
}

function NumberInput({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return (
    <label className="field">{label}
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: number; onChange: (value: number) => void; options: { value: number; label: string }[] }) {
  return (
    <label className="field">{label}
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
  )
}

function Two({ children }: { children: ReactNode }) {
  return <div className="two">{children}</div>
}

const panelCss = `
  .route {
    background: rgba(34,211,238,.08);
    border: 1px solid rgba(34,211,238,.25);
    border-radius: 12px;
    padding: 1rem;
    text-align: center;
    font-size: clamp(1rem, 2vw, 1.15rem);
    font-weight: 900;
    display: flex;
    justify-content: center;
    gap: .6rem;
    flex-wrap: wrap;
  }
  .route b { color: ${C.cyan}; }
  .rows { display: grid; gap: .75rem; margin: 1rem 0 1.4rem; }
  .field { display: grid; gap: .35rem; color: ${C.sub}; font-weight: 800; font-size: .86rem; }
  .field input, .field select {
    min-height: 2.35rem;
    border: 1px solid ${C.line};
    border-radius: 10px;
    background: rgba(15,23,42,.9);
    color: ${C.ink};
    padding: 0 .65rem;
    font: inherit;
  }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; }
  .check { display: flex; align-items: center; gap: .55rem; color: ${C.sub}; font-weight: 800; }
  .factors { display: grid; grid-template-columns: 1fr 1fr; gap: .45rem; }
  .factors span {
    font-size: clamp(.68rem, 1.2vw, .78rem);
    font-weight: 750;
    padding: .5rem;
    border-radius: 8px;
    text-align: center;
    background: rgba(139,92,246,.1);
    border: 1px solid rgba(139,92,246,.22);
    color: #C4B5FD;
    opacity: .42;
    transition: all .25s ease;
  }
  .factors span.active {
    opacity: 1;
    background: rgba(139,92,246,.28);
    border-color: ${C.purple};
    color: white;
    box-shadow: 0 0 10px rgba(139,92,246,.38);
  }
`
