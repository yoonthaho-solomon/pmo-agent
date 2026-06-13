'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  error?: string
}

interface UploadResult {
  message?: string
  service_date?: string
  driver_count?: number
  callcard_count?: number
  data_rows_read?: number
  match_count?: number
  call_count?: number
  total_rows_read?: number
  error?: string
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

function FilePicker({
  label,
  file,
  onChange,
}: {
  label: string
  file: File | null
  onChange: (file: File | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div style={{ fontSize: 14, color: C.muted, fontWeight: 800, marginBottom: 8 }}>{label}</div>
      <button
        onClick={() => ref.current?.click()}
        style={{
          width: '100%',
          border: `1px dashed ${file ? C.green : C.border2}`,
          background: '#0B1222',
          color: file ? C.text : C.sub,
          borderRadius: 8,
          height: 44,
          textAlign: 'left',
          padding: '0 14px',
          cursor: 'pointer',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {file ? file.name : 'xlsx 파일 선택'}
      </button>
      <input ref={ref} type="file" accept=".xlsx,.xls" hidden onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </div>
  )
}

function DataLoadTab() {
  const [stats, setStats] = useState<TableStat[]>([])
  const [loading, setLoading] = useState(true)
  const [callcardFile, setCallcardFile] = useState<File | null>(null)
  const [remappedFile, setRemappedFile] = useState<File | null>(null)
  const [meterFile, setMeterFile] = useState<File | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)

  async function refresh() {
    setLoading(true)
    const tableList = [
      ['callcard_mbti', '호출데이터'],
      ['meter_daily_logs', '앱미터데이터'],
      ['driver_daily_logs', '기사 일일 로그'],
      ['driver_mbti', '기사 22D 벡터'],
      ['callcard_profile', '콜카드 프로필'],
      ['matching_scores', '매칭 결과'],
      ['agent_logs', '실행 로그'],
    ] as const
    const next: TableStat[] = []
    for (const [table, label] of tableList) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      next.push({ table, label, count: count ?? null, error: error?.message })
    }
    setStats(next)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function postForm(endpoint: string, form: FormData, name: string) {
    setRunning(name)
    setResult(null)
    const res = await fetch(endpoint, { method: 'POST', body: form })
    const json = await res.json()
    setResult(json)
    setRunning(null)
    refresh()
  }

  async function runJson(endpoint: string, body: object, name: string) {
    setRunning(name)
    setResult(null)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    setResult(json)
    setRunning(null)
    refresh()
  }

  const callDate = callcardFile?.name.match(/^(\d{4})(\d{2})(\d{2})/)
  const serviceDate = callDate ? `${callDate[1]}-${callDate[2]}-${callDate[3]}` : ''
  const callCount = stats.find((s) => s.table === 'callcard_mbti')?.count ?? 0
  const driverDaily = stats.find((s) => s.table === 'driver_daily_logs')?.count ?? 0
  const driverVectors = stats.find((s) => s.table === 'driver_mbti')?.count ?? 0
  const matchingCount = stats.find((s) => s.table === 'matching_scores')?.count ?? null
  const vectorRate = driverDaily ? Math.min(1, driverVectors / driverDaily) : 0

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <Stat label="호출데이터 저장" value={loading ? '...' : fmt(callCount)} tone={callCount ? 'good' : 'warn'} />
        <Stat label="앱미터 저장" value={loading ? '...' : fmt(stats.find((s) => s.table === 'meter_daily_logs')?.count)} tone="neutral" />
        <Stat label="기사 ID 연결률" value="정책 필요" tone="warn" />
        <Stat label="기사 벡터 생성률" value={driverDaily ? pct(vectorRate) : '-'} tone={driverVectors ? 'good' : 'warn'} />
        <Stat label="매칭 결과" value={matchingCount == null ? '권한 확인' : fmt(matchingCount)} tone={matchingCount ? 'good' : 'warn'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
        <Panel>
          <SectionHeader
            title="데이터 적재"
            desc="기존 업로드 API를 그대로 사용합니다. Supabase 테이블과 환경변수는 변경하지 않습니다."
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FilePicker label="callcard_eta" file={callcardFile} onChange={setCallcardFile} />
            <FilePicker label="remapped" file={remappedFile} onChange={setRemappedFile} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <Button
              disabled={!callcardFile || !remappedFile || running != null}
              onClick={() => {
                if (!callcardFile || !remappedFile) return
                const form = new FormData()
                form.append('callcard_eta', callcardFile)
                form.append('remapped', remappedFile)
                postForm('/api/callcard-mbti', form, 'callcard')
              }}
            >
              호출데이터 적재
            </Button>
            <Button
              tone="green"
              disabled={!callcardFile || !remappedFile || running != null}
              onClick={() => {
                if (!callcardFile || !remappedFile) return
                const form = new FormData()
                form.append('callcard_eta', callcardFile)
                form.append('remapped', remappedFile)
                postForm('/api/driver-logs', form, 'driver-logs')
              }}
            >
              기사 로그 생성
            </Button>
            <Button tone="purple" disabled={running != null} onClick={() => runJson('/api/driver-mbti', {}, 'driver-mbti')}>
              기사 벡터 생성
            </Button>
            <Button
              tone="orange"
              disabled={!serviceDate || running != null}
              onClick={() => runJson('/api/matching', { call_date: serviceDate }, 'matching')}
            >
              매칭 계산
            </Button>
          </div>
          <div style={{ marginTop: 18 }}>
            <FilePicker label="앱미터 엑셀" file={meterFile} onChange={setMeterFile} />
            <div style={{ marginTop: 10 }}>
              <Button
                tone="orange"
                disabled={!meterFile || running != null}
                onClick={() => {
                  if (!meterFile) return
                  const form = new FormData()
                  form.append('file', meterFile)
                  postForm('/api/meter-excel', form, 'meter')
                }}
              >
                앱미터데이터 적재
              </Button>
            </div>
          </div>
          {running && <p style={{ marginTop: 14, color: C.cyan, fontWeight: 700 }}>실행 중: {running}</p>}
          {result && (
            <pre style={{ marginTop: 14, maxHeight: 180, overflow: 'auto', color: result.error ? C.red : C.green, background: '#08101E', border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, fontSize: 14 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Supabase 저장 상태" desc="오류와 누락은 읽기 전용 상태 진단입니다." />
          <div style={{ display: 'grid', gap: 8 }}>
            {stats.map((s) => (
              <div key={s.table} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{s.label}</div>
                  <div style={{ color: C.muted, fontSize: 14 }}>{s.table}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: s.error ? C.red : C.text, fontWeight: 850 }}>{s.error ? '오류' : fmt(s.count)}</div>
                  {s.error && <div style={{ maxWidth: 180, color: C.red, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.error}</div>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'rgba(245,158,11,.08)', border: `1px solid rgba(245,158,11,.25)`, color: C.yellow, fontSize: 14, lineHeight: 1.5 }}>
            실시간 기사 위치, 온라인 상태, 공차 상태는 아직 원천 테이블이 없습니다. 매칭 시뮬레이션에서는 별도 표시된 시뮬레이션 값을 사용합니다.
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














