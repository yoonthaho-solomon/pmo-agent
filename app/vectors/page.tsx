'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { PmoShell } from '@/app/components/PmoShell'
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
  grade: string
}

const C = {
  panel: '#0F1628',
  panel2: '#111A2E',
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

const FACTOR_GROUPS = [
  { key: '시간대', color: C.cyan },
  { key: '요일', color: C.purple },
  { key: '거리', color: C.green },
  { key: '요금', color: C.orange },
  { key: '콜유형', color: C.yellow },
  { key: '상품', color: C.red },
  { key: 'ETA', color: C.cyan },
]

const networkSlots = [
  { x: 18, y: 20 },
  { x: 76, y: 18 },
  { x: 88, y: 42 },
  { x: 72, y: 72 },
  { x: 25, y: 76 },
  { x: 10, y: 48 },
  { x: 36, y: 12 },
  { x: 60, y: 88 },
  { x: 92, y: 66 },
  { x: 8, y: 72 },
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

function groupAverage(values: number[], group: string) {
  const indexes = VECTOR_DIMENSIONS
    .map((dim, index) => ({ dim, index }))
    .filter((item) => item.dim.group === group)
    .map((item) => item.index)
  if (indexes.length === 0) return 0
  return indexes.reduce((sum, index) => sum + (values[index] ?? 0), 0) / indexes.length
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

export default function VectorsPage() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [selectedCallId, setSelectedCallId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [hoverDriverId, setHoverDriverId] = useState('')
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
        return { driver, vector, cosine, grade: grade(cosine) }
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

  const focusedId = hoverDriverId || selectedDriverId
  const selectedMatch = ranked.find((row) => row.driver.driver_id === focusedId) ?? ranked[0]
  const selectedVector = selectedMatch?.vector ?? []

  return (
    <PmoShell
      active="벡터리스트"
      kicker="INTERACTIVE MATCH GRAPH"
      title="콜카드가 기사군에서 가장 닮은 기사를 찾아가는 화면"
      description="콜카드가 중앙 노드가 되고, 기사 후보들이 유사도에 따라 연결됩니다. 점수가 높은 기사는 더 가까이 보이고, 선이 굵어지며, 리스트에서도 위로 도드라집니다."
      status="그래프형 매칭"
    >
      {loading && <div style={{ color: C.sub, fontSize: 18, fontWeight: 850 }}>벡터 데이터를 불러오는 중입니다.</div>}

      <section style={{ display: 'grid', gridTemplateColumns: '330px 1fr 330px', gap: 18, alignItems: 'stretch' }}>
        <CallCard call={selectedCall} calls={calls} selectedCallId={selectedCallId} onSelect={setSelectedCallId} vector={callVector} />
        <MatchGraph ranked={ranked} focusedId={focusedId} onFocus={setHoverDriverId} onSelect={setSelectedDriverId} />
        <DriverCard match={selectedMatch} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 18, marginTop: 18 }}>
        <Panel title="유사 기사 후보" desc="리스트에 마우스를 올리면 가운데 그래프의 선과 노드가 같이 강조됩니다.">
          <div style={{ display: 'grid', gap: 10 }}>
            {ranked.map((row, index) => (
              <CandidateRow
                key={row.driver.driver_id}
                row={row}
                index={index}
                active={row.driver.driver_id === focusedId}
                onFocus={setHoverDriverId}
                onSelect={setSelectedDriverId}
              />
            ))}
          </div>
        </Panel>

        <Panel title="22D 팩터 매칭 보드" desc="왼쪽은 콜카드 요구 조건, 오른쪽은 선택 기사 성향입니다. 가운데 판정이 초록색일수록 잘 맞습니다.">
          <div style={{ display: 'grid', gap: 12 }}>
            {VECTOR_DIMENSIONS.map((dim, index) => {
              const callValue = callVector[index] ?? 0
              const driverValue = selectedVector[index] ?? 0
              const diff = Math.abs(callValue - driverValue)
              return (
                <div key={dim.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 58px 1fr', gap: 10, alignItems: 'center' }}>
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
    </PmoShell>
  )
}

function MatchGraph({
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
  const center = { x: 50, y: 50 }
  const top = ranked[0]

  return (
    <section style={{ minHeight: 478, border: `1px solid ${C.border}`, borderRadius: 8, background: 'radial-gradient(circle at 50% 50%, rgba(34,211,238,.18), rgba(15,22,40,.72) 36%, #0B1222 78%)', padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <div>
          <div style={{ color: C.sub, fontSize: 15, fontWeight: 850 }}>실시간 매칭 맵</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 4 }}>콜카드와 기사군 연결</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: C.muted, fontSize: 13, fontWeight: 850 }}>최고 유사도</div>
          <div style={{ color: C.cyan, fontSize: 28, fontWeight: 950 }}>{pct(top?.cosine)}</div>
        </div>
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.95 }}>
        {ranked.map((row, index) => {
          const slot = networkSlots[index] ?? networkSlots[0]
          const isFocused = row.driver.driver_id === focusedId
          const width = 0.35 + row.cosine * (isFocused ? 3.4 : 2.1)
          return (
            <line
              key={row.driver.driver_id}
              x1={center.x}
              y1={center.y}
              x2={slot.x}
              y2={slot.y}
              stroke={isFocused ? C.cyan : index < 3 ? C.green : 'rgba(169,183,204,.34)'}
              strokeWidth={width}
              strokeLinecap="round"
            />
          )
        })}
      </svg>

      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 3 }}>
        <div style={{ width: 118, height: 118, borderRadius: 999, border: `2px solid ${C.cyan}`, background: 'rgba(8,12,24,.92)', boxShadow: `0 0 38px ${C.cyan}44`, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ color: C.cyan, fontSize: 14, fontWeight: 950 }}>CALL</div>
            <div style={{ color: C.text, fontSize: 28, fontWeight: 950, marginTop: 4 }}>22D</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>request</div>
          </div>
        </div>
      </div>

      {ranked.map((row, index) => {
        const slot = networkSlots[index] ?? networkSlots[0]
        const isFocused = row.driver.driver_id === focusedId
        const size = isFocused ? 82 : index < 3 ? 68 : 56
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
              borderRadius: 999,
              border: `2px solid ${isFocused ? C.cyan : index < 3 ? C.green : C.border}`,
              background: isFocused ? 'rgba(34,211,238,.2)' : 'rgba(15,22,40,.96)',
              color: C.text,
              cursor: 'pointer',
              zIndex: isFocused ? 5 : 4,
              boxShadow: isFocused ? `0 0 32px ${C.cyan}55` : 'none',
              transition: 'all 180ms ease',
            }}
          >
            <div style={{ fontSize: isFocused ? 24 : 19, fontWeight: 950, color: isFocused ? C.cyan : index < 3 ? C.green : C.sub }}>{row.grade}</div>
            <div style={{ fontSize: 12, fontWeight: 900, marginTop: 2 }}>{Math.round(row.cosine * 100)}</div>
          </button>
        )
      })}

      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18, zIndex: 3, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <MiniMetric title="후보 기사" value={`${ranked.length}명`} />
        <MiniMetric title="강한 연결" value={`${ranked.filter((row) => row.cosine >= 0.76).length}명`} />
        <MiniMetric title="선택 기사" value={ranked.find((row) => row.driver.driver_id === focusedId)?.grade ?? '-'} />
      </div>
    </section>
  )
}

function CandidateRow({
  row,
  index,
  active,
  onFocus,
  onSelect,
}: {
  row: RankedDriver
  index: number
  active: boolean
  onFocus: (driverId: string) => void
  onSelect: (driverId: string) => void
}) {
  return (
    <button
      onMouseEnter={() => onFocus(row.driver.driver_id)}
      onMouseLeave={() => onFocus('')}
      onClick={() => onSelect(row.driver.driver_id)}
      style={{
        display: 'grid',
        gridTemplateColumns: '38px 1fr 64px 82px',
        gap: 10,
        alignItems: 'center',
        width: '100%',
        border: `1px solid ${active ? C.cyan : C.border}`,
        borderRadius: 8,
        padding: active ? 14 : 12,
        background: active ? 'rgba(34,211,238,.13)' : '#0B1222',
        color: C.text,
        cursor: 'pointer',
        textAlign: 'left',
        transform: active ? 'translateX(4px)' : 'none',
        transition: 'all 160ms ease',
      }}
    >
      <strong style={{ color: index < 3 ? C.yellow : C.sub, fontSize: 19 }}>{index + 1}</strong>
      <span style={{ fontFamily: 'monospace', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.driver.driver_id}</span>
      <span style={{ color: C.yellow, fontSize: 20, fontWeight: 950 }}>{row.grade}</span>
      <span style={{ color: C.cyan, fontSize: 17, fontWeight: 950 }}>{pct(row.cosine)}</span>
    </button>
  )
}

function CallCard({
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
          <div style={{ fontSize: 18, color: C.sub, fontWeight: 850 }}>콜 성향</div>
          <div style={{ fontSize: 52, lineHeight: 1, fontWeight: 950 }}>{Math.round(groupAverage(vector, '시간대') * 20 + groupAverage(vector, '거리') * 35 + groupAverage(vector, '요금') * 25 + 20)}</div>
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

function DriverCard({ match }: { match?: RankedDriver }) {
  const driver = match?.driver
  return (
    <section style={playerCard(C.green)}>
      <div style={{ color: C.green, fontSize: 15, fontWeight: 950 }}>DRIVER CARD</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 18, color: C.sub, fontWeight: 850 }}>적합도</div>
          <div style={{ fontSize: 60, lineHeight: 1, fontWeight: 950 }}>{match ? Math.round(match.cosine * 100) : '-'}</div>
        </div>
        <div style={{ width: 96, height: 96, borderRadius: 12, background: 'linear-gradient(160deg, #0B3B2D, #0E172A)', border: `1px solid ${C.border}`, display: 'grid', placeItems: 'center', color: C.green, fontSize: 46, fontWeight: 950 }}>
          {match?.grade ?? '-'}
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

function GroupStats({ values, tone }: { values: number[]; tone: string }) {
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
      {FACTOR_GROUPS.map((group) => (
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

function MiniMetric({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: 'rgba(8,12,24,.76)', padding: 12 }}>
      <div style={{ color: C.muted, fontSize: 13, fontWeight: 850 }}>{title}</div>
      <div style={{ color: C.text, fontSize: 20, fontWeight: 950, marginTop: 4 }}>{value}</div>
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
    minHeight: 478,
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
