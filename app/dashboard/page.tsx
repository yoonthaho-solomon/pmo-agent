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

const CARD = 'bg-[#111118] border border-[#1e1e2d] rounded-xl'

const TOOLTIP_STYLE = {
  contentStyle: { background: '#16161f', border: '1px solid #2e2e4d', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#e5e7eb' },
  itemStyle: { color: '#d1d5db' },
}

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

  const dash = (v: string | null) =>
    loading ? <span className="text-gray-700">…</span> : (v ?? <span className="text-gray-700">—</span>)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 적재 기간 — col-span-2 on large */}
      <div className={`${CARD} px-4 py-3 col-span-2 sm:col-span-3 lg:col-span-2`}>
        <p className="text-xs text-gray-500 mb-1">적재 기간</p>
        <p className="text-sm font-semibold text-gray-200 tabular-nums">
          {loading
            ? <span className="text-gray-700">…</span>
            : (s.minDate && s.maxDate
                ? <>{s.minDate} <span className="text-gray-600">~</span> {s.maxDate}</>
                : <span className="text-gray-700">—</span>)
          }
        </p>
      </div>

      <StatCell label="총 적재 일수" loading={loading}
        value={s.totalDays != null ? `${s.totalDays.toLocaleString()}일` : null} />
      <StatCell label="총 기사 수" loading={loading}
        value={s.driverCount != null ? `${s.driverCount.toLocaleString()}명` : null} accent />
      <StatCell label="총 콜 수" loading={loading}
        value={s.callCount != null ? `${s.callCount.toLocaleString()}건` : null} accent />
      <StatCell label="평균 reliability" loading={loading}
        value={s.avgReliability != null ? pct(s.avgReliability) : null} />
      <StatCell label="마지막 실행" loading={loading}
        value={s.lastRun} mono />
    </div>
  )
}

function StatCell({
  label, value, loading, accent, mono,
}: {
  label: string
  value: string | null
  loading: boolean
  accent?: boolean
  mono?: boolean
}) {
  return (
    <div className={`${CARD} px-4 py-3`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-base font-semibold ${mono ? 'font-mono text-sm' : ''} ${accent ? 'text-indigo-300' : 'text-gray-200'}`}>
        {loading
          ? <span className="text-gray-700">…</span>
          : (value ?? <span className="text-gray-700">—</span>)
        }
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
        .gte('service_date', cutoffStr(30))
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-100">KPI 추이</h2>
        <div className="flex gap-1.5">
          {ASP_OPTS.map(o => (
            <button key={o.value} onClick={() => setAsp(o.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                asp === o.value ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >{o.label}</button>
          ))}
        </div>
      </div>

      <div className={`${CARD} p-6`}>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-gray-600 text-sm">불러오는 중…</div>
        ) : chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-600 text-sm">데이터가 없습니다</div>
        ) : (
          <div className="space-y-8">
            <div>
              <p className="text-xs text-gray-500 mb-3">성공률 · EXPIRED율 (%)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                  <Line type="monotone" dataKey="success_rate" name="수락률" stroke="#22d3ee" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expired_rate" name="EXPIRED율" stroke="#f87171" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-3">호출수</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="total_calls" name="호출수" stroke="#a78bfa" strokeWidth={2} dot={false} />
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

  return (
    <section>
      <h2 className="font-semibold text-gray-100 mb-4">기사 MBTI 검색</h2>
      <div className={`${CARD} p-6`}>
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="driver_id 검색"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
          <select
            value={aspFilter}
            onChange={e => setAspFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">ASP 전체</option>
            {ASP_OPTS.slice(1).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={search}
            disabled={loading || (!query && !aspFilter)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? '검색 중…' : '검색'}
          </button>
        </div>

        {searched && !loading && drivers.length === 0 && (
          <p className="text-center text-gray-600 text-sm py-8">검색 결과가 없습니다</p>
        )}

        {drivers.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {drivers.map(d => {
              const { timeLabel, distLabel, prefArea } = driverSummary(d)
              const rates = acceptRates.get(d.driver_id)
              return (
                <div key={d.driver_id} className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-mono font-medium text-gray-200">{d.driver_id}</p>
                      <p className="text-xs text-gray-500 mt-0.5">ASP {d.asp_id}</p>
                    </div>
                    <span className="text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full">
                      신뢰도 {pct(d.reliability)}
                    </span>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0">
                      <RadarChart width={150} height={150} data={toRadarData(d)} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
                        <PolarGrid stroke="#2e2e4d" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 9 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={1.5} />
                      </RadarChart>
                    </div>

                    <div className="flex-1 space-y-2 text-xs pt-1">
                      <div>
                        <span className="text-gray-500">유형  </span>
                        <span className="text-gray-200">{timeLabel} · {distLabel} 선호</span>
                      </div>
                      <div>
                        <span className="text-gray-500">선호지역 </span>
                        <span className="text-gray-300 font-mono text-[11px]">{prefArea}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">데이터 </span>
                        <span className="text-gray-300">{d.data_days}일치</span>
                      </div>
                      <div className="border-t border-gray-800 pt-2 mt-1 space-y-1">
                        <p className="text-gray-500 mb-1">수락률</p>
                        <div className="flex gap-4">
                          <span>
                            <span className="text-gray-600">7일 </span>
                            <span className={rates?.rate7 != null ? 'text-cyan-400 font-medium' : 'text-gray-700'}>
                              {rates?.rate7 != null ? pct(rates.rate7) : '—'}
                            </span>
                          </span>
                          <span>
                            <span className="text-gray-600">30일 </span>
                            <span className={rates?.rate30 != null ? 'text-cyan-400 font-medium' : 'text-gray-700'}>
                              {rates?.rate30 != null ? pct(rates.rate30) : '—'}
                            </span>
                          </span>
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

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500'
  const labelCls = 'block text-xs text-gray-500 mb-1'

  return (
    <section>
      <h2 className="font-semibold text-gray-100 mb-4">매칭 시뮬레이터</h2>
      <div className={`${CARD} p-6`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-5">
          <div>
            <label className={labelCls}>ASP ID *</label>
            <input type="number" value={form.asp_id} onChange={e => setField('asp_id', e.target.value)} placeholder="137" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>출발 헥사곤</label>
            <input type="text" value={form.s_hexagon} onChange={e => setField('s_hexagon', e.target.value)} placeholder="hex_id" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>도착 헥사곤</label>
            <input type="text" value={form.d_hexagon} onChange={e => setField('d_hexagon', e.target.value)} placeholder="hex_id" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>시간대 (0–23)</label>
            <input type="number" min={0} max={23} value={form.hour_slot} onChange={e => setField('hour_slot', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>요일</label>
            <select value={form.weekday} onChange={e => setField('weekday', e.target.value)} className={inputCls}>
              {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}요일</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>예상 거리 (m)</label>
            <input type="number" value={form.expected_distance} onChange={e => setField('expected_distance', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>예상 요금 (원)</label>
            <input type="number" value={form.expected_fare} onChange={e => setField('expected_fare', e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-5 items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_paid} onChange={e => setField('is_paid', e.target.checked)} className="w-4 h-4 accent-indigo-500" />
              <span className="text-sm text-gray-300">유료콜</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_surge} onChange={e => setField('is_surge', e.target.checked)} className="w-4 h-4 accent-indigo-500" />
              <span className="text-sm text-gray-300">탄력요금</span>
            </label>
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-colors"
        >
          {loading ? '추천 중…' : '추천 기사 조회'}
        </button>

        {error && (
          <p className="mt-3 text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
        )}

        {result && (
          <div className="mt-6">
            <p className="text-xs text-gray-500 mb-3">
              기사 풀 <span className="text-gray-300">{result.driver_pool_size.toLocaleString()}명</span> 중 TOP 10
            </p>
            <div className="space-y-1.5">
              {result.recommended_drivers.map(d => (
                <div key={d.driver_id} className="flex items-center gap-3 bg-gray-900/80 hover:bg-gray-900 rounded-lg px-4 py-3 transition-colors">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    d.rank <= 3 ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {d.rank}
                  </span>
                  <span className="font-mono text-sm text-gray-200 w-40 truncate">{d.driver_id}</span>
                  <span className="text-xs text-indigo-300 w-12 text-right">{(d.cosine_score * 100).toFixed(1)}%</span>
                  <span className="text-xs text-gray-500 flex-1 truncate">{d.match_reason}</span>
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
      <h2 className="font-semibold text-gray-100 mb-4">실행 로그</h2>
      <div className={`${CARD} overflow-hidden`}>
        {loading ? (
          <div className="h-32 flex items-center justify-center text-gray-600 text-sm">불러오는 중…</div>
        ) : logs.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-gray-600 text-sm">로그가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2d]">
                  {['날짜', '에이전트', '처리 행수', '상태', '소요시간'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} className="border-b border-[#16161e] hover:bg-gray-900/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">{log.run_date}</td>
                    <td className="px-4 py-3 text-xs text-gray-300 whitespace-nowrap">{log.agent_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 text-right tabular-nums">{log.input_rows.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                        log.status === 'success'
                          ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-900/60'
                          : 'bg-red-900/40 text-red-400 border border-red-900/60'
                      }`}>
                        {log.status === 'success' ? '성공' : '실패'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{secFmt(log.duration_ms)}</td>
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
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      <div className="border-b border-[#1e1e2d] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-200 transition-colors">
            ← 일일 대시보드
          </Link>
          <span className="text-gray-800">|</span>
          <h1 className="text-sm font-semibold text-gray-200">누적 분석 대시보드</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        <StatusBar />
        <KpiSection />
        <MbtiSection />
        <SimulatorSection />
        <LogsSection />
      </div>
    </div>
  )
}
