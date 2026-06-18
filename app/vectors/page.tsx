'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  VECTOR_DIMENSIONS,
  callToVector,
  cosineSimilarity,
  driverToVector,
  type DriverVectorRow,
} from '@/lib/matching-vector'
import {
  DISPLAY_AXES,
  vectorToDisplayAxisBundle,
} from '@/lib/matching-display-axis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'preview-build-key'
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
  fit: number
}

const C = {
  bg: '#070A12',
  ink: '#F5F7FB',
  sub: '#AAB7CB',
  muted: '#657189',
  panel: 'rgba(9,14,26,.92)',
  panel2: 'rgba(15,22,40,.94)',
  border: '#22314F',
  cyan: '#22D3EE',
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#FB923C',
  red: '#F43F5E',
  purple: '#8B5CF6',
}

const weekdays = ['월', '화', '수', '목', '금', '토', '일']
const groups = ['시간대', '요일', '거리', '요금', '콜유형', '상품', 'ETA']
const groupColors: Record<string, string> = {
  시간대: C.cyan,
  요일: C.purple,
  거리: C.green,
  요금: C.orange,
  콜유형: C.yellow,
  상품: C.red,
  ETA: C.cyan,
}

const displayAxisColors = [C.cyan, C.purple, C.green, C.orange, C.yellow] as const

const slots = [
  { x: 20, y: 20 },
  { x: 78, y: 18 },
  { x: 90, y: 42 },
  { x: 74, y: 76 },
  { x: 47, y: 86 },
  { x: 22, y: 76 },
  { x: 10, y: 47 },
  { x: 38, y: 13 },
  { x: 62, y: 12 },
  { x: 90, y: 68 },
]

function pct(n: number | null | undefined) {
  return n == null ? '-' : `${Math.round(n * 100)}%`
}

function money(n: number | null | undefined) {
  if (n == null) return '-'
  return `${Math.round(n).toLocaleString()}원`
}

function meters(n: number | null | undefined) {
  if (n == null) return '-'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}km` : `${Math.round(n)}m`
}

function scoreGrade(score: number) {
  if (score >= 0.88) return 'S'
  if (score >= 0.78) return 'A'
  if (score >= 0.66) return 'B'
  if (score >= 0.54) return 'C'
  return 'D'
}

function groupAverage(values: number[], group: string) {
  const indexes = VECTOR_DIMENSIONS
    .map((dim, index) => ({ dim, index }))
    .filter((item) => item.dim.group === group)
    .map((item) => item.index)
  if (!indexes.length) return 0
  return indexes.reduce((sum, index) => sum + Number(values[index] ?? 0), 0) / indexes.length
}

function callSummary(call?: CallRow) {
  if (!call) return '콜카드 없음'
  const time = `${call.hour_slot}시 ${weekdays[call.weekday] ?? '-'}`
  const dist = meters(call.expected_distance)
  const fare = money(call.expected_fare)
  const paid = call.is_paid ? '유료콜' : '무료콜'
  return `${time} · ${dist} · ${fare} · ${paid}`
}

export default function VectorsPage() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [selectedCallId, setSelectedCallId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [hoverDriverId, setHoverDriverId] = useState('')
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
    return () => {
      cancelled = true
    }
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
        const reliability = Number(driver.reliability ?? 0)
        return {
          driver,
          vector,
          cosine,
          grade: scoreGrade(cosine),
          fit: cosine * 0.86 + reliability * 0.14,
        }
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

  const focusedId = hoverDriverId || selectedDriverId
  const focused = ranked.find((row) => row.driver.driver_id === focusedId) ?? ranked[0]
  const best = ranked[0]

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Topbar />
      <KpiRail call={selectedCall} ranked={ranked} loading={loading} loadError={loadError} calls={calls.length} drivers={drivers.length} />

      <section style={{ position: 'relative', minHeight: 'calc(100vh - 126px)', overflow: 'hidden', borderTop: `1px solid ${C.border}` }}>
        <MapBackdrop />

        <aside style={leftPanel}>
          <PanelTitle kicker="CALLCARD" title="콜카드 팩터" />
          <select value={selectedCallId} onChange={(event) => setSelectedCallId(event.target.value)} style={selectStyle}>
            {calls.length === 0 ? (
              <option value="">{loading ? '콜카드 불러오는 중' : '조회된 콜카드 없음'}</option>
            ) : calls.map((call) => (
              <option key={call.callcard_id} value={call.callcard_id}>
                {call.call_date} / {call.callcard_id}
              </option>
            ))}
          </select>
          <CallPlayerCard call={selectedCall} vector={callVector} />
        </aside>

        <section style={stagePanel}>
          <div style={{ position: 'relative', zIndex: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: C.cyan, fontSize: 14, fontWeight: 950, letterSpacing: '.12em' }}>FACTOR LIST & COSINE CHECK</div>
              <h1 style={{ margin: '8px 0 0', fontSize: 36, lineHeight: 1.08, fontWeight: 950 }}>콜카드와 기사 팩터를 22D로 비교합니다</h1>
              <p style={{ margin: '12px 0 0', color: C.sub, fontSize: 16, lineHeight: 1.55, maxWidth: 680 }}>
                콜카드는 현재 요청 조건을 22개 팩터로 바꾸고, 기사는 누적 운행 패턴을 같은 22개 팩터로 저장합니다.
                두 벡터의 방향이 얼마나 비슷한지 코사인 유사도로 비교하며, 5축은 이해를 돕는 요약 표시입니다.
              </p>
              <VectorReadinessBanner
                loading={loading}
                loadError={loadError}
                calls={calls.length}
                drivers={drivers.length}
                ranked={ranked.length}
              />
              <VectorFlowSummary selectedCall={selectedCall} best={best} />
              <FactorCorePanel selectedCall={selectedCall} best={best} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: C.muted, fontSize: 13, fontWeight: 850 }}>BEST MATCH</div>
              <div style={{ color: C.cyan, fontSize: 42, lineHeight: 1, fontWeight: 950 }}>{pct(best?.cosine)}</div>
              <div style={{ color: C.sub, fontSize: 13, marginTop: 5 }}>{best?.driver.driver_id ?? '-'}</div>
            </div>
          </div>

          <MatchField ranked={ranked} focusedId={focusedId} onFocus={setHoverDriverId} onSelect={setSelectedDriverId} />
        </section>

        <aside style={rightPanel}>
          <PanelTitle kicker="DRIVER" title="선택 기사 능력치" />
          <DriverPlayerCard match={focused} />
          <DisplayAxisCompare callVector={callVector} driverVector={focused?.vector ?? []} />
          <VectorGroups callVector={callVector} driverVector={focused?.vector ?? []} />
        </aside>

        <BottomDock ranked={ranked} focusedId={focusedId} onFocus={setHoverDriverId} onSelect={setSelectedDriverId} />
      </section>
    </main>
  )
}

function Topbar() {
  const nav = [
    ['적재현황', '/ingest'],
    ['벡터리스트', '/vectors'],
    ['시뮬레이터', '/simulator'],
    ['배차로직', '/dispatch-logic'],
  ]

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 80, height: 56, background: '#05070D', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '320px 1fr 260px', alignItems: 'center', padding: '0 18px', gap: 18 }}>
      <Link href="/ingest" style={{ color: C.ink, textDecoration: 'none', fontSize: 18, fontWeight: 950 }}>
        Happycall PMO <span style={{ color: C.cyan }}>AI 우선배차</span>
      </Link>
      <nav style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {nav.map(([label, href]) => (
          <Link key={href} href={href} style={{ color: href === '/vectors' ? C.cyan : C.sub, textDecoration: 'none', border: `1px solid ${href === '/vectors' ? C.cyan : C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 900, background: href === '/vectors' ? 'rgba(34,211,238,.12)' : 'rgba(15,22,40,.62)' }}>
            {label}
          </Link>
        ))}
      </nav>
      <div style={{ justifySelf: 'end', display: 'flex', gap: 8 }}>
        <Pill color={C.green}>실데이터</Pill>
        <Pill color={C.cyan}>22D COSINE</Pill>
      </div>
    </header>
  )
}

function KpiRail({
  call,
  ranked,
  loading,
  loadError,
  calls,
  drivers,
}: {
  call?: CallRow
  ranked: RankedDriver[]
  loading: boolean
  loadError: string | null
  calls: number
  drivers: number
}) {
  const items = [
    ['조회 상태', loading ? '로딩 중' : loadError ? '오류' : '정상', loadError ?? `${calls.toLocaleString()} 콜 · ${drivers.toLocaleString()} 기사`, loadError ? C.red : loading ? C.yellow : C.green],
    ['콜카드', call ? '1건 선택' : loading ? '로딩 중' : '없음', callSummary(call), C.cyan],
    ['후보 기사', `${ranked.length}명`, '동일 ASP 기준 Top 10', C.green],
    ['최고 유사도', pct(ranked[0]?.cosine), '코사인 유사도 기준', C.purple],
    ['표시 방식', '5축 요약', '시뮬레이터 레이더와 동일', C.orange],
  ]

  return (
    <section style={{ height: 70, background: '#080B13', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: `1px solid ${C.border}` }}>
      {items.map(([label, value, sub, color]) => (
        <div key={label} style={{ borderRight: `1px solid ${C.border}`, padding: '10px 18px' }}>
          <div style={{ color: C.muted, fontSize: 13, fontWeight: 900 }}>{label}</div>
          <div style={{ color: String(color), fontSize: 26, lineHeight: 1.05, fontWeight: 950, marginTop: 3 }}>{value}</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
        </div>
      ))}
    </section>
  )
}

function VectorReadinessBanner({
  loading,
  loadError,
  calls,
  drivers,
  ranked,
}: {
  loading: boolean
  loadError: string | null
  calls: number
  drivers: number
  ranked: number
}) {
  const state = loading
    ? { tone: C.yellow, title: '데이터 조회 중', body: 'Supabase에서 콜카드와 기사 벡터를 불러오고 있습니다.' }
    : loadError
      ? { tone: C.red, title: '데이터 조회 실패', body: `Supabase 응답 오류: ${loadError}` }
      : calls === 0
        ? { tone: C.red, title: '콜카드 없음', body: 'callcard_mbti에서 표시할 콜카드를 찾지 못했습니다.' }
        : drivers === 0
          ? { tone: C.red, title: '기사 벡터 없음', body: 'driver_mbti에서 기사 벡터를 찾지 못했습니다.' }
          : ranked === 0
            ? { tone: C.yellow, title: '동일 지역 후보 없음', body: '선택한 콜카드의 ASP와 일치하는 기사 후보가 없습니다.' }
            : { tone: C.green, title: '벡터 비교 가능', body: `${calls.toLocaleString()}개 콜카드와 ${drivers.toLocaleString()}명 기사 벡터를 기준으로 Top 10을 계산했습니다.` }

  return (
    <div style={{ marginTop: 14, border: `1px solid ${state.tone}55`, borderRadius: 12, background: `${state.tone}14`, padding: '10px 12px', maxWidth: 760 }}>
      <div style={{ color: state.tone, fontSize: 13, fontWeight: 950 }}>{state.title}</div>
      <div style={{ color: C.sub, fontSize: 14, marginTop: 4, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{state.body}</div>
    </div>
  )
}

function VectorFlowSummary({ selectedCall, best }: { selectedCall?: CallRow; best?: RankedDriver }) {
  const items = [
    {
      title: '1. 콜카드 선택',
      value: selectedCall?.callcard_id ?? '-',
      body: selectedCall ? callSummary(selectedCall) : '왼쪽에서 실제 콜카드를 선택합니다.',
      color: C.cyan,
    },
    {
      title: '2. 22D 코사인 계산',
      value: best ? pct(best.cosine) : '-',
      body: '정렬 기준은 5축 요약이 아니라 원본 22차원 전체 벡터입니다.',
      color: C.purple,
    },
    {
      title: '3. 기사 후보 Top 10',
      value: best?.driver.driver_id ?? '-',
      body: '동일 ASP 기사군에서 가장 유사한 기사부터 표시합니다.',
      color: C.green,
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14, maxWidth: 840 }}>
      {items.map((item) => (
        <div key={item.title} style={{ border: `1px solid ${item.color}44`, borderRadius: 12, background: `${item.color}10`, padding: 12, minHeight: 112 }}>
          <div style={{ color: item.color, fontSize: 13, fontWeight: 950 }}>{item.title}</div>
          <div style={{ color: C.ink, fontSize: 18, fontWeight: 950, marginTop: 8, overflowWrap: 'anywhere' }}>{item.value}</div>
          <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.42, marginTop: 7 }}>{item.body}</div>
        </div>
      ))}
    </div>
  )
}

function FactorCorePanel({ selectedCall, best }: { selectedCall?: CallRow; best?: RankedDriver }) {
  const groupDefs = groups.map((group) => ({
    group,
    color: groupColors[group],
    factors: VECTOR_DIMENSIONS.filter((dim) => dim.group === group).map((dim) => dim.label).join(' / '),
  }))

  const formulas = [
    {
      title: '콜카드 벡터',
      body: '시간, 요일, 거리, 요금, 유료/무료, 탄력/일반, ETA 조건을 22개 팩터 값으로 변환합니다. 해당 조건은 1, 아닌 조건은 0에 가깝게 둡니다.',
      color: C.cyan,
    },
    {
      title: '기사 벡터',
      body: '기사의 누적 수락/완료 운행 패턴을 같은 22개 팩터 점수로 저장합니다. 점수는 0~1 범위이며 높을수록 해당 조건에서 잘 받았다는 뜻입니다.',
      color: C.green,
    },
    {
      title: '유사도 계산',
      body: 'cosine = dot(call22D, driver22D) / (|call22D| × |driver22D|). 값이 높을수록 현재 콜 조건과 기사 성향 방향이 비슷합니다.',
      color: C.purple,
    },
  ]

  return (
    <div style={{ position: 'relative', zIndex: 5, display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 12, marginTop: 14, maxWidth: 1040 }}>
      <div style={{ border: `1px solid ${C.cyan}33`, borderRadius: 14, background: 'rgba(5,8,16,.78)', padding: 14, boxShadow: '0 18px 50px rgba(0,0,0,.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div>
            <div style={{ color: C.cyan, fontSize: 13, fontWeight: 950, letterSpacing: '.1em' }}>22D FACTOR DICTIONARY</div>
            <div style={{ color: C.ink, fontSize: 20, fontWeight: 950, marginTop: 5 }}>콜카드와 기사가 공유하는 팩터</div>
          </div>
          <div style={{ color: C.yellow, fontSize: 12, fontWeight: 950, textAlign: 'right' }}>원본 계산 22D<br />화면 요약 5축</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
          {groupDefs.map((item) => (
            <div key={item.group} style={{ minWidth: 0, border: `1px solid ${item.color}33`, borderRadius: 10, background: `${item.color}10`, padding: 10 }}>
              <b style={{ color: item.color, fontSize: 13 }}>{item.group}</b>
              <p style={{ margin: '5px 0 0', color: C.sub, fontSize: 13, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{item.factors}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {formulas.map((item) => (
          <div key={item.title} style={{ border: `1px solid ${item.color}44`, borderRadius: 12, background: `${item.color}12`, padding: 11 }}>
            <b style={{ color: item.color, fontSize: 14 }}>{item.title}</b>
            <p style={{ margin: '6px 0 0', color: C.sub, fontSize: 13, lineHeight: 1.42 }}>{item.body}</p>
          </div>
        ))}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.panel, padding: 11 }}>
          <b style={{ color: C.ink, fontSize: 14 }}>현재 예시</b>
          <p style={{ margin: '6px 0 0', color: C.sub, fontSize: 13, lineHeight: 1.42 }}>
            콜카드 {selectedCall?.callcard_id ?? '-'}와 기사 {best?.driver.driver_id ?? '-'}의 22D 코사인 유사도는 <b style={{ color: C.cyan }}>{pct(best?.cosine)}</b>입니다.
          </p>
        </div>
      </div>
    </div>
  )
}
function MapBackdrop() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 44%, rgba(34,211,238,.13), transparent 28%), linear-gradient(135deg, #121820, #080B13 68%)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.36, backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}>
        <path d="M4 70 C18 52 24 31 42 42 S62 79 96 18" stroke="rgba(34,211,238,.32)" strokeWidth=".35" fill="none" />
        <path d="M0 26 C28 20 55 22 100 74" stroke="rgba(16,185,129,.22)" strokeWidth=".42" fill="none" />
        <path d="M26 2 L72 100" stroke="rgba(245,158,11,.22)" strokeWidth=".28" fill="none" />
        <path d="M4 88 C24 80 58 81 100 58" stroke="rgba(139,92,246,.2)" strokeWidth=".3" fill="none" />
      </svg>
    </div>
  )
}

function MatchField({
  ranked,
  focusedId,
  onFocus,
  onSelect,
}: {
  ranked: RankedDriver[]
  focusedId: string
  onFocus: (driverId: string) => void
  onSelect: (driverId: string) => void
}) {
  const center = { x: 50, y: 52 }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}>
        {ranked.map((row, index) => {
          const slot = slots[index]
          const active = row.driver.driver_id === focusedId
          return (
            <line
              key={row.driver.driver_id}
              x1={center.x}
              y1={center.y}
              x2={slot.x}
              y2={slot.y}
              stroke={active ? C.cyan : index < 3 ? 'rgba(16,185,129,.82)' : 'rgba(170,183,203,.28)'}
              strokeWidth={active ? 1.15 + row.cosine * 3.5 : 0.25 + row.cosine * 1.8}
              strokeLinecap="round"
            />
          )
        })}
      </svg>

      <div style={{ position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%, -50%)', zIndex: 4 }}>
        <div style={{ width: 150, height: 150, borderRadius: 26, border: `2px solid ${C.cyan}`, background: 'linear-gradient(160deg, rgba(34,211,238,.22), rgba(8,12,24,.96))', display: 'grid', placeItems: 'center', boxShadow: `0 0 60px ${C.cyan}44` }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.cyan, fontSize: 16, fontWeight: 950 }}>CALLCARD</div>
            <div style={{ color: C.ink, fontSize: 46, lineHeight: 1, fontWeight: 950, marginTop: 8 }}>22D</div>
            <div style={{ color: C.sub, fontSize: 13, marginTop: 8 }}>요청 조건</div>
          </div>
        </div>
      </div>

      {ranked.map((row, index) => {
        const slot = slots[index]
        const active = row.driver.driver_id === focusedId
        const size = active ? 94 : index < 3 ? 78 : 62
        return (
          <button
            key={row.driver.driver_id}
            onMouseEnter={() => onFocus(row.driver.driver_id)}
            onMouseLeave={() => onFocus('')}
            onClick={() => onSelect(row.driver.driver_id)}
            style={{
              position: 'absolute',
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              width: size,
              height: size,
              transform: 'translate(-50%, -50%)',
              borderRadius: 18,
              border: `2px solid ${active ? C.cyan : index < 3 ? C.green : C.border}`,
              background: active ? 'linear-gradient(160deg, rgba(34,211,238,.25), rgba(10,14,24,.98))' : 'rgba(9,14,26,.96)',
              color: C.ink,
              cursor: 'pointer',
              zIndex: active ? 6 : 5,
              boxShadow: active ? `0 0 38px ${C.cyan}55` : index < 3 ? `0 0 22px ${C.green}22` : 'none',
              transition: 'all 170ms ease',
            }}
          >
            <div style={{ color: active ? C.cyan : index < 3 ? C.green : C.sub, fontSize: active ? 28 : 22, lineHeight: 1, fontWeight: 950 }}>{row.grade}</div>
            <div style={{ fontSize: active ? 18 : 14, fontWeight: 950, marginTop: 6 }}>{pct(row.cosine)}</div>
            <div style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>#{index + 1}</div>
          </button>
        )
      })}
    </div>
  )
}

function CallPlayerCard({ call, vector }: { call?: CallRow; vector: number[] }) {
  const power = Math.round((groupAverage(vector, '시간대') + groupAverage(vector, '거리') + groupAverage(vector, '요금') + groupAverage(vector, '콜유형')) * 18 + 28)

  return (
    <div style={playerCard(C.cyan)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: C.cyan, fontSize: 13, fontWeight: 950 }}>REQUEST</div>
          <div style={{ fontSize: 36, lineHeight: 1, fontWeight: 950, marginTop: 5 }}>{power}</div>
        </div>
        <div style={{ width: 78, height: 78, borderRadius: 18, background: 'rgba(34,211,238,.14)', border: `1px solid ${C.cyan}66`, display: 'grid', placeItems: 'center', color: C.cyan, fontSize: 20, fontWeight: 950 }}>CALL</div>
      </div>
      <div style={{ marginTop: 18, color: C.ink, fontSize: 18, fontWeight: 950 }}>{call?.callcard_id ?? '-'}</div>
      <div style={{ color: C.sub, fontSize: 14, marginTop: 6 }}>{callSummary(call)}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
        <Mini label="거리" value={meters(call?.expected_distance)} />
        <Mini label="요금" value={money(call?.expected_fare)} />
        <Mini label="ETA" value={call?.eta_distance == null ? '-' : `${Math.round(call.eta_distance)}초`} />
        <Mini label="상품" value={call?.is_surge ? '탄력' : '일반'} />
      </div>
      <RadarBars values={vector} tone={C.cyan} />
    </div>
  )
}

function DriverPlayerCard({ match }: { match?: RankedDriver }) {
  return (
    <div style={playerCard(C.green)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: C.green, fontSize: 13, fontWeight: 950 }}>CANDIDATE</div>
          <div style={{ fontSize: 44, lineHeight: 1, fontWeight: 950, marginTop: 5 }}>{match ? Math.round(match.cosine * 100) : '-'}</div>
        </div>
        <div style={{ width: 82, height: 82, borderRadius: 18, background: 'rgba(16,185,129,.14)', border: `1px solid ${C.green}66`, display: 'grid', placeItems: 'center', color: C.green, fontSize: 42, fontWeight: 950 }}>{match?.grade ?? '-'}</div>
      </div>
      <div style={{ marginTop: 18, color: C.ink, fontSize: 18, fontWeight: 950, overflowWrap: 'anywhere' }}>{match?.driver.driver_id ?? '선택 기사 없음'}</div>
      <div style={{ color: C.sub, fontSize: 14, marginTop: 6 }}>기사 누적 패턴과 현재 콜카드의 22D 유사도</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
        <Mini label="유사도" value={pct(match?.cosine)} />
        <Mini label="신뢰도" value={pct(match?.driver.reliability)} />
        <Mini label="데이터" value={match?.driver.data_days == null ? '-' : `${match.driver.data_days}일`} />
        <Mini label="ASP" value={match?.driver.asp_id == null ? '-' : String(match.driver.asp_id)} />
      </div>
      <RadarBars values={match?.vector ?? []} tone={C.green} />
    </div>
  )
}

function DisplayAxisCompare({ callVector, driverVector }: { callVector: number[]; driverVector: number[] }) {
  const callAxis = vectorToDisplayAxisBundle(callVector).axis
  const driverAxis = vectorToDisplayAxisBundle(driverVector).axis

  return (
    <div style={{ marginTop: 14, border: `1px solid ${C.border}`, borderRadius: 14, background: C.panel, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <div>
          <div style={{ color: C.sub, fontSize: 13, fontWeight: 950, letterSpacing: '.1em' }}>5-AXIS DISPLAY</div>
          <div style={{ color: C.ink, fontSize: 18, fontWeight: 950, marginTop: 5 }}>시뮬레이터 표시축</div>
        </div>
        <div style={{ color: C.yellow, fontSize: 12, fontWeight: 900, textAlign: 'right' }}>계산은 22D<br />표시는 5축</div>
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {DISPLAY_AXES.map((axis, index) => {
          const color = displayAxisColors[index] ?? C.cyan
          const call = (callAxis[index] ?? 0) / 100
          const driver = (driverAxis[index] ?? 0) / 100
          const fit = 1 - Math.abs(call - driver)
          return (
            <div key={axis.name} style={{ border: `1px solid ${color}33`, borderRadius: 12, background: `${color}0F`, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <b style={{ color, fontSize: 14 }}>{axis.name}</b>
                <span style={{ color: fit >= 0.78 ? C.green : fit >= 0.55 ? C.yellow : C.red, fontSize: 13, fontWeight: 950 }}>{Math.round(fit * 100)}%</span>
              </div>
              <div style={{ display: 'grid', gap: 5 }}>
                <Track value={call} color={C.cyan} />
                <Track value={driver} color={C.green} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VectorGroups({ callVector, driverVector }: { callVector: number[]; driverVector: number[] }) {
  return (
    <div style={{ marginTop: 14, border: `1px solid ${C.border}`, borderRadius: 14, background: C.panel, padding: 16 }}>
      <div style={{ color: C.sub, fontSize: 13, fontWeight: 950, letterSpacing: '.1em' }}>22D FACTOR MATCH</div>
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {groups.map((group) => {
          const call = groupAverage(callVector, group)
          const driver = groupAverage(driverVector, group)
          const diff = Math.abs(call - driver)
          return (
            <div key={group} style={{ display: 'grid', gridTemplateColumns: '62px 1fr 42px', gap: 10, alignItems: 'center' }}>
              <div style={{ color: groupColors[group], fontSize: 14, fontWeight: 950 }}>{group}</div>
              <div style={{ display: 'grid', gap: 5 }}>
                <Track value={call} color={C.cyan} />
                <Track value={driver} color={C.green} />
              </div>
              <div style={{ color: diff < 0.22 ? C.green : diff < 0.48 ? C.yellow : C.red, fontSize: 13, textAlign: 'right', fontWeight: 950 }}>
                {diff < 0.22 ? '매우맞음' : diff < 0.48 ? '보통' : '차이'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BottomDock({
  ranked,
  focusedId,
  onFocus,
  onSelect,
}: {
  ranked: RankedDriver[]
  focusedId: string
  onFocus: (driverId: string) => void
  onSelect: (driverId: string) => void
}) {
  return (
    <section style={{ position: 'absolute', left: 350, right: 350, bottom: 18, minHeight: 112, border: `1px solid ${C.border}`, borderRadius: 18, background: 'linear-gradient(90deg, rgba(9,14,26,.96), rgba(9,14,26,.76))', boxShadow: '0 20px 70px rgba(0,0,0,.32)', zIndex: 8, padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {ranked.slice(0, 5).map((row, index) => {
          const active = row.driver.driver_id === focusedId
          return (
            <button
              key={row.driver.driver_id}
              onMouseEnter={() => onFocus(row.driver.driver_id)}
              onMouseLeave={() => onFocus('')}
              onClick={() => onSelect(row.driver.driver_id)}
              style={{
                border: `1px solid ${active ? C.cyan : C.border}`,
                borderRadius: 12,
                background: active ? 'rgba(34,211,238,.14)' : 'rgba(15,22,40,.88)',
                color: C.ink,
                padding: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: index < 3 ? C.yellow : C.sub, fontSize: 13, fontWeight: 950 }}>#{index + 1}</span>
                <span style={{ color: active ? C.cyan : C.green, fontSize: 18, fontWeight: 950 }}>{row.grade}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, fontFamily: 'monospace', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.driver.driver_id}</div>
              <div style={{ marginTop: 7, color: C.cyan, fontSize: 20, fontWeight: 950 }}>{pct(row.cosine)}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function RadarBars({ values, tone }: { values: number[]; tone: string }) {
  return (
    <div style={{ display: 'grid', gap: 9, marginTop: 18 }}>
      {groups.map((group) => (
        <div key={group} style={{ display: 'grid', gridTemplateColumns: '58px 1fr 34px', gap: 9, alignItems: 'center' }}>
          <span style={{ color: C.sub, fontSize: 13, fontWeight: 850 }}>{group}</span>
          <Track value={groupAverage(values, group)} color={tone} />
          <span style={{ color: C.muted, fontSize: 12, textAlign: 'right' }}>{Math.round(groupAverage(values, group) * 100)}</span>
        </div>
      ))}
    </div>
  )
}

function Track({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 9, background: '#1A2439', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
    </div>
  )
}

function PanelTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <div style={{ color: C.muted, fontSize: 13, fontWeight: 950, letterSpacing: '.12em' }}>{kicker}</div>
      <h2 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 950 }}>{title}</h2>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: 'rgba(8,12,24,.72)', padding: 10 }}>
      <div style={{ color: C.muted, fontSize: 12, fontWeight: 850 }}>{label}</div>
      <div style={{ color: C.ink, fontSize: 16, fontWeight: 950, marginTop: 5 }}>{value}</div>
    </div>
  )
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return <span style={{ color, border: `1px solid ${color}66`, background: `${color}18`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 950 }}>{children}</span>
}

const leftPanel: React.CSSProperties = {
  position: 'absolute',
  left: 18,
  top: 18,
  bottom: 18,
  width: 306,
  zIndex: 7,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  background: C.panel,
  padding: 18,
  boxShadow: '0 20px 70px rgba(0,0,0,.35)',
}

const rightPanel: React.CSSProperties = {
  position: 'absolute',
  right: 18,
  top: 18,
  bottom: 18,
  width: 306,
  zIndex: 7,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  background: C.panel,
  padding: 18,
  boxShadow: '0 20px 70px rgba(0,0,0,.35)',
}

const stagePanel: React.CSSProperties = {
  position: 'absolute',
  left: 342,
  right: 342,
  top: 18,
  bottom: 148,
  zIndex: 4,
  border: `1px solid rgba(34,211,238,.22)`,
  borderRadius: 22,
  background: 'rgba(7,10,18,.28)',
  padding: 24,
  overflow: 'hidden',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 42,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: '#0B1222',
  color: C.ink,
  padding: '0 10px',
  fontSize: 14,
  marginTop: 14,
}

function playerCard(color: string): React.CSSProperties {
  return {
    marginTop: 14,
    border: `1px solid ${color}77`,
    borderRadius: 18,
    background: `linear-gradient(160deg, ${color}22, rgba(9,14,26,.96) 42%, rgba(11,18,34,.98))`,
    padding: 16,
    boxShadow: `0 0 32px ${color}18`,
  }
}

