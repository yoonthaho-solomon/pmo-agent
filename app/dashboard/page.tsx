'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotRow {
  service_date: string
  asp_id: number
  total_calls: number
  expired_count: number
  success_rate: number
}

interface DriverMbtiRow {
  driver_id: string
  asp_id: number
  score_dawn: number
  score_morning: number
  score_daytime: number
  score_night: number
  score_short: number
  score_medium: number
  score_long: number
  score_low_fare: number
  score_mid_fare: number
  score_high_fare: number
  score_paid: number
  score_surge: number
  score_near: number
  pref_s_hexagons: string[]
  pref_d_hexagons: string[]
  data_days: number
  reliability: number
}

interface AcceptRates {
  rate7: number | null
  rate30: number | null
}

interface AgentLogRow {
  run_date: string
  agent_name: string
  input_rows: number
  status: 'success' | 'failed'
  duration_ms: number
  error_msg: string | null
}

interface RecommendedDriver {
  driver_id: string
  cosine_score: number
  rank: number
  match_reason: string
}

// ─── Design System ────────────────────────────────────────────────────────────

const C = {
  bg: '#0b0b0f',
  bgCard: '#13131a',
  border: '#2a2a30',
  borderHover: '#3a3a40',
  cyan: '#8eeaff',
  red: '#e8271e',
  yellow: '#ffa602',
  green: '#00c49a',
  text: '#e5e7eb',
  sub: '#9ca3af',
  muted: '#888',
}

const CARD: React.CSSProperties = {
  background: C.bgCard,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'rgba(19,19,26,0.98)',
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    fontSize: 13,
  },
  labelStyle: { color: C.text, fontWeight: 700 },
  itemStyle: { color: C.sub },
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASP_OPTS = [
  { label: '전체', value: 0 },
  { label: '인천 137', value: 137 },
  { label: '천안 147', value: 147 },
  { label: '부산 160', value: 160 },
]

const RADAR_DIMS: { label: string; key: keyof DriverMbtiRow }[] = [
  { label: '새벽',     key: 'score_dawn' },
  { label: '오전',     key: 'score_morning' },
  { label: '낮',       key: 'score_daytime' },
  { label: '야간',     key: 'score_night' },
  { label: '단거리',   key: 'score_short' },
  { label: '중거리',   key: 'score_medium' },
  { label: '장거리',   key: 'score_long' },
  { label: '저요금',   key: 'score_low_fare' },
  { label: '중요금',   key: 'score_mid_fare' },
  { label: '고요금',   key: 'score_high_fare' },
  { label: '유료콜',   key: 'score_paid' },
  { label: '탄력요금', key: 'score_surge' },
  { label: '배차근접', key: 'score_near' },
]

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number) { return `${(v * 100).toFixed(1)}%` }
function secFmt(ms: number) { return `${(ms / 1000).toFixed(1)}s` }

function cutoffStr(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function dateDiffDays(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1
}

function driverSummary(d: DriverMbtiRow) {
  const timeLabel = (
    [['새벽형', d.score_dawn], ['오전형', d.score_morning], ['낮형', d.score_daytime], ['야간형', d.score_night]] as [string, number][]
  ).sort((a, b) => b[1] - a[1])[0][0]

  const distLabel = (
    [['단거리', d.score_short], ['중거리', d.score_medium], ['장거리', d.score_long]] as [string, number][]
  ).sort((a, b) => b[1] - a[1])[0][0]

  const prefArea = d.pref_s_hexagons?.slice(0, 2).join(', ') || '—'
  return { timeLabel, distLabel, prefArea }
}

function toRadarData(d: DriverMbtiRow) {
  return RADAR_DIMS.map(dim => ({
    subject: dim.label,
    value: parseFloat(((d[dim.key] as number) * 100).toFixed(1)),
    fullMark: 100,
  }))
}

// ─── Shared Components ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', marginBottom: 20 }}>
      {children}
    </h2>
  )
}

function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: color ?? C.muted, marginBottom: 12 }}>
      {children}
    </p>
  )
}

// ─── Section 0: 데이터 현황 ───────────────────────────────────────────────────

function StatusBar() {
  const [s, setS] = useState<{
    minDate: string | null
    maxDate: string | null
    totalDays: number | null
    driverCount: number | null
    callCount: number | null
    avgReliability: number | null
    lastRun: string | null
  }>({
    minDate: null, maxDate: null, totalDays: null,
    driverCount: null, callCount: null, avgReliability: null, lastRun: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [minRes, maxRes, driverRes, callRes, reliRes, logRes] = await Promise.all([
        supabase.from('driver_daily_logs').select('service_date').order('service_date', { ascending: true }).limit(1),
        supabase.from('driver_daily_logs').select('service_date').order('service_date', { ascending: false }).limit(1),
        supabase.from('driver_mbti').select('*', { count: 'exact', head: true }),
        supabase.from('callcard_mbti').select('*', { count: 'exact', head: true }),
        supabase.from('driver_mbti').select('reliability'),
        supabase.from('agent_logs').select('run_date').order('run_date', { ascending: false }).limit(1),
      ])

      const minDate = (minRes.data as { service_date: string }[] | null)?.[0]?.service_date ?? null
      const maxDate = (maxRes.data as { service_date: string }[] | null)?.[0]?.service_date ?? null
      const totalDays = minDate && maxDate ? dateDiffDays(minDate, maxDate) : null

      const rels = (reliRes.data as { reliability: number }[] | null) ?? []
      const avgReliability = rels.length > 0
        ? rels.reduce((s, r) => s + r.reliability, 0) / rels.length
        : null

      setS({
        minDate,
        maxDate,
        totalDays,
        driverCount: driverRes.count,
        callCount: callRes.count,
        avgReliability,
        lastRun: (logRes.data as { run_date: string }[] | null)?.[0]?.run_date ?? null,
      })
      setLoading(false)
    })()
  }, [])

  const val = (v: string | null) => loading ? '…' : (v ?? '—')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
      <div style={{ ...CARD, padding: '32px 36px', gridColumn: 'span 2' }}>
        <Label color={C.cyan}>적재 기간</Label>
        <p style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
          {loading ? '…' : (s.minDate && s.maxDate
            ? <>{s.minDate} <span style={{ color: C.muted }}>~</span> {s.maxDate}</>
            : '—'
          )}
        </p>
      </div>

      <BigStatCard label="총 적재 일수" value={s.totalDays != null ? s.totalDays.toLocaleString() : null} unit="일" loading={loading} color={C.cyan} />
      <BigStatCard label="총 기사 수" value={s.driverCount != null ? s.driverCount.toLocaleString() : null} unit="명" loading={loading} color={C.yellow} />
      <BigStatCard label="총 콜 수" value={s.callCount != null ? s.callCount.toLocaleString() : null} unit="건" loading={loading} color={C.green} />
      <BigStatCard label="마지막 실행" value={val(s.lastRun)} loading={false} color={C.sub} small />
    </div>
  )
}

function BigStatCard({
  label, value, unit, loading, color, small,
}: {
  label: string
  value: string | null
  unit?: string
  loading: boolean
  color: string
  small?: boolean
}) {
  return (
    <div style={{ ...CARD, padding: '32px 36px' }}>
      <Label>{label}</Label>
      <p style={{
        fontSize: small ? 18 : 52,
        fontWeight: 800,
        color: loading || !value ? C.muted : color,
        letterSpacing: small ? '-0.01em' : '-0.05em',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {loading ? '…' : (value ?? '—')}
        {!loading && value && unit && (
          <span style={{ fontSize: small ? 14 : 22, fontWeight: 600, color: C.sub, marginLeft: 6 }}>{unit}</span>
        )}
      </p>
    </div>
  )
}

// ─── Section 1: KPI 추이 ─────────────────────────────────────────────────────

function KpiSection() {
  const [asp, setAsp] = useState(0)
  const [rows, setRows] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      let q = supabase
        .from('daily_snapshots')
        .select('service_date, asp_id, total_calls, expired_count, success_rate')
        .gte('service_date', '2026-05-23')
        .order('service_date', { ascending: true })
      if (asp !== 0) q = q.eq('asp_id', asp)
      const { data } = await q
      setRows((data ?? []) as SnapshotRow[])
      setLoading(false)
    })()
  }, [asp])

  const chartData = (() => {
    const byDate = new Map<string, { calls: number; successWt: number; expiredWt: number }>()
    for (const r of rows) {
      const e = byDate.get(r.service_date) ?? { calls: 0, successWt: 0, expiredWt: 0 }
      const expRate = r.total_calls > 0 ? r.expired_count / r.total_calls : 0
      e.calls += r.total_calls
      e.successWt += r.success_rate * r.total_calls
      e.expiredWt += expRate * r.total_calls
      byDate.set(r.service_date, e)
    }
    return [...byDate.entries()].map(([date, e]) => ({
      date: date.slice(5),
      success_rate: e.calls > 0 ? +((e.successWt / e.calls) * 100).toFixed(1) : 0,
      expired_rate: e.calls > 0 ? +((e.expiredWt / e.calls) * 100).toFixed(1) : 0,
      total_calls: e.calls,
    }))
  })()

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <SectionTitle>KPI 추이</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          {ASP_OPTS.map(o => (
            <button
              key={o.value}
              onClick={() => setAsp(o.value)}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 200ms',
                border: asp === o.value ? `1px solid rgba(142,234,255,0.5)` : `1px solid ${C.border}`,
                background: asp === o.value ? 'rgba(142,234,255,0.12)' : 'transparent',
                color: asp === o.value ? C.cyan : C.sub,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...CARD, padding: '36px 40px' }}>
        {loading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 15 }}>불러오는 중…</div>
        ) : chartData.length === 0 ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 15 }}>데이터가 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 20 }}>
                수락률 · EXPIRED율 (%)
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,42,48,0.6)" />
                  <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 12 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 12 }} unit="%" domain={[0, 100]} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 13, color: C.sub }} />
                  <Line type="monotone" dataKey="success_rate" name="수락률" stroke={C.cyan} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="expired_rate" name="EXPIRED율" stroke={C.red} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 20 }}>
                호출수
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,42,48,0.6)" />
                  <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 12 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 12 }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="total_calls" name="호출수" stroke={C.yellow} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Section 2: 기사 MBTI 검색 ────────────────────────────────────────────────

function MbtiSection() {
  const [query, setQuery] = useState('')
  const [aspFilter, setAspFilter] = useState<number | ''>('')
  const [drivers, setDrivers] = useState<DriverMbtiRow[]>([])
  const [acceptRates, setAcceptRates] = useState<Map<string, AcceptRates>>(new Map())
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function search() {
    if (!query && !aspFilter) return
    setLoading(true)
    setSearched(true)
    setDrivers([])
    setAcceptRates(new Map())

    let q = supabase.from('driver_mbti').select('*')
    if (query) q = q.ilike('driver_id', `%${query}%`)
    if (aspFilter) q = q.eq('asp_id', aspFilter)
    const { data } = await q.limit(10)
    const results = (data ?? []) as DriverMbtiRow[]
    setDrivers(results)

    if (results.length > 0) {
      const ids = results.map(r => r.driver_id)
      const { data: logs } = await supabase
        .from('driver_daily_logs')
        .select('driver_id, service_date, total_accepted, total_received')
        .in('driver_id', ids)
        .gte('service_date', cutoffStr(30))

      const d7 = cutoffStr(7)
      const agg = new Map<string, { a7: number; r7: number; a30: number; r30: number }>()
      for (const log of (logs ?? []) as { driver_id: string; service_date: string; total_accepted: number; total_received: number }[]) {
        const e = agg.get(log.driver_id) ?? { a7: 0, r7: 0, a30: 0, r30: 0 }
        e.a30 += log.total_accepted
        e.r30 += log.total_received
        if (log.service_date >= d7) { e.a7 += log.total_accepted; e.r7 += log.total_received }
        agg.set(log.driver_id, e)
      }

      const rates = new Map<string, AcceptRates>()
      for (const [id, e] of agg.entries()) {
        rates.set(id, {
          rate7: e.r7 > 0 ? e.a7 / e.r7 : null,
          rate30: e.r30 > 0 ? e.a30 / e.r30 : null,
        })
      }
      setAcceptRates(rates)
    }

    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 14,
    color: C.text,
    outline: 'none',
    width: '100%',
  }

  return (
    <section>
      <SectionTitle>기사 MBTI 검색</SectionTitle>
      <div style={{ ...CARD, padding: '36px 40px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <input
            type="text"
            placeholder="driver_id 검색"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <select
            value={aspFilter}
            onChange={e => setAspFilter(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ ...inputStyle, width: 140 }}
          >
            <option value="">ASP 전체</option>
            {ASP_OPTS.slice(1).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={search}
            disabled={loading || (!query && !aspFilter)}
            style={{
              padding: '12px 28px',
              background: loading || (!query && !aspFilter) ? C.bgCard : C.cyan,
              color: loading || (!query && !aspFilter) ? C.muted : '#0b0b0f',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 10,
              border: `1px solid ${loading || (!query && !aspFilter) ? C.border : C.cyan}`,
              cursor: loading || (!query && !aspFilter) ? 'not-allowed' : 'pointer',
              opacity: loading || (!query && !aspFilter) ? 0.5 : 1,
              whiteSpace: 'nowrap',
              transition: 'all 200ms',
            }}
          >
            {loading ? '검색 중…' : '검색'}
          </button>
        </div>

        {searched && !loading && drivers.length === 0 && (
          <p style={{ textAlign: 'center', color: C.muted, fontSize: 15, padding: '32px 0' }}>검색 결과가 없습니다</p>
        )}

        {drivers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
            {drivers.map(d => {
              const { timeLabel, distLabel, prefArea } = driverSummary(d)
              const rates = acceptRates.get(d.driver_id)
              return (
                <div key={d.driver_id} style={{
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '24px 28px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: C.text }}>{d.driver_id}</p>
                      <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>ASP {d.asp_id}</p>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      background: 'rgba(142,234,255,0.1)',
                      color: C.cyan,
                      border: `1px solid rgba(142,234,255,0.25)`,
                      borderRadius: 20,
                      padding: '4px 12px',
                    }}>
                      신뢰도 {pct(d.reliability)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0 }}>
                      <RadarChart width={160} height={160} data={toRadarData(d)} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <PolarGrid stroke={C.border} />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: C.muted, fontSize: 9 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar dataKey="value" stroke={C.cyan} fill={C.cyan} fillOpacity={0.15} strokeWidth={1.5} />
                      </RadarChart>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
                      <div>
                        <span style={{ fontSize: 12, color: C.muted }}>유형 </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{timeLabel} · {distLabel} 선호</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, color: C.muted }}>선호지역 </span>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.sub }}>{prefArea}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, color: C.muted }}>데이터 </span>
                        <span style={{ fontSize: 13, color: C.sub }}>{d.data_days}일치</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 4 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>수락률</p>
                        <div style={{ display: 'flex', gap: 24 }}>
                          <div>
                            <span style={{ fontSize: 12, color: C.muted }}>7일 </span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: rates?.rate7 != null ? C.cyan : C.muted }}>
                              {rates?.rate7 != null ? pct(rates.rate7) : '—'}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: 12, color: C.muted }}>30일 </span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: rates?.rate30 != null ? C.cyan : C.muted }}>
                              {rates?.rate30 != null ? pct(rates.rate30) : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Section 3: 매칭 시뮬레이터 ───────────────────────────────────────────────

function SimulatorSection() {
  const [form, setForm] = useState({
    asp_id: '',
    s_hexagon: '',
    d_hexagon: '',
    hour_slot: '12',
    weekday: '0',
    expected_distance: '5000',
    expected_fare: '15000',
    is_paid: false,
    is_surge: false,
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ driver_pool_size: number; recommended_drivers: RecommendedDriver[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function setField(k: string, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function run() {
    if (!form.asp_id) { setError('asp_id를 입력하세요'); return }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asp_id: Number(form.asp_id),
          s_hexagon: form.s_hexagon,
          d_hexagon: form.d_hexagon,
          hour_slot: Number(form.hour_slot),
          weekday: Number(form.weekday),
          expected_distance: Number(form.expected_distance),
          expected_fare: Number(form.expected_fare),
          is_paid: form.is_paid,
          is_surge: form.is_surge,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '오류 발생'); return }
      setResult(json)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 14,
    color: C.text,
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 8,
  }

  return (
    <section>
      <SectionTitle>매칭 시뮬레이터</SectionTitle>
      <div style={{ ...CARD, padding: '36px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 28 }}>
          <div>
            <label style={labelStyle}>ASP ID *</label>
            <input type="number" value={form.asp_id} onChange={e => setField('asp_id', e.target.value)} placeholder="137" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>출발 헥사곤</label>
            <input type="text" value={form.s_hexagon} onChange={e => setField('s_hexagon', e.target.value)} placeholder="hex_id" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>도착 헥사곤</label>
            <input type="text" value={form.d_hexagon} onChange={e => setField('d_hexagon', e.target.value)} placeholder="hex_id" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>시간대 (0–23)</label>
            <input type="number" min={0} max={23} value={form.hour_slot} onChange={e => setField('hour_slot', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>요일</label>
            <select value={form.weekday} onChange={e => setField('weekday', e.target.value)} style={inputStyle}>
              {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}요일</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>예상 거리 (m)</label>
            <input type="number" value={form.expected_distance} onChange={e => setField('expected_distance', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>예상 요금 (원)</label>
            <input type="number" value={form.expected_fare} onChange={e => setField('expected_fare', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', paddingBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_paid} onChange={e => setField('is_paid', e.target.checked)} style={{ width: 16, height: 16, accentColor: C.cyan }} />
              <span style={{ fontSize: 14, color: C.sub }}>유료콜</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_surge} onChange={e => setField('is_surge', e.target.checked)} style={{ width: 16, height: 16, accentColor: C.cyan }} />
              <span style={{ fontSize: 14, color: C.sub }}>탄력요금</span>
            </label>
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            background: loading ? C.bgCard : C.green,
            color: loading ? C.muted : '#0b0b0f',
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 12,
            border: loading ? `1px solid ${C.border}` : `1px solid ${C.green}`,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 200ms',
          }}
        >
          {loading ? '추천 중…' : '추천 기사 조회'}
        </button>

        {error && (
          <p style={{ marginTop: 16, fontSize: 13, color: C.red, background: 'rgba(232,39,30,0.08)', border: `1px solid rgba(232,39,30,0.25)`, borderRadius: 10, padding: '12px 16px' }}>
            {error}
          </p>
        )}

        {result && (
          <div style={{ marginTop: 28 }}>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
              기사 풀 <span style={{ color: C.text, fontWeight: 700 }}>{result.driver_pool_size.toLocaleString()}명</span> 중 TOP 10
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.recommended_drivers.map(d => (
                <div key={d.driver_id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '14px 20px',
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, flexShrink: 0,
                    background: d.rank <= 3 ? 'rgba(255,166,2,0.2)' : 'rgba(42,42,48,0.5)',
                    color: d.rank <= 3 ? C.yellow : C.muted,
                    border: `1px solid ${d.rank <= 3 ? 'rgba(255,166,2,0.35)' : C.border}`,
                  }}>
                    {d.rank}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, color: C.text, width: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.driver_id}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.cyan, width: 52, textAlign: 'right' }}>{(d.cosine_score * 100).toFixed(1)}%</span>
                  <span style={{ fontSize: 13, color: C.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.match_reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Section 4: 실행 로그 ─────────────────────────────────────────────────────

function LogsSection() {
  const [logs, setLogs] = useState<AgentLogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('agent_logs')
        .select('run_date, agent_name, input_rows, status, duration_ms, error_msg')
        .order('run_date', { ascending: false })
        .limit(20)
      setLogs((data ?? []) as AgentLogRow[])
      setLoading(false)
    })()
  }, [])

  return (
    <section>
      <SectionTitle>실행 로그</SectionTitle>
      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 15 }}>불러오는 중…</div>
        ) : logs.length === 0 ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 15 }}>로그가 없습니다</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['날짜', '에이전트', '처리 행수', '상태', '소요시간'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: C.muted,
                      padding: '20px 24px',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '16px 24px', fontSize: 13, fontFamily: 'monospace', color: C.sub, whiteSpace: 'nowrap' }}>{log.run_date}</td>
                    <td style={{ padding: '16px 24px', fontSize: 13, color: C.text, whiteSpace: 'nowrap', fontWeight: 600 }}>{log.agent_name}</td>
                    <td style={{ padding: '16px 24px', fontSize: 13, color: C.sub, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{log.input_rows.toLocaleString()}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: 20,
                        whiteSpace: 'nowrap',
                        background: log.status === 'success' ? 'rgba(0,196,154,0.12)' : 'rgba(232,39,30,0.12)',
                        color: log.status === 'success' ? C.green : C.red,
                        border: `1px solid ${log.status === 'success' ? 'rgba(0,196,154,0.3)' : 'rgba(232,39,30,0.3)'}`,
                      }}>
                        {log.status === 'success' ? '성공' : '실패'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: 13, color: C.sub, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{secFmt(log.duration_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0b0b0f; font-family: 'Pretendard', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        input, select, button, textarea { font-family: inherit; }
        input::placeholder { color: #888; }
        select option { background: #13131a; color: #e5e7eb; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: C.bg,
          borderBottom: `1px solid ${C.border}`,
          padding: '0 40px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <Link href="/" style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.sub,
            textDecoration: 'none',
            background: 'transparent',
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '5px 12px',
            transition: 'all 200ms',
            whiteSpace: 'nowrap',
          }}
            onMouseOver={e => { (e.target as HTMLElement).style.color = C.text; (e.target as HTMLElement).style.borderColor = C.borderHover }}
            onMouseOut={e => { (e.target as HTMLElement).style.color = C.sub; (e.target as HTMLElement).style.borderColor = C.border }}
          >
            ← 일일 대시보드
          </Link>
          <div style={{ width: 1, height: 18, background: C.border }} />
          <h1 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>
            누적 분석 대시보드
          </h1>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 40px', display: 'flex', flexDirection: 'column', gap: 48 }}>
          <StatusBar />
          <KpiSection />
          <MbtiSection />
          <SimulatorSection />
          <LogsSection />
        </div>
      </div>
    </>
  )
}
