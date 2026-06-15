'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
  fitGrade: string
}

const C = {
  bg: '#080C18',
  panel: '#0F1628',
  panel2: '#111A2E',
  field: '#0A2A22',
  border: '#1E2D4A',
  text: '#F1F5F9',
  sub: '#A9B7CC',
  muted: '#6C7D99',
  cyan: '#22D3EE',
  green: '#10B981',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  red: '#F43F5E',
  orange: '#FB923C',
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

const GROUPS = [
  { key: '시간대', color: C.cyan },
  { key: '요일', color: C.purple },
  { key: '거리', color: C.green },
  { key: '요금', color: C.orange },
  { key: '콜유형', color: C.yellow },
  { key: '상품', color: C.red },
  { key: 'ETA', color: C.cyan },
]

function pct(n: number | null | undefined) {
  return n == null ? '-' : `${(n * 100).toFixed(1)}%`
}

function fmt(n: number | null | undefined) {
  return n == null ? '-' : n.toLocaleString()
}

function grade(score: number) {
  if (score >= 0.86) return 'S'
  if (score >= 0.76) return 'A'
  if (score >= 0.66) return 'B'
  if (score >= 0.55) return 'C'
  return 'D'
}

function distanceLabel(meters: number) {
  if (meters <= 3000) return '단거리'
  if (meters <= 8000) return '중거리'
  return '장거리'
}

function fareLabel(fare: number) {
  if (fare <= 10000) return '저요금'
  if (fare <= 20000) return '중요금'
  return '고요금'
}

function groupAverage(values: number[], group: string) {
  const indexes = VECTOR_DIMENSIONS
    .map((dim, index) => ({ dim, index }))
    .filter((item) => item.dim.group === group)
    .map((item) => item.index)
  if (indexes.length === 0) return 0
  return indexes.reduce((sum, index) => sum + (values[index] ?? 0), 0) / indexes.length
}

export default function VectorsPage() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [selectedCallId, setSelectedCallId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [callRes, driverRes] = await Promise.all([
        supabase
          .from('callcard_mbti')
          .select('callcard_id,asp_id,call_date,hour_slot,weekday,expected_distance,expected_fare,is_paid,is_surge,eta_distance,product_type')
          .order('call_date', { ascending: false })
          .limit(40),
        supabase
          .from('driver_mbti')
          .select('*')
          .order('reliability', { ascending: false })
          .limit(1200),
      ])
      if (cancelled) return
      const nextCalls = (callRes.data ?? []) as CallRow[]
      setCalls(nextCalls)
      setDrivers((driverRes.data ?? []) as DriverRow[])
      setSelectedCallId(nextCalls[0]?.callcard_id ?? '')
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedCall = calls.find((row) => row.callcard_id === selectedCallId) ?? calls[0]
  const callVector = useMemo(() => selectedCall ? callToVector(selectedCall) : [], [selectedCall])

  const ranked = useMemo<RankedDriver[]>(() => {
    if (!selectedCall) return []
    return drivers
      .filter((driver) => driver.asp_id === selectedCall.asp_id)
      .map((driver) => {
        const vector = driverToVector(driver)
        const cosine = cosineSimilarity(callVector, vector)
        return { driver, vector, cosine, fitGrade: grade(cosine) }
      })
      .sort((a, b) => b.cosine - a.cosine)
      .slice(0, 10)
  }, [drivers, selectedCall, callVector])

  useEffect(() => {
    if (!ranked.length) {
      setSelectedDriverId('')
      return
    }
    if (!ranked.some((row) => row.driver.driver_id === selectedDriverId)) {
      setSelectedDriverId(ranked[0].driver.driver_id)
    }
  }, [ranked, selectedDriverId])

  const selectedMatch = ranked.find((row) => row.driver.driver_id === selectedDriverId) ?? ranked[0]
  const selectedDriverVector = selectedMatch?.vector ?? []

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '30px 28px 46px' }}>
        <TopNav active="벡터리스트" />

        <header style={{ margin: '22px 0 22px' }}>
          <h1 style={{ fontSize: 36, margin: 0, fontWeight: 950 }}>벡터리스트</h1>
          <p style={{ color: C.sub, fontSize: 18, lineHeight: 1.6, margin: '10px 0 0', maxWidth: 960 }}>
            콜카드를 하나의 경기 요청 카드로 보고, 기사는 누적 운행 성향을 가진 능력치 카드로 봅니다.
            두 카드의 22차원 팩터가 얼마나 닮았는지를 코사인 유사도로 시각화합니다.
          </p>
        </header>

        {loading && <div style={{ color: C.sub, fontSize: 18, fontWeight: 850 }}>벡터 데이터를 불러오는 중입니다.</div>}

        <section style={{ display: 'grid', gridTemplateColumns: '330px 1fr 330px', gap: 18, alignItems: 'stretch' }}>
          <CallPlayerCard call={selectedCall} calls={calls} selectedCallId={selectedCallId} onSelect={setSelectedCallId} vector={callVector} />
          <MatchStage callVector={callVector} match={selectedMatch} />
          <DriverPlayerCard match={selectedMatch} />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 18, marginTop: 18 }}>
          <Panel title="추천 기사 Top 10" desc="같은 ASP 기사 중 콜카드 벡터와 가장 닮은 순서입니다.">
            <div style={{ display: 'grid', gap: 10 }}>
              {ranked.map((row, index) => (
                <button
                  key={row.driver.driver_id}
                  onClick={() => setSelectedDriverId(row.driver.driver_id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '38px 1fr 64px 76px',
                    gap: 10,
                    alignItems: 'center',
                    width: '100%',
                    border: `1px solid ${row.driver.driver_id === selectedDriverId ? C.cyan : C.border}`,
                    borderRadius: 8,
                    padding: 12,
                    background: row.driver.driver_id === selectedDriverId ? 'rgba(34,211,238,.12)' : '#0B1222',
                    color: C.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <strong style={{ color: index < 3 ? C.yellow : C.sub, fontSize: 19 }}>{index + 1}</strong>
                  <span style={{ fontFamily: 'monospace', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.driver.driver_id}</span>
                  <span style={{ color: C.yellow, fontSize: 20, fontWeight: 950 }}>{row.fitGrade}</span>
                  <span style={{ color: C.cyan, fontSize: 17, fontWeight: 950 }}>{pct(row.cosine)}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="콜카드 vs 기사 능력치 매칭" desc="왼쪽 막대는 콜카드 요구 조건, 오른쪽 막대는 선택 기사 성향입니다. 둘이 비슷할수록 매칭이 좋습니다.">
            <div style={{ display: 'grid', gap: 12 }}>
              {VECTOR_DIMENSIONS.map((dim, index) => {
                const callValue = callVector[index] ?? 0
                const driverValue = selectedDriverVector[index] ?? 0
                const diff = Math.abs(callValue - driverValue)
                return (
                  <div key={dim.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 54px 1fr', gap: 10, alignItems: 'center' }}>
                    <span style={{ color: C.sub, fontSize: 16, fontWeight: 850 }}>{dim.label}</span>
                    <Bar value={callValue} color={C.cyan} align="right" />
                    <span style={{ color: diff <= 0.25 ? C.green : diff <= 0.55 ? C.yellow : C.red, textAlign: 'center', fontWeight: 950 }}>
                      {diff <= 0.25 ? '좋음' : diff <= 0.55 ? '보통' : '차이'}
                    </span>
                    <Bar value={driverValue} color={C.green} align="left" />
                  </div>
                )
              })}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  )
}

function CallPlayerCard({
  call,
  calls,
  selectedCallId,
  onSelect,
  vector,
}: {
  call?: CallRow
  calls: CallRow[]
  selectedCallId: string
  onSelect: (value: string) => void
  vector: number[]
}) {
  return (
    <section style={playerCard(C.cyan)}>
      <div style={{ color: C.cyan, fontSize: 15, fontWeight: 950 }}>CALL CARD</div>
      <select value={selectedCallId} onChange={(event) => onSelect(event.target.value)} style={selectStyle()}>
        {calls.map((item) => (
          <option key={item.callcard_id} value={item.callcard_id}>{item.call_date} / {item.callcard_id}</option>
        ))}
      </select>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 18, color: C.sub, fontWeight: 850 }}>콜 난이도</div>
          <div style={{ fontSize: 52, lineHeight: 1, fontWeight: 950, color: C.text }}>{Math.round(groupAverage(vector, '시간대') * 20 + groupAverage(vector, '거리') * 35 + groupAverage(vector, '요금') * 25 + 20)}</div>
        </div>
        <div style={{ width: 96, height: 96, borderRadius: 12, background: 'linear-gradient(160deg, #12335F, #0E172A)', border: `1px solid ${C.border}`, display: 'grid', placeItems: 'center', color: C.cyan, fontSize: 32, fontWeight: 950 }}>
          CALL
        </div>
      </div>
      {call && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
          <Badge label="시간" value={`${call.hour_slot}시 ${WEEKDAYS[call.weekday] ?? '-'}`} />
          <Badge label="거리" value={distanceLabel(call.expected_distance)} />
          <Badge label="요금" value={fareLabel(call.expected_fare)} />
          <Badge label="유형" value={call.is_paid ? '유료콜' : '무료콜'} />
          <Badge label="상품" value={call.is_surge ? '탄력' : '일반'} />
          <Badge label="ETA" value={`${fmt(call.eta_distance)}초`} />
        </div>
      )}
      <GroupStats values={vector} tone={C.cyan} />
    </section>
  )
}

function DriverPlayerCard({ match }: { match?: RankedDriver }) {
  const driver = match?.driver
  return (
    <section style={playerCard(C.green)}>
      <div style={{ color: C.green, fontSize: 15, fontWeight: 950 }}>DRIVER CARD</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 18, color: C.sub, fontWeight: 850 }}>적합도</div>
          <div style={{ fontSize: 60, lineHeight: 1, fontWeight: 950, color: C.text }}>{match ? Math.round(match.cosine * 100) : '-'}</div>
        </div>
        <div style={{ width: 96, height: 96, borderRadius: 12, background: 'linear-gradient(160deg, #0B3B2D, #0E172A)', border: `1px solid ${C.border}`, display: 'grid', placeItems: 'center', color: C.green, fontSize: 46, fontWeight: 950 }}>
          {match?.fitGrade ?? '-'}
        </div>
      </div>
      <div style={{ marginTop: 16, fontFamily: 'monospace', fontSize: 18, fontWeight: 900, overflowWrap: 'anywhere' }}>
        {driver?.driver_id ?? '기사 후보 없음'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
        <Badge label="신뢰도" value={pct(driver?.reliability ?? 0)} />
        <Badge label="데이터일수" value={`${fmt(driver?.data_days)}일`} />
        <Badge label="지역" value={driver ? String(driver.asp_id) : '-'} />
        <Badge label="유사도" value={pct(match?.cosine)} />
      </div>
      <GroupStats values={match?.vector ?? []} tone={C.green} />
    </section>
  )
}

function MatchStage({ callVector, match }: { callVector: number[]; match?: RankedDriver }) {
  const score = match?.cosine ?? 0
  return (
    <section style={{ minHeight: 420, border: `1px solid ${C.border}`, borderRadius: 8, background: `linear-gradient(135deg, ${C.field}, #0B1222 70%)`, padding: 22, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 18, border: '1px solid rgba(255,255,255,.13)', borderRadius: 8 }} />
      <div style={{ position: 'absolute', left: '50%', top: 18, bottom: 18, width: 1, background: 'rgba(255,255,255,.16)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 150, height: 150, transform: 'translate(-50%, -50%)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 999 }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: C.sub, fontSize: 16, fontWeight: 850 }}>코사인 유사도</div>
            <div style={{ color: C.text, fontSize: 64, lineHeight: 1, fontWeight: 950 }}>{pct(score)}</div>
          </div>
          <div style={{ width: 86, height: 86, borderRadius: 999, border: `4px solid ${score >= 0.76 ? C.green : score >= 0.62 ? C.yellow : C.red}`, display: 'grid', placeItems: 'center', background: '#07111E', fontSize: 34, fontWeight: 950 }}>
            {grade(score)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
          <MiniPitchCard title="콜 요구 성향" values={callVector} color={C.cyan} />
          <MiniPitchCard title="기사 누적 성향" values={match?.vector ?? []} color={C.green} />
        </div>

        <div style={{ background: 'rgba(8,12,24,.78)', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginTop: 12 }}>
          <div style={{ color: C.yellow, fontSize: 18, fontWeight: 950, marginBottom: 8 }}>해석</div>
          <p style={{ color: C.sub, fontSize: 17, lineHeight: 1.55, margin: 0 }}>
            점수가 높을수록 이 콜의 조건을 과거에 선호하거나 잘 수행한 기사에 가깝습니다.
            아직 실제 온라인 상태와 위치는 섞지 않았고, 현재 화면은 22D 성향 매칭만 보여줍니다.
          </p>
        </div>
      </div>
    </section>
  )
}

function MiniPitchCard({ title, values, color }: { title: string; values: number[]; color: string }) {
  return (
    <div style={{ background: 'rgba(8,12,24,.78)', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
      <div style={{ color, fontSize: 17, fontWeight: 950, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'grid', gap: 9 }}>
        {GROUPS.map((group) => (
          <div key={group.key} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 46px', gap: 8, alignItems: 'center' }}>
            <span style={{ color: C.sub, fontSize: 14, fontWeight: 850 }}>{group.key}</span>
            <div style={{ height: 8, background: '#142039', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${groupAverage(values, group.key) * 100}%`, height: '100%', background: group.color }} />
            </div>
            <span style={{ color: C.muted, fontSize: 13, textAlign: 'right' }}>{Math.round(groupAverage(values, group.key) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupStats({ values, tone }: { values: number[]; tone: string }) {
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
      {GROUPS.map((group) => (
        <div key={group.key} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 44px', gap: 10, alignItems: 'center' }}>
          <span style={{ color: C.sub, fontSize: 15, fontWeight: 850 }}>{group.key}</span>
          <div style={{ height: 10, background: '#1A263D', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${groupAverage(values, group.key) * 100}%`, height: '100%', background: tone }} />
          </div>
          <span style={{ color: C.muted, fontSize: 14, textAlign: 'right' }}>{Math.round(groupAverage(values, group.key) * 100)}</span>
        </div>
      ))}
    </div>
  )
}

function Panel({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
      <h2 style={{ fontSize: 23, margin: 0, fontWeight: 950 }}>{title}</h2>
      <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.55, margin: '8px 0 16px' }}>{desc}</p>
      {children}
    </section>
  )
}

function TopNav({ active }: { active: string }) {
  const links = [
    ['대시보드', '/dashboard'],
    ['적재현황', '/ingest'],
    ['벡터리스트', '/vectors'],
    ['시뮬레이터', '/simulator'],
    ['배차로직', '/dispatch-logic'],
  ]
  return (
    <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {links.map(([label, href]) => (
        <Link key={href} href={href} style={{ color: label === active ? C.text : C.sub, border: `1px solid ${label === active ? C.cyan : C.border}`, background: label === active ? 'rgba(34,211,238,.16)' : 'transparent', borderRadius: 8, padding: '9px 12px', textDecoration: 'none', fontWeight: 900 }}>
          {label}
        </Link>
      ))}
    </nav>
  )
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#0B1222', border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, minHeight: 66 }}>
      <div style={{ color: C.muted, fontSize: 14, fontWeight: 850 }}>{label}</div>
      <div style={{ color: C.text, fontSize: 17, fontWeight: 950, marginTop: 6 }}>{value}</div>
    </div>
  )
}

function Bar({ value, color, align }: { value: number; color: string; align: 'left' | 'right' }) {
  return (
    <div style={{ height: 12, background: '#1A263D', borderRadius: 999, overflow: 'hidden', display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <div style={{ width: `${Math.min(1, value) * 100}%`, background: color, height: '100%' }} />
    </div>
  )
}

function playerCard(color: string): React.CSSProperties {
  return {
    minHeight: 420,
    background: `linear-gradient(160deg, ${color}24, ${C.panel} 36%, #0B1222)`,
    border: `1px solid ${color}66`,
    borderRadius: 8,
    padding: 20,
    boxShadow: `0 0 0 1px rgba(255,255,255,.03), 0 18px 42px rgba(0,0,0,.18)`,
  }
}

function selectStyle(): React.CSSProperties {
  return {
    width: '100%',
    height: 44,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: '#0B1222',
    color: C.text,
    padding: '0 10px',
    fontSize: 16,
    marginTop: 12,
  }
}
