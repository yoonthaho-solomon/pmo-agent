'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import { callToVector, cosineSimilarity, driverToVector, type DriverVectorRow } from '@/lib/matching-vector'

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

type Ranked = {
  driver: DriverRow
  cosine: number
  reliability: number
  etaScore: number
  acceptance: number
  previewScore: number
  simDistanceKm: number
  simEtaMin: number
}

const C = {
  bg: '#070A12',
  ink: '#F5F7FB',
  sub: '#AAB7CB',
  muted: '#657189',
  panel: 'rgba(9,14,26,.92)',
  border: '#22314F',
  cyan: '#22D3EE',
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#FB923C',
  red: '#F43F5E',
  purple: '#8B5CF6',
}

const aspOptions = [
  { value: 137000000000, label: '인천 137' },
  { value: 147000000000, label: '천안 147' },
  { value: 160000000000, label: '부산 160' },
]

const weekdays = ['월', '화', '수', '목', '금', '토', '일']

function pct(n: number | null | undefined) {
  return n == null ? '-' : `${Math.round(n * 100)}%`
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, n))
}

function pseudoDistance(driverId: string, index: number) {
  const seed = Array.from(driverId).reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return 0.7 + ((seed + index * 17) % 82) / 10
}

export default function SimulatorPage() {
  const [aspId, setAspId] = useState(147000000000)
  const [hour, setHour] = useState(18)
  const [weekday, setWeekday] = useState(4)
  const [distance, setDistance] = useState(2500)
  const [fare, setFare] = useState(9000)
  const [paid, setPaid] = useState(false)
  const [surge, setSurge] = useState(false)
  const [eta, setEta] = useState(240)
  const [radius, setRadius] = useState(2.5)
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [focusedId, setFocusedId] = useState('')
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

  const callVector = useMemo(() => callToVector({
    hour_slot: hour,
    weekday,
    expected_distance: distance,
    expected_fare: fare,
    is_paid: paid,
    is_surge: surge,
    eta_distance: eta,
  }), [hour, weekday, distance, fare, paid, surge, eta])

  const ranked = useMemo<Ranked[]>(() => {
    return drivers
      .map((driver, index) => {
        const simDistanceKm = pseudoDistance(driver.driver_id, index)
        const simEtaMin = Math.max(2, Math.round(simDistanceKm * 2.7 + ((index % 4) * 0.8)))
        const etaScore = clamp(1 - simEtaMin / 28)
        const cosine = cosineSimilarity(callVector, driverToVector(driver))
        const reliability = Number(driver.reliability ?? 0)
        const acceptance = clamp(cosine * 0.7 + reliability * 0.2 + etaScore * 0.1)
        const previewScore = cosine * 0.72 + etaScore * 0.14 + acceptance * 0.1 + reliability * 0.04
        return { driver, cosine, reliability, etaScore, acceptance, previewScore, simDistanceKm, simEtaMin }
      })
      .sort((a, b) => b.cosine - a.cosine)
      .slice(0, 10)
  }, [drivers, callVector])

  useEffect(() => {
    if (!focusedId && ranked[0]) setFocusedId(ranked[0].driver.driver_id)
    if (focusedId && ranked.length && !ranked.some((row) => row.driver.driver_id === focusedId)) {
      setFocusedId(ranked[0].driver.driver_id)
    }
  }, [focusedId, ranked])

  const focused = ranked.find((row) => row.driver.driver_id === focusedId) ?? ranked[0]
  const inRadius = ranked.filter((row) => row.simDistanceKm <= radius)
  const secondRadius = ranked.filter((row) => row.simDistanceKm > radius && row.simDistanceKm <= radius * 1.8)
  const thirdRadius = ranked.filter((row) => row.simDistanceKm > radius * 1.8)

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Topbar />
      <KpiRail loading={loading} ranked={ranked} radius={radius} inRadius={inRadius.length} />

      <section style={{ position: 'relative', minHeight: 'calc(100vh - 126px)', overflow: 'hidden', borderTop: `1px solid ${C.border}` }}>
        <MapBackdrop />

        <aside style={leftPanel}>
          <PanelTitle kicker="CALL INPUT" title="콜카드 조건" />
          <Controls
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
            eta={eta}
            setEta={setEta}
            radius={radius}
            setRadius={setRadius}
            paid={paid}
            setPaid={setPaid}
            surge={surge}
            setSurge={setSurge}
          />
        </aside>

        <section style={stagePanel}>
          <div style={{ position: 'relative', zIndex: 4 }}>
            <div style={{ color: C.cyan, fontSize: 14, fontWeight: 950, letterSpacing: '.12em' }}>UBER STYLE CANDIDATE SEARCH</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 36, lineHeight: 1.08, fontWeight: 950 }}>반경 후보를 만들고, 유사도 순서로 먼저 보냅니다</h1>
            <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.55, maxWidth: 720, marginTop: 12 }}>
              실제 위치/온라인 상태가 들어오기 전까지 거리와 ETA는 시뮬레이션 표시입니다. 배차 점수에 섞지 않고, 코사인 유사도 우선정렬을 설명하는 용도로만 보여줍니다.
            </p>
          </div>
          <DispatchField ranked={ranked} focusedId={focusedId} setFocusedId={setFocusedId} radius={radius} />
        </section>

        <aside style={rightPanel}>
          <PanelTitle kicker="BEST CANDIDATE" title="추천 기사 Top 1" />
          <DriverScoreCard row={focused} />
          <FallbackPanel first={inRadius.length} second={secondRadius.length} third={thirdRadius.length} radius={radius} />
        </aside>

        <BottomRanking ranked={ranked} focusedId={focusedId} setFocusedId={setFocusedId} />
      </section>
    </main>
  )
}

function Topbar() {
  const nav = [
    ['대시보드', '/dashboard'],
    ['적재현황', '/ingest'],
    ['벡터리스트', '/vectors'],
    ['시뮬레이터', '/simulator'],
    ['배차로직', '/dispatch-logic'],
  ]

  return (
    <header style={{ height: 56, background: '#05070D', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '320px 1fr 260px', alignItems: 'center', padding: '0 18px', gap: 18 }}>
      <Link href="/dashboard" style={{ color: C.ink, textDecoration: 'none', fontSize: 18, fontWeight: 950 }}>
        Happycall PMO <span style={{ color: C.cyan }}>Dispatch Lab</span>
      </Link>
      <nav style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {nav.map(([label, href]) => (
          <Link key={href} href={href} style={{ color: href === '/simulator' ? C.cyan : C.sub, textDecoration: 'none', border: `1px solid ${href === '/simulator' ? C.cyan : C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 900, background: href === '/simulator' ? 'rgba(34,211,238,.12)' : 'rgba(15,22,40,.62)' }}>
            {label}
          </Link>
        ))}
      </nav>
      <div style={{ justifySelf: 'end', display: 'flex', gap: 8 }}>
        <Pill color={C.green}>SUPABASE</Pill>
        <Pill color={C.yellow}>SIM ETA</Pill>
      </div>
    </header>
  )
}

function KpiRail({ loading, ranked, radius, inRadius }: { loading: boolean; ranked: Ranked[]; radius: number; inRadius: number }) {
  const best = ranked[0]
  const items = [
    ['기사 벡터', loading ? '로딩 중' : `${ranked.length}명`, '동일 ASP 후보 Top 10', C.green],
    ['탐색 반경', `${radius.toFixed(1)}km`, `${inRadius}명 1차 후보`, C.cyan],
    ['최고 유사도', pct(best?.cosine), '22D 코사인', C.purple],
    ['예상 수락', pct(best?.acceptance), '참고용 구성요소', C.yellow],
    ['Fallback', '1 → 2 → 3차', '미수락 시 기존 순차', C.orange],
  ]

  return (
    <section style={{ height: 70, background: '#080B13', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: `1px solid ${C.border}` }}>
      {items.map(([label, value, sub, color]) => (
        <div key={label} style={{ borderRight: `1px solid ${C.border}`, padding: '10px 18px' }}>
          <div style={{ color: C.muted, fontSize: 13, fontWeight: 900 }}>{label}</div>
          <div style={{ color: String(color), fontSize: 26, lineHeight: 1.05, fontWeight: 950, marginTop: 3 }}>{value}</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{sub}</div>
        </div>
      ))}
    </section>
  )
}

function Controls(props: {
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
  eta: number
  setEta: (v: number) => void
  radius: number
  setRadius: (v: number) => void
  paid: boolean
  setPaid: (v: boolean) => void
  surge: boolean
  setSurge: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      <Label title="지역">
        <select value={props.aspId} onChange={(event) => props.setAspId(Number(event.target.value))} style={inputStyle}>
          {aspOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Label>
      <Two>
        <Label title="요청 시간">
          <input type="number" min={0} max={23} value={props.hour} onChange={(event) => props.setHour(Number(event.target.value))} style={inputStyle} />
        </Label>
        <Label title="요일">
          <select value={props.weekday} onChange={(event) => props.setWeekday(Number(event.target.value))} style={inputStyle}>
            {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
        </Label>
      </Two>
      <Label title={`탐색 반경 ${props.radius.toFixed(1)}km`}>
        <input type="range" min={1} max={8} step={0.5} value={props.radius} onChange={(event) => props.setRadius(Number(event.target.value))} />
      </Label>
      <Two>
        <Label title="예상거리 m">
          <input type="number" value={props.distance} onChange={(event) => props.setDistance(Number(event.target.value))} style={inputStyle} />
        </Label>
        <Label title="예상요금 원">
          <input type="number" value={props.fare} onChange={(event) => props.setFare(Number(event.target.value))} style={inputStyle} />
        </Label>
      </Two>
      <Label title="승객 위치 ETA 초">
        <input type="number" value={props.eta} onChange={(event) => props.setEta(Number(event.target.value))} style={inputStyle} />
      </Label>
      <label style={checkStyle}><input type="checkbox" checked={props.paid} onChange={(event) => props.setPaid(event.target.checked)} /> 유료콜</label>
      <label style={checkStyle}><input type="checkbox" checked={props.surge} onChange={(event) => props.setSurge(event.target.checked)} /> 탄력/프리미엄</label>
    </div>
  )
}

function DispatchField({ ranked, focusedId, setFocusedId, radius }: { ranked: Ranked[]; focusedId: string; setFocusedId: (id: string) => void; radius: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: '50%', top: '54%', width: radius * 82, height: radius * 82, transform: 'translate(-50%, -50%)', borderRadius: 999, border: `1px solid ${C.cyan}66`, background: 'rgba(34,211,238,.06)', zIndex: 1 }} />
      <div style={{ position: 'absolute', left: '50%', top: '54%', width: radius * 138, height: radius * 138, transform: 'translate(-50%, -50%)', borderRadius: 999, border: `1px dashed ${C.yellow}55`, zIndex: 1 }} />
      <div style={{ position: 'absolute', left: '50%', top: '54%', width: radius * 190, height: radius * 190, transform: 'translate(-50%, -50%)', borderRadius: 999, border: `1px dashed ${C.orange}44`, zIndex: 1 }} />

      <div style={{ position: 'absolute', left: '50%', top: '54%', transform: 'translate(-50%, -50%)', zIndex: 4, width: 142, height: 142, borderRadius: 28, border: `2px solid ${C.cyan}`, background: 'linear-gradient(160deg, rgba(34,211,238,.24), rgba(7,10,18,.96))', display: 'grid', placeItems: 'center', boxShadow: `0 0 58px ${C.cyan}44` }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: C.cyan, fontSize: 14, fontWeight: 950 }}>CALL</div>
          <div style={{ fontSize: 30, fontWeight: 950, marginTop: 4 }}>발생</div>
          <div style={{ color: C.sub, fontSize: 12, marginTop: 5 }}>후보 탐색</div>
        </div>
      </div>

      {ranked.map((row, index) => {
        const angle = (index / Math.max(1, ranked.length)) * Math.PI * 2 - Math.PI / 2
        const ring = row.simDistanceKm <= radius ? 31 : row.simDistanceKm <= radius * 1.8 ? 42 : 52
        const x = 50 + Math.cos(angle) * ring
        const y = 54 + Math.sin(angle) * ring * 0.68
        const active = row.driver.driver_id === focusedId
        return (
          <button
            key={row.driver.driver_id}
            onMouseEnter={() => setFocusedId(row.driver.driver_id)}
            onClick={() => setFocusedId(row.driver.driver_id)}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: active ? 7 : 5,
              width: active ? 92 : 68,
              height: active ? 92 : 68,
              borderRadius: 18,
              border: `2px solid ${active ? C.cyan : index < 3 ? C.green : C.border}`,
              background: active ? 'rgba(34,211,238,.18)' : 'rgba(9,14,26,.96)',
              color: C.ink,
              cursor: 'pointer',
              boxShadow: active ? `0 0 36px ${C.cyan}55` : 'none',
            }}
          >
            <div style={{ color: index < 3 ? C.green : C.sub, fontSize: active ? 22 : 17, fontWeight: 950 }}>#{index + 1}</div>
            <div style={{ color: C.cyan, fontSize: active ? 18 : 14, fontWeight: 950, marginTop: 5 }}>{pct(row.cosine)}</div>
            <div style={{ color: C.muted, fontSize: 10, marginTop: 3 }}>{row.simEtaMin}분</div>
          </button>
        )
      })}
    </div>
  )
}

function DriverScoreCard({ row }: { row?: Ranked }) {
  return (
    <div style={{ marginTop: 16, border: `1px solid ${C.green}66`, borderRadius: 18, background: 'linear-gradient(160deg, rgba(16,185,129,.18), rgba(9,14,26,.96))', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: C.green, fontSize: 13, fontWeight: 950 }}>AI PRIORITY</div>
          <div style={{ fontSize: 42, lineHeight: 1, fontWeight: 950, marginTop: 6 }}>{pct(row?.cosine)}</div>
        </div>
        <div style={{ width: 82, height: 82, borderRadius: 18, border: `1px solid ${C.green}66`, background: 'rgba(16,185,129,.14)', display: 'grid', placeItems: 'center', color: C.green, fontSize: 31, fontWeight: 950 }}>TOP</div>
      </div>
      <div style={{ marginTop: 18, fontFamily: 'monospace', fontSize: 17, fontWeight: 900, overflowWrap: 'anywhere' }}>{row?.driver.driver_id ?? '-'}</div>
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <Metric label="ETA 점수" value={pct(row?.etaScore)} color={C.cyan} />
        <Metric label="코사인 유사도" value={pct(row?.cosine)} color={C.green} />
        <Metric label="예상 수락확률" value={pct(row?.acceptance)} color={C.yellow} />
        <Metric label="데이터 신뢰도" value={pct(row?.reliability)} color={C.purple} />
      </div>
    </div>
  )
}

function FallbackPanel({ first, second, third, radius }: { first: number; second: number; third: number; radius: number }) {
  return (
    <div style={{ marginTop: 14, border: `1px solid ${C.border}`, borderRadius: 16, background: C.panel, padding: 16 }}>
      <div style={{ color: C.sub, fontSize: 13, fontWeight: 950, letterSpacing: '.1em' }}>RADIUS FALLBACK</div>
      <Step title={`1차 ${radius.toFixed(1)}km`} value={`${first}명`} color={C.cyan} />
      <Step title={`2차 ${(radius * 1.8).toFixed(1)}km`} value={`${second}명`} color={C.yellow} />
      <Step title="3차 기존 순차" value={`${third}명`} color={C.orange} />
    </div>
  )
}

function BottomRanking({ ranked, focusedId, setFocusedId }: { ranked: Ranked[]; focusedId: string; setFocusedId: (id: string) => void }) {
  return (
    <section style={{ position: 'absolute', left: 350, right: 350, bottom: 18, minHeight: 112, border: `1px solid ${C.border}`, borderRadius: 18, background: 'linear-gradient(90deg, rgba(9,14,26,.96), rgba(9,14,26,.76))', boxShadow: '0 20px 70px rgba(0,0,0,.32)', zIndex: 8, padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {ranked.slice(0, 5).map((row, index) => {
          const active = row.driver.driver_id === focusedId
          return (
            <button key={row.driver.driver_id} onMouseEnter={() => setFocusedId(row.driver.driver_id)} onClick={() => setFocusedId(row.driver.driver_id)} style={{ border: `1px solid ${active ? C.cyan : C.border}`, borderRadius: 12, background: active ? 'rgba(34,211,238,.14)' : 'rgba(15,22,40,.88)', color: C.ink, padding: 12, textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: index < 3 ? C.yellow : C.sub, fontSize: 13, fontWeight: 950 }}>SEND #{index + 1}</span>
                <span style={{ color: C.cyan, fontSize: 18, fontWeight: 950 }}>{pct(row.cosine)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, fontFamily: 'monospace', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.driver.driver_id}</div>
              <div style={{ marginTop: 7, color: C.sub, fontSize: 13 }}>{row.simDistanceKm.toFixed(1)}km · ETA {row.simEtaMin}분</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function MapBackdrop() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 52%, rgba(34,211,238,.12), transparent 30%), linear-gradient(135deg, #121820, #080B13 68%)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.36, backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }}>
        <path d="M4 70 C18 52 24 31 42 42 S62 79 96 18" stroke="rgba(34,211,238,.32)" strokeWidth=".35" fill="none" />
        <path d="M0 26 C28 20 55 22 100 74" stroke="rgba(16,185,129,.22)" strokeWidth=".42" fill="none" />
        <path d="M26 2 L72 100" stroke="rgba(245,158,11,.22)" strokeWidth=".28" fill="none" />
      </svg>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: C.sub, fontSize: 13, fontWeight: 850 }}>
        <span>{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div style={{ height: 8, background: '#1A2439', borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
        <div style={{ width: value === '-' ? 0 : value, height: '100%', background: color }} />
      </div>
    </div>
  )
}

function Step({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 12 }}>
      <span style={{ color: C.sub, fontSize: 14, fontWeight: 850 }}>{title}</span>
      <span style={{ color, fontSize: 19, fontWeight: 950 }}>{value}</span>
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

function Label({ title, children }: { title: string; children: ReactNode }) {
  return <label style={{ display: 'grid', gap: 7, color: C.sub, fontSize: 14, fontWeight: 850 }}>{title}{children}</label>
}

function Two({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: '#0B1222',
  color: C.ink,
  padding: '0 10px',
  fontSize: 15,
}

const checkStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  color: C.sub,
  fontSize: 15,
  fontWeight: 850,
}
