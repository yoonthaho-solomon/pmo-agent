'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { callToVector, cosineSimilarity, driverToVector as sharedDriverToVector, etaToNear as sharedEtaToNear, scoreDriverForCall, type CallVectorInput } from '@/lib/matching-vector'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type TabKey = 'load' | 'entities' | 'lab'
type StatusTone = 'good' | 'warn' | 'bad' | 'neutral'

interface TableStat {
  table: string
  label: string
  count: number | null
  minDate?: string | null
  maxDate?: string | null
  error?: string
}

interface DateCountRow {
  date: string
  callcards: number | null
  driverLogs: number | null
  matches: number | null
}

interface CallcardRow {
  callcard_id: string
  asp_id: number
  call_date: string
  hour_slot: number
  weekday: number
  s_hexagon: string
  d_hexagon: string
  expected_distance: number
  expected_fare: number
  is_paid: boolean
  is_surge: boolean
  eta_distance: number | null
  product_type: string
}

interface DriverRow {
  driver_id: string
  asp_id: number
  score_dawn: number
  score_morning: number
  score_daytime: number
  score_night: number
  score_mon: number
  score_tue: number
  score_wed: number
  score_thu: number
  score_fri: number
  score_sat: number
  score_sun: number
  score_short: number
  score_medium: number
  score_long: number
  score_low_fare: number
  score_mid_fare: number
  score_high_fare: number
  score_paid: number
  score_free: number
  score_surge: number
  score_normal: number
  score_near: number
  pref_s_hexagons: string[]
  pref_d_hexagons: string[]
  data_days: number
  reliability: number
}

interface CandidateState {
  driver_id: string
  distanceKm: number
  etaMin: number
  online: boolean
  empty: boolean
  fresh: boolean
  canReceive: boolean
}

interface RankedCandidate {
  driver: DriverRow
  state: CandidateState
  cosine: number
  etaScore: number
  acceptProb: number
  reliabilityScore: number
  futureDestinationValue: number | null
  balanceScore: number | null
  finalPreview: number
}

interface RecommendedDriver {
  driver_id: string
  cosine_score: number
  rank: number
  match_reason: string
}

interface RecommendResult {
  asp_id?: number
  driver_pool_size?: number
  recommended_drivers?: RecommendedDriver[]
  error?: string
}

const C = {
  bg: '#080C18',
  panel: '#0F1628',
  panel2: '#111A2E',
  border: '#1E2D4A',
  border2: '#2D4470',
  text: '#F1F5F9',
  sub: '#94A3B8',
  muted: '#4E6080',
  cyan: '#22D3EE',
  purple: '#8B5CF6',
  green: '#10B981',
  red: '#F43F5E',
  yellow: '#F59E0B',
  orange: '#FB923C',
  blue: '#3B82F6',
}

const ASP_OPTIONS = [
  { label: '인천 137', value: 137000000000 },
  { label: '천안 147', value: 147000000000 },
  { label: '부산 160', value: 160000000000 },
]

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

const FACTORS: { key: keyof DriverRow; label: string; group: string; color: string }[] = [
  { key: 'score_dawn', label: '새벽', group: '시간대', color: C.cyan },
  { key: 'score_morning', label: '오전', group: '시간대', color: C.cyan },
  { key: 'score_daytime', label: '주간', group: '시간대', color: C.cyan },
  { key: 'score_night', label: '야간', group: '시간대', color: C.cyan },
  { key: 'score_mon', label: '월', group: '요일', color: C.purple },
  { key: 'score_tue', label: '화', group: '요일', color: C.purple },
  { key: 'score_wed', label: '수', group: '요일', color: C.purple },
  { key: 'score_thu', label: '목', group: '요일', color: C.purple },
  { key: 'score_fri', label: '금', group: '요일', color: C.purple },
  { key: 'score_sat', label: '토', group: '요일', color: C.purple },
  { key: 'score_sun', label: '일', group: '요일', color: C.purple },
  { key: 'score_short', label: '단거리', group: '거리', color: C.green },
  { key: 'score_medium', label: '중거리', group: '거리', color: C.green },
  { key: 'score_long', label: '장거리', group: '거리', color: C.green },
  { key: 'score_low_fare', label: '저요금', group: '요금', color: C.orange },
  { key: 'score_mid_fare', label: '중요금', group: '요금', color: C.orange },
  { key: 'score_high_fare', label: '고요금', group: '요금', color: C.orange },
  { key: 'score_paid', label: '유료콜', group: '콜유형', color: C.red },
  { key: 'score_free', label: '무료콜', group: '콜유형', color: C.red },
  { key: 'score_surge', label: '탄력', group: '상품', color: C.yellow },
  { key: 'score_normal', label: '일반', group: '상품', color: C.yellow },
  { key: 'score_near', label: '근접성', group: 'ETA', color: C.blue },
]

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function fmt(n: number | null | undefined) {
  return n == null ? '-' : n.toLocaleString()
}

function toneColor(tone: StatusTone) {
  return tone === 'good' ? C.green : tone === 'warn' ? C.yellow : tone === 'bad' ? C.red : C.sub
}

function hashNumber(input: string, salt = 0) {
  let h = 2166136261 + salt
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}

function etaToNear(eta: number | null | undefined) {
  return sharedEtaToNear(eta)
}

function cosine(a: number[], b: number[]) {
  return cosineSimilarity(a, b)
}

function driverVector(d: DriverRow) {
  return sharedDriverToVector(d)
}

function callVector(input: CallVectorInput) {
  return callToVector(input)
}

function simulatedState(driverId: string): CandidateState {
  const h = hashNumber(driverId)
  const distanceKm = Number(((h % 1200) / 100 + 0.2).toFixed(1))
  return {
    driver_id: driverId,
    distanceKm,
    etaMin: Math.max(2, Math.round(distanceKm * 2.4 + (h % 5))),
    online: h % 100 >= 12,
    empty: h % 100 >= 24,
    fresh: h % 100 >= 18,
    canReceive: h % 100 >= 30,
  }
}

function acceptanceEstimate(d: DriverRow, call: ReturnType<typeof callVector>) {
  const sim = cosine(call, driverVector(d))
  return Math.min(0.95, Math.max(0.05, sim * 0.65 + d.reliability * 0.25 + 0.05))
}

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: C.bg,
  color: C.text,
  fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const cardStyle: React.CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...cardStyle, padding: 20, ...style }}>{children}</div>
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: StatusTone }) {
  return (
    <Panel style={{ minHeight: 92 }}>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 10, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: toneColor(tone), fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </Panel>
  )
}

function Button({
  children,
  onClick,
  disabled,
  tone = 'cyan',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'cyan' | 'purple' | 'green' | 'orange'
}) {
  const color = tone === 'purple' ? C.purple : tone === 'green' ? C.green : tone === 'orange' ? C.orange : C.cyan
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 36,
        borderRadius: 8,
        border: `1px solid ${disabled ? C.border : color}`,
        background: disabled ? 'transparent' : `${color}22`,
        color: disabled ? C.muted : color,
        padding: '0 14px',
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function SectionHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontSize: 18, fontWeight: 850 }}>{title}</h2>
      {desc && <p style={{ marginTop: 6, color: C.sub, fontSize: 14, lineHeight: 1.5 }}>{desc}</p>}
    </div>
  )
}

function VectorBars({ values }: { values: number[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      {FACTORS.map((f, i) => (
        <div key={String(f.key)} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 44px', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: C.sub }}>{f.label}</span>
          <div style={{ height: 7, background: '#19243A', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(1, values[i] ?? 0) * 100}%`, height: '100%', background: f.color }} />
          </div>
          <span style={{ fontSize: 14, color: C.muted, textAlign: 'right' }}>{((values[i] ?? 0) * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  )
}

function DataLoadTab() {
  const [stats, setStats] = useState<TableStat[]>([])
  const [dateCounts, setDateCounts] = useState<DateCountRow[]>([])
  const [loading, setLoading] = useState(true)

  async function tableStatus(table: string, label: string, dateColumn?: string): Promise<TableStat> {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    let minDate: string | null = null
    let maxDate: string | null = null
    let rangeError: string | undefined

    if (dateColumn && !error) {
      const [minRes, maxRes] = await Promise.all([
        supabase.from(table).select(dateColumn).order(dateColumn, { ascending: true }).limit(1),
        supabase.from(table).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
      ])
      minDate = (minRes.data?.[0] as Record<string, string> | undefined)?.[dateColumn] ?? null
      maxDate = (maxRes.data?.[0] as Record<string, string> | undefined)?.[dateColumn] ?? null
      rangeError = minRes.error?.message ?? maxRes.error?.message
    }

    return { table, label, count: count ?? null, minDate, maxDate, error: error?.message ?? rangeError }
  }

  async function countByDate(table: string, column: string, date: string): Promise<number | null> {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, date)
    return error ? null : count ?? 0
  }

  async function loadDateCounts(statsRows: TableStat[]) {
    const callRange = statsRows.find((item) => item.table === 'callcard_mbti')
    const dates = Array.from(new Set(['2026-05-22', '2026-05-23', callRange?.maxDate].filter(Boolean) as string[]))
    const rows = await Promise.all(dates.map(async (date) => ({
      date,
      callcards: await countByDate('callcard_mbti', 'call_date', date),
      driverLogs: await countByDate('driver_daily_logs', 'service_date', date),
      matches: await countByDate('matching_scores', 'match_date', date),
    })))
    setDateCounts(rows)
  }

  async function refresh() {
    setLoading(true)
    const next = await Promise.all([
      tableStatus('callcard_mbti', '호출데이터', 'call_date'),
      tableStatus('meter_daily_logs', '앱미터 일별', 'service_date'),
      tableStatus('meter_hourly_logs', '앱미터 시간대', 'log_date'),
      tableStatus('meter_driver_logs', '앱미터 기사별', 'log_date'),
      tableStatus('driver_daily_logs', '기사 일일 로그', 'service_date'),
      tableStatus('driver_mbti', '기사 22D 벡터'),
      tableStatus('callcard_profile', '콜카드 프로필'),
      tableStatus('matching_scores', '매칭 결과', 'match_date'),
      tableStatus('agent_logs', '실행 로그', 'run_date'),
    ])
    setStats(next)
    await loadDateCounts(next)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const call = stats.find((item) => item.table === 'callcard_mbti')
  const meterDaily = stats.find((item) => item.table === 'meter_daily_logs')
  const meterHourly = stats.find((item) => item.table === 'meter_hourly_logs')
  const meterDriver = stats.find((item) => item.table === 'meter_driver_logs')
  const driverDaily = stats.find((item) => item.table === 'driver_daily_logs')
  const driverVectors = stats.find((item) => item.table === 'driver_mbti')
  const matching = stats.find((item) => item.table === 'matching_scores')
  const vectorRate = driverDaily?.count ? Math.min(1, (driverVectors?.count ?? 0) / driverDaily.count) : 0

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <Stat label="호출데이터 저장" value={loading ? '...' : fmt(call?.count)} tone={call?.count ? 'good' : 'warn'} />
        <Stat label="앱미터 저장" value={loading ? '...' : meterDaily?.error ? `2시트 ${fmt(meterHourly?.count)}/${fmt(meterDriver?.count)}` : fmt(meterDaily?.count)} tone={meterDaily?.error ? 'warn' : meterDaily?.count ? 'good' : 'neutral'} />
        <Stat label="기사 로그" value={loading ? '...' : fmt(driverDaily?.count)} tone={driverDaily?.count ? 'good' : 'warn'} />
        <Stat label="기사 벡터 생성률" value={driverDaily?.count ? pct(vectorRate) : '-'} tone={driverVectors?.count ? 'good' : 'warn'} />
        <Stat label="매칭 결과" value={loading ? '...' : fmt(matching?.count)} tone={matching?.count ? 'good' : 'warn'} />
      </div>

      <Panel>
        <SectionHeader title="주요 날짜 적재 확인" desc="2026-05-23 호출데이터 파일이 이미 Supabase에 있는지 빠르게 확인합니다." />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['날짜', '호출데이터', '기사 로그', '매칭 Top10'].map((head) => (
                  <th key={head} style={{ textAlign: 'left', color: C.muted, borderBottom: `1px solid ${C.border}`, padding: '10px 8px' }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dateCounts.map((row) => (
                <tr key={row.date}>
                  <td style={tdStyle()}>{row.date}</td>
                  <td style={tdStyle(row.callcards ? C.green : C.yellow)}>{fmt(row.callcards)}</td>
                  <td style={tdStyle(row.driverLogs ? C.green : C.yellow)}>{fmt(row.driverLogs)}</td>
                  <td style={tdStyle(row.matches ? C.green : C.yellow)}>{fmt(row.matches)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 18 }}>
        <Panel>
          <SectionHeader
            title="데이터 적재 현황"
            desc="이 화면은 읽기 전용입니다. 파일 업로드와 재처리는 별도 적재 관리 화면에서만 실행합니다."
          />
          <div style={{ display: 'grid', gap: 8 }}>
            {stats.map((item) => (
              <div key={item.table} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontWeight: 850 }}>{item.label}</div>
                  <div style={{ color: C.muted, fontSize: 14 }}>{item.table}</div>
                  {(item.minDate || item.maxDate) && <div style={{ color: C.sub, marginTop: 4 }}>{item.minDate ?? '-'} ~ {item.maxDate ?? '-'}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: item.error ? C.yellow : C.text, fontWeight: 900 }}>{item.error ? '확인 필요' : fmt(item.count)}</div>
                  {item.error && <div style={{ maxWidth: 260, color: C.yellow, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.error}</div>}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="운영 메모" desc="현재 연결된 Supabase/Vercel 기준 상태입니다." />
          <div style={{ display: 'grid', gap: 12, lineHeight: 1.55, color: C.sub }}>
            <div style={{ padding: 12, borderRadius: 8, background: '#0B1222', border: `1px solid ${C.border}` }}>
              호출데이터는 실제 Supabase의 <strong style={{ color: C.text }}>callcard_mbti</strong>를 읽고 있습니다. 현재 표시 범위는 {call?.minDate ?? '-'} ~ {call?.maxDate ?? '-'}이며, 2026-05-23 데이터도 이미 적재되어 있습니다.
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: '#0B1222', border: `1px solid ${C.border}` }}>
              기사 프로필/벡터는 <strong style={{ color: C.text }}>driver_daily_logs</strong>와 <strong style={{ color: C.text }}>driver_mbti</strong> 기준으로 확인합니다.
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(245,158,11,.08)', border: `1px solid rgba(245,158,11,.25)`, color: C.yellow }}>
              앱미터는 현재 <strong>meter_daily_logs</strong> 일별 테이블이 schema cache에서 확인되지 않고, <strong>meter_hourly_logs</strong>/<strong>meter_driver_logs</strong>는 존재하지만 0건입니다. 일별 적재 테이블 생성/노출 여부와 2시트 적재 사용 여부를 확정해야 합니다.
            </div>
            <Link href="/ingest" style={{ color: C.cyan, textDecoration: 'none', border: `1px solid ${C.cyan}`, borderRadius: 8, padding: '10px 12px', fontWeight: 850, textAlign: 'center' }}>
              적재 관리 화면으로 이동
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  )
}
function EntitiesTab() {
  const [calls, setCalls] = useState<CallcardRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [selectedCall, setSelectedCall] = useState<CallcardRow | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<DriverRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [aspId, setAspId] = useState(137000000000)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [callRes, driverRes] = await Promise.all([
        supabase
          .from('callcard_mbti')
          .select('callcard_id,asp_id,call_date,hour_slot,weekday,s_hexagon,d_hexagon,expected_distance,expected_fare,is_paid,is_surge,eta_distance,product_type')
          .eq('asp_id', aspId)
          .order('call_date', { ascending: false })
          .limit(40),
        supabase
          .from('driver_mbti')
          .select('*')
          .eq('asp_id', aspId)
          .order('reliability', { ascending: false })
          .limit(40),
      ])
      const nextCalls = (callRes.data ?? []) as CallcardRow[]
      const nextDrivers = (driverRes.data ?? []) as DriverRow[]
      setCalls(nextCalls)
      setDrivers(nextDrivers)
      setSelectedCall(nextCalls[0] ?? null)
      setSelectedDriver(nextDrivers[0] ?? null)
      setLoading(false)
    })()
  }, [aspId])

  const callVec = selectedCall ? callVector(selectedCall) : []
  const driverVec = selectedDriver ? driverVector(selectedDriver) : []

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900 }}>콜카드·기사 데이터 탐색</h2>
          <p style={{ color: C.sub, marginTop: 6, fontSize: 14 }}>실제 Supabase의 `callcard_mbti`, `driver_mbti`를 읽어 22차원 벡터를 확인합니다.</p>
        </div>
        <select value={aspId} onChange={(e) => setAspId(Number(e.target.value))} style={{ height: 36, background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0 10px' }}>
          {ASP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <Panel style={{ minHeight: 520 }}>
          <SectionHeader title="콜카드 목록" desc="시간대, 거리, 요금, 콜유형, 상품 성향을 콜 벡터로 변환합니다." />
          {loading ? <p style={{ color: C.muted }}>불러오는 중</p> : (
            <div style={{ display: 'grid', gap: 8, maxHeight: 390, overflow: 'auto' }}>
              {calls.map((c) => (
                <button key={c.callcard_id} onClick={() => setSelectedCall(c)} style={{
                  textAlign: 'left',
                  background: selectedCall?.callcard_id === c.callcard_id ? '#16213A' : '#0B1222',
                  border: `1px solid ${selectedCall?.callcard_id === c.callcard_id ? C.cyan : C.border}`,
                  color: C.text,
                  borderRadius: 8,
                  padding: 12,
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <strong style={{ fontFamily: 'monospace' }}>{c.callcard_id}</strong>
                    <span style={{ color: C.sub }}>{c.call_date} {c.hour_slot}시</span>
                  </div>
                  <div style={{ color: C.muted, marginTop: 6, fontSize: 14 }}>
                    {fmt(c.expected_distance)}m · {fmt(c.expected_fare)}원 · {c.is_paid ? '유료' : '무료'} · {c.is_surge ? '탄력' : '일반'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel style={{ minHeight: 520 }}>
          <SectionHeader title="기사 목록" desc="기사별 데이터 건수와 신뢰도를 기준으로 우선 표시합니다." />
          {loading ? <p style={{ color: C.muted }}>불러오는 중</p> : (
            <div style={{ display: 'grid', gap: 8, maxHeight: 390, overflow: 'auto' }}>
              {drivers.map((d) => (
                <button key={d.driver_id} onClick={() => setSelectedDriver(d)} style={{
                  textAlign: 'left',
                  background: selectedDriver?.driver_id === d.driver_id ? '#16213A' : '#0B1222',
                  border: `1px solid ${selectedDriver?.driver_id === d.driver_id ? C.green : C.border}`,
                  color: C.text,
                  borderRadius: 8,
                  padding: 12,
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <strong style={{ fontFamily: 'monospace' }}>{d.driver_id}</strong>
                    <span style={{ color: d.reliability >= 0.3 ? C.green : C.yellow }}>신뢰도 {pct(d.reliability)}</span>
                  </div>
                  <div style={{ color: C.muted, marginTop: 6, fontSize: 14 }}>
                    데이터 {d.data_days}일 · 선호 출발 {d.pref_s_hexagons?.[0] ?? '-'} · 선호 도착 {d.pref_d_hexagons?.[0] ?? '-'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <Panel>
          <SectionHeader title="콜카드 22차원 벡터" />
          {selectedCall ? (
            <>
              <div style={{ marginBottom: 12, color: C.sub, fontSize: 14 }}>
                {selectedCall.callcard_id} · ETA near {etaToNear(selectedCall.eta_distance).toFixed(2)}
              </div>
              <VectorBars values={callVec} />
            </>
          ) : <p style={{ color: C.muted }}>콜카드를 선택하세요.</p>}
        </Panel>
        <Panel>
          <SectionHeader title="기사 22차원 벡터" />
          {selectedDriver ? (
            <>
              <div style={{ marginBottom: 12, color: C.sub, fontSize: 14 }}>
                {selectedDriver.driver_id} · 데이터 {selectedDriver.data_days}일 · 신뢰도 {pct(selectedDriver.reliability)}
              </div>
              <VectorBars values={driverVec} />
            </>
          ) : <p style={{ color: C.muted }}>기사를 선택하세요.</p>}
        </Panel>
      </div>
    </div>
  )
}

function SimulationTab() {
  const [aspId, setAspId] = useState(137000000000)
  const [hour, setHour] = useState(0)
  const [weekday, setWeekday] = useState(4)
  const [distance, setDistance] = useState(5000)
  const [fare, setFare] = useState(12000)
  const [isPaid, setIsPaid] = useState(false)
  const [isSurge, setIsSurge] = useState(false)
  const [eta, setEta] = useState<number | ''>('')
  const [baseRadius, setBaseRadius] = useState(3)
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [actualCalls, setActualCalls] = useState<CallcardRow[]>([])
  const [selectedCallId, setSelectedCallId] = useState('')
  const [recommendResult, setRecommendResult] = useState<RecommendResult | null>(null)
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loadDrivers() {
    setLoading(true)
    const { data } = await supabase.from('driver_mbti').select('*').eq('asp_id', aspId).limit(3000)
    setDrivers((data ?? []) as DriverRow[])
    setLoading(false)
  }

  async function loadActualCalls() {
    const { data } = await supabase
      .from('callcard_mbti')
      .select('callcard_id,asp_id,call_date,hour_slot,weekday,s_hexagon,d_hexagon,expected_distance,expected_fare,is_paid,is_surge,eta_distance,product_type')
      .eq('asp_id', aspId)
      .order('call_date', { ascending: false })
      .limit(80)
    setActualCalls((data ?? []) as CallcardRow[])
    setSelectedCallId('')
    setRecommendResult(null)
  }

  useEffect(() => {
    loadDrivers()
    loadActualCalls()
  }, [aspId])

  const selectedActualCall = useMemo(() => actualCalls.find((c) => c.callcard_id === selectedCallId) ?? null, [actualCalls, selectedCallId])

  const call = useMemo(() => ({
    hour_slot: hour,
    weekday,
    expected_distance: distance,
    expected_fare: fare,
    is_paid: isPaid,
    is_surge: isSurge,
    eta_distance: eta === '' ? null : eta,
    s_hexagon: selectedActualCall?.s_hexagon ?? null,
    d_hexagon: selectedActualCall?.d_hexagon ?? null,
  }), [hour, weekday, distance, fare, isPaid, isSurge, eta, selectedActualCall])

  function applyActualCall(callcardId: string) {
    const row = actualCalls.find((c) => c.callcard_id === callcardId)
    setSelectedCallId(callcardId)
    setRecommendResult(null)
    if (!row) return
    setHour(row.hour_slot)
    setWeekday(row.weekday)
    setDistance(row.expected_distance ?? 0)
    setFare(row.expected_fare ?? 0)
    setIsPaid(Boolean(row.is_paid))
    setIsSurge(Boolean(row.is_surge))
    setEta(row.eta_distance ?? '')
  }

  async function runRecommendCompare() {
    setRecommendLoading(true)
    setRecommendResult(null)
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asp_id: aspId, ...call }),
    })
    const json = await res.json()
    setRecommendResult(json)
    setRecommendLoading(false)
  }

  const cv = useMemo(() => callVector(call), [call])

  const ranked = useMemo<RankedCandidate[]>(() => {
    return drivers.map((d) => {
      const state = simulatedState(d.driver_id)
      const cos = cosine(cv, driverVector(d))
      const etaScore = Math.max(0, 1 - state.etaMin / 30)
      const acceptProb = acceptanceEstimate(d, cv)
      const reliabilityScore = d.reliability
      const finalPreview = cos * 0.55 + etaScore * 0.2 + acceptProb * 0.15 + reliabilityScore * 0.1
      return {
        driver: d,
        state,
        cosine: cos,
        etaScore,
        acceptProb,
        reliabilityScore,
        futureDestinationValue: null,
        balanceScore: null,
        finalPreview,
      }
    })
  }, [drivers, cv])

  const rounds = [baseRadius, baseRadius * 2, baseRadius * 3].map((radius, i) => {
    const inRadius = ranked.filter((r) => r.state.distanceKm <= radius)
    const available = inRadius.filter((r) => r.state.online && r.state.empty && r.state.fresh && r.state.canReceive)
    return { step: i + 1, radius, inRadius, available, top: [...available].sort((a, b) => b.cosine - a.cosine).slice(0, 10) }
  })

  const firstRoundWithCandidates = rounds.find((r) => r.available.length > 0) ?? rounds[rounds.length - 1]
  const similarityTop = [...firstRoundWithCandidates.available].sort((a, b) => b.cosine - a.cosine).slice(0, 10)
  const distanceTop = [...firstRoundWithCandidates.available].sort((a, b) => a.state.distanceKm - b.state.distanceKm).slice(0, 10)
  const apiComparableTop = useMemo(() => {
    return drivers
      .map((driver) => ({ driver, score: scoreDriverForCall(call, driver) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }, [drivers, call])
  const apiIds = recommendResult?.recommended_drivers?.map((r) => r.driver_id) ?? []
  const localApiIds = apiComparableTop.map((r) => r.driver.driver_id)
  const top10Overlap = apiIds.filter((id) => localApiIds.includes(id)).length

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 18 }}>
        <Panel>
          <SectionHeader title="콜카드 조건 입력" desc="22D 벡터와 반경 탐색 조건을 조합합니다." />
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6, color: C.sub, fontSize: 14, fontWeight: 800 }}>
              ASP
              <select value={aspId} onChange={(e) => setAspId(Number(e.target.value))} style={inputStyle()}>
                {ASP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label style={labelStyle()}>
              실제 콜카드 선택
              <select value={selectedCallId} onChange={(e) => applyActualCall(e.target.value)} style={inputStyle()}>
                <option value="">직접 입력</option>
                {actualCalls.map((c) => (
                  <option key={c.callcard_id} value={c.callcard_id}>{c.call_date} · {c.callcard_id}</option>
                ))}
              </select>
            </label>
            {selectedActualCall && (
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,211,238,.08)', border: `1px solid rgba(34,211,238,.25)`, color: C.sub, lineHeight: 1.5 }}>
                실제 콜카드 {selectedActualCall.callcard_id} 기준 입력입니다. 출발/도착 H3와 ETA near까지 API 비교에 포함됩니다.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={labelStyle()}>시간<input style={inputStyle()} type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))} /></label>
              <label style={labelStyle()}>요일<select style={inputStyle()} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={labelStyle()}>예상거리 m<input style={inputStyle()} type="number" value={distance} onChange={(e) => setDistance(Number(e.target.value))} /></label>
              <label style={labelStyle()}>예상요금 원<input style={inputStyle()} type="number" value={fare} onChange={(e) => setFare(Number(e.target.value))} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={labelStyle()}>최초 반경 km<input style={inputStyle()} type="number" value={baseRadius} onChange={(e) => setBaseRadius(Number(e.target.value))} /></label>
              <label style={labelStyle()}>ETA 초<input style={inputStyle()} type="number" value={eta} placeholder="미상" onChange={(e) => setEta(e.target.value === '' ? '' : Number(e.target.value))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button tone={isPaid ? 'purple' : 'cyan'} onClick={() => setIsPaid(!isPaid)}>{isPaid ? '유료콜' : '무료콜'}</Button>
              <Button tone={isSurge ? 'orange' : 'cyan'} onClick={() => setIsSurge(!isSurge)}>{isSurge ? '탄력요금' : '일반요금'}</Button>
              <Button tone="green" onClick={loadDrivers}>{loading ? '조회 중' : '기사 새로고침'}</Button>
              <Button tone="purple" onClick={runRecommendCompare} disabled={recommendLoading}>{recommendLoading ? '비교 중' : '/api/recommend 비교'}</Button>
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="후보 생성 → 필터링 → 랭킹 → 발송" desc="위치/온라인/공차/최신성은 현재 실데이터가 없어 시뮬레이션용 값으로만 표시합니다." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {rounds.map((r) => (
              <div key={r.step} style={{ background: '#0B1222', border: `1px solid ${r === firstRoundWithCandidates ? C.green : C.border}`, borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{r.step}차 반경</strong>
                  <span style={{ color: C.cyan }}>{r.radius}km</span>
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  <MiniMetric label="등록 기사" value={r.inRadius.length} />
                  <MiniMetric label="운행 가능" value={r.available.length} />
                  <MiniMetric label="발송 후보" value={r.top.length} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'rgba(34,211,238,.08)', border: `1px solid rgba(34,211,238,.25)`, color: C.cyan, fontSize: 14, lineHeight: 1.5 }}>
            실제 배차 API 계약 전까지 거리, ETA, 온라인, 공차, 위치 최신성은 배차 로직에 저장하거나 전송하지 않습니다. 이 화면은 정책 비교용 Matching Lab입니다.
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionHeader title="실제 콜카드 API 추천 검증" desc="같은 공통 22D 계산 모듈로 화면 Top 10과 /api/recommend Top 10을 비교합니다. 반경/온라인 시뮬레이션 필터는 제외합니다." />
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 14, alignItems: 'start' }}>
          <div style={{ ...cardStyle, padding: 14, background: '#0B1222' }}>
            <div style={{ color: C.muted, fontWeight: 800, marginBottom: 8 }}>Top 10 일치</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: recommendResult?.error ? C.red : C.green }}>
              {recommendResult ? `${top10Overlap}/10` : '-'}
            </div>
            <div style={{ color: C.muted, marginTop: 8 }}>기사 풀 {recommendResult?.driver_pool_size?.toLocaleString() ?? drivers.length.toLocaleString()}명</div>
          </div>
          <div>
            <div style={{ color: C.cyan, fontWeight: 900, marginBottom: 8 }}>화면 공통 계산 Top 10</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {apiComparableTop.map((r, i) => (
                <div key={r.driver.driver_id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 70px', gap: 8, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#0B1222' }}>
                  <strong style={{ color: i < 3 ? C.yellow : C.sub }}>{i + 1}</strong>
                  <span style={{ fontFamily: 'monospace' }}>{r.driver.driver_id}</span>
                  <span style={{ color: C.cyan }}>{pct(r.score)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ color: C.purple, fontWeight: 900, marginBottom: 8 }}>/api/recommend Top 10</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {recommendResult?.error && <div style={{ color: C.red }}>{recommendResult.error}</div>}
              {!recommendResult && <div style={{ color: C.muted }}>비교 버튼을 누르면 실제 API 결과가 표시됩니다.</div>}
              {recommendResult?.recommended_drivers?.map((r) => (
                <div key={r.driver_id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 70px', gap: 8, padding: '8px 10px', border: `1px solid ${localApiIds.includes(r.driver_id) ? C.green : C.border}`, borderRadius: 8, background: '#0B1222' }}>
                  <strong style={{ color: r.rank <= 3 ? C.yellow : C.sub }}>{r.rank}</strong>
                  <span style={{ fontFamily: 'monospace' }}>{r.driver_id}</span>
                  <span style={{ color: C.purple }}>{pct(r.cosine_score)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <Panel>
          <SectionHeader title="기존 거리순 결과" desc="주변 후보를 가까운 거리 기준으로 정렬한 비교군입니다." />
          <CandidateTable rows={distanceTop} mode="distance" />
        </Panel>
        <Panel>
          <SectionHeader title="신규 유사도 기반 Top 10" desc="기존 22D cosine을 유지하고 구성요소를 분리해 표시합니다." />
          <CandidateTable rows={similarityTop} mode="similarity" />
        </Panel>
      </div>

      <Panel>
        <SectionHeader title="점수 구성요소 매트릭스" desc="최종 배차점수는 아직 정책 확정 전이므로 preview로만 표시합니다." />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['기사', '거리', 'ETA', 'cosine', 'ETA 점수', '예상 수락확률', '신뢰도', '도착지역 가치', '배차 균형', 'preview'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', color: C.muted, borderBottom: `1px solid ${C.border}`, padding: '10px 8px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {similarityTop.map((r) => (
                <tr key={r.driver.driver_id}>
                  <td style={tdStyle()}>{r.driver.driver_id}</td>
                  <td style={tdStyle()}>{r.state.distanceKm}km</td>
                  <td style={tdStyle()}>{r.state.etaMin}분</td>
                  <td style={tdStyle(C.cyan)}>{pct(r.cosine)}</td>
                  <td style={tdStyle(C.blue)}>{pct(r.etaScore)}</td>
                  <td style={tdStyle(C.green)}>{pct(r.acceptProb)}</td>
                  <td style={tdStyle(C.yellow)}>{pct(r.reliabilityScore)}</td>
                  <td style={tdStyle(C.muted)}>향후</td>
                  <td style={tdStyle(C.muted)}>향후</td>
                  <td style={tdStyle(C.purple)}>{pct(r.finalPreview)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: C.sub, fontSize: 14 }}>
      <span>{label}</span>
      <strong style={{ color: C.text }}>{value.toLocaleString()}</strong>
    </div>
  )
}

function CandidateTable({ rows, mode }: { rows: RankedCandidate[]; mode: 'distance' | 'similarity' }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.length === 0 ? <p style={{ color: C.muted }}>조건에 맞는 후보가 없습니다.</p> : rows.map((r, i) => (
        <div key={r.driver.driver_id} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px 70px', gap: 10, alignItems: 'center', padding: 10, borderRadius: 8, background: '#0B1222', border: `1px solid ${C.border}` }}>
          <strong style={{ color: i < 3 ? C.yellow : C.sub }}>{i + 1}</strong>
          <div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800 }}>{r.driver.driver_id}</div>
            <div style={{ fontSize: 14, color: C.muted }}>online {r.state.online ? 'Y' : 'N'} · empty {r.state.empty ? 'Y' : 'N'} · fresh {r.state.fresh ? 'Y' : 'N'}</div>
          </div>
          <span style={{ color: C.sub }}>{r.state.distanceKm}km</span>
          <span style={{ color: C.blue }}>{r.state.etaMin}분</span>
          <span style={{ color: mode === 'similarity' ? C.cyan : C.sub }}>{pct(mode === 'similarity' ? r.cosine : r.finalPreview)}</span>
        </div>
      ))}
    </div>
  )
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    height: 36,
    background: '#0B1222',
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '0 10px',
    outline: 'none',
  }
}

function labelStyle(): React.CSSProperties {
  return { display: 'grid', gap: 6, color: C.sub, fontSize: 14, fontWeight: 800 }
}

function tdStyle(color = C.text): React.CSSProperties {
  return { padding: '10px 8px', borderBottom: `1px solid ${C.border}`, color }
}

export default function MatchingLab({ initialTab = 'load' }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab)
  const tabs: { key: TabKey; label: string; desc: string }[] = [
    { key: 'load', label: '데이터 적재', desc: 'Supabase 저장·연결 상태' },
    { key: 'entities', label: '콜카드·기사', desc: '22D 벡터 탐색' },
    { key: 'lab', label: '매칭 시뮬레이션', desc: '반경 확장과 정책 비교' },
  ]

  return (
    <div style={shellStyle}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${C.bg}; }
        button, input, select { font-family: inherit; }
        select option { background: ${C.panel}; color: ${C.text}; }
      `}</style>

      <header style={{ height: 56, borderBottom: `1px solid ${C.border}`, background: 'rgba(8,12,24,.95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>PMO Matching Lab</div>
          <div style={{ color: C.muted, fontSize: 14 }}>Grab × Uber × DiDi 운영 검증 콘솔</div>
        </div>
        <nav style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard" style={{ color: C.sub, textDecoration: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 14 }}>대시보드</Link>
          <Link href="/simulator" style={{ color: C.sub, textDecoration: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 14 }}>시뮬레이터</Link>
          <Link href="/ingest" style={{ color: C.sub, textDecoration: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 14 }}>적재 관리</Link>
        </nav>
      </header>

      <main style={{ maxWidth: 1440, margin: '0 auto', padding: 24 }}>
        <section style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 30, margin: 0, letterSpacing: '-0.02em' }}>배차 정책 검증 워크벤치</h1>
          <p style={{ color: C.sub, margin: '8px 0 0', lineHeight: 1.5 }}>
            기존 22차원 벡터와 코사인 유사도를 유지하면서 데이터 적재, 콜·기사 탐색, 반경 확장 시뮬레이션을 분리했습니다.
          </p>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...cardStyle,
                padding: 14,
                textAlign: 'left',
                color: tab === t.key ? C.text : C.sub,
                borderColor: tab === t.key ? C.cyan : C.border,
                background: tab === t.key ? '#122039' : C.panel,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 900 }}>{t.label}</div>
              <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {tab === 'load' && <DataLoadTab />}
        {tab === 'entities' && <EntitiesTab />}
        {tab === 'lab' && <SimulationTab />}
      </main>
    </div>
  )
}














