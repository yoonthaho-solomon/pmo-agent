'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type StatusTone = 'good' | 'warn' | 'bad' | 'neutral'

type TableStatus = {
  table: string
  label: string
  count: number | null
  minDate: string | null
  maxDate: string | null
  error?: string
}

type DateRow = {
  date: string
  callcards: number | null
  driverLogs: number | null
  matches: number | null
}

type OutcomeStats = {
  total: number
  accepted: number
  expired: number
  canceled: number
  pickup: number
  other: number
  accept_rate: number
  expired_rate: number
  canceled_rate: number
  problem_rate: number
}

type RiskGroup = OutcomeStats & {
  key: string
  label: string
  adjusted_problem_rate?: number
  sample_confidence?: number
}

type OutcomeResponse = {
  summary?: OutcomeStats
  risk_groups?: RiskGroup[]
  error?: unknown
}

type MeterStatusResponse = {
  tables?: TableStatus[]
  dateCounts?: { date: string; hourly: number | null; driver: number | null }[]
  error?: unknown
}

const C = {
  bg: '#080C18',
  panel: '#0F1628',
  panel2: '#111A2E',
  border: '#1E2D4A',
  border2: '#2D4470',
  text: '#F1F5F9',
  sub: '#A9B7CC',
  muted: '#6C7D99',
  cyan: '#22D3EE',
  blue: '#3B82F6',
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#F43F5E',
  purple: '#8B5CF6',
}

function fmt(n: number | null | undefined) {
  return n == null ? '-' : n.toLocaleString()
}

function pct(n: number | null | undefined) {
  return n == null ? '-' : `${(n * 100).toFixed(1)}%`
}

function toneColor(tone: StatusTone) {
  if (tone === 'good') return C.green
  if (tone === 'warn') return C.yellow
  if (tone === 'bad') return C.red
  return C.text
}

function dateRangeLabel(row?: TableStatus) {
  if (!row?.minDate || !row?.maxDate) return '-'
  return `${row.minDate} ~ ${row.maxDate}`
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
}

function recentDates(maxDate: string | null | undefined, count = 7) {
  if (!maxDate) return []
  const base = new Date(`${maxDate}T00:00:00`)
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(base)
    d.setDate(base.getDate() - (count - 1 - index))
    return d.toISOString().slice(0, 10)
  })
}

async function tableStatus(table: string, label: string, dateColumn?: string): Promise<TableStatus> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) return { table, label, count: null, minDate: null, maxDate: null, error: error.message }

  if (!dateColumn) return { table, label, count: count ?? 0, minDate: null, maxDate: null }

  const [minRes, maxRes] = await Promise.all([
    supabase.from(table).select(dateColumn).order(dateColumn, { ascending: true }).limit(1),
    supabase.from(table).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
  ])

  return {
    table,
    label,
    count: count ?? 0,
    minDate: (minRes.data?.[0] as Record<string, string> | undefined)?.[dateColumn] ?? null,
    maxDate: (maxRes.data?.[0] as Record<string, string> | undefined)?.[dateColumn] ?? null,
    error: minRes.error?.message ?? maxRes.error?.message,
  }
}

async function countByDate(table: string, column: string, date: string) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, date)
  return error ? null : count ?? 0
}

function StatCard({ label, value, caption, tone = 'neutral' }: { label: string; value: string; caption?: string; tone?: StatusTone }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, minHeight: 128 }}>
      <div style={{ color: C.sub, fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>{label}</div>
      <div style={{ color: toneColor(tone), fontSize: 34, fontWeight: 950, marginTop: 12, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {caption && <div style={{ color: C.muted, fontSize: 15, fontWeight: 700, marginTop: 10, lineHeight: 1.4 }}>{caption}</div>}
    </section>
  )
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 24, margin: 0, fontWeight: 950, lineHeight: 1.2 }}>{title}</h2>
        {desc && <p style={{ color: C.sub, fontSize: 17, lineHeight: 1.55, margin: '8px 0 0' }}>{desc}</p>}
      </div>
      {children}
    </section>
  )
}

function LinkButton({ href, children, tone = C.cyan }: { href: string; children: React.ReactNode; tone?: string }) {
  return (
    <Link
      href={href}
      style={{
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${tone}`,
        background: `${tone}1F`,
        color: tone,
        borderRadius: 8,
        padding: '0 16px',
        textDecoration: 'none',
        fontSize: 16,
        fontWeight: 900,
      }}
    >
      {children}
    </Link>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [tables, setTables] = useState<TableStatus[]>([])
  const [dateRows, setDateRows] = useState<DateRow[]>([])
  const [meterTables, setMeterTables] = useState<TableStatus[]>([])
  const [meterDates, setMeterDates] = useState<MeterStatusResponse['dateCounts']>([])
  const [summary, setSummary] = useState<OutcomeStats | null>(null)
  const [hourRisk, setHourRisk] = useState<RiskGroup[]>([])
  const [distanceRisk, setDistanceRisk] = useState<RiskGroup[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const baseTables = await Promise.all([
        tableStatus('callcard_mbti', '호출 원천/콜카드', 'call_date'),
        tableStatus('driver_daily_logs', '기사 호출 로그', 'service_date'),
        tableStatus('driver_mbti', '기사 22D 벡터'),
        tableStatus('matching_scores', '매칭 계산 결과', 'match_date'),
      ])

      const callRange = baseTables.find((item) => item.table === 'callcard_mbti')
      const dates = recentDates(callRange?.maxDate, 7)
      const rows = await Promise.all(dates.map(async (date) => ({
        date,
        callcards: await countByDate('callcard_mbti', 'call_date', date),
        driverLogs: await countByDate('driver_daily_logs', 'service_date', date),
        matches: await countByDate('matching_scores', 'match_date', date),
      })))

      const [meterRes, hourRes, distanceRes] = await Promise.all([
        fetch('/api/meter-status', { cache: 'no-store' }).then((res) => res.json()).catch(() => ({} as MeterStatusResponse)),
        fetch('/api/callcard-outcomes?group_by=hour&limit=5&min_group_total=100', { cache: 'no-store' }).then((res) => res.json()).catch(() => ({} as OutcomeResponse)),
        fetch('/api/callcard-outcomes?group_by=distance&limit=5&min_group_total=100', { cache: 'no-store' }).then((res) => res.json()).catch(() => ({} as OutcomeResponse)),
      ])

      if (cancelled) return
      setTables(baseTables)
      setDateRows(rows)
      setMeterTables(meterRes.tables ?? [])
      setMeterDates(meterRes.dateCounts ?? [])
      setSummary(hourRes.summary ?? null)
      setHourRisk(hourRes.risk_groups ?? [])
      setDistanceRisk(distanceRes.risk_groups ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const callcards = tables.find((item) => item.table === 'callcard_mbti')
  const driverLogs = tables.find((item) => item.table === 'driver_daily_logs')
  const driverMbti = tables.find((item) => item.table === 'driver_mbti')
  const matching = tables.find((item) => item.table === 'matching_scores')
  const loadedDays = useMemo(() => daysBetween(callcards?.minDate ?? '', callcards?.maxDate ?? ''), [callcards])

  const lastDate = callcards?.maxDate ?? '-'
  const lastRow = dateRows[dateRows.length - 1]
  const matchCoverage = lastRow?.callcards && lastRow.callcards > 0 && lastRow.matches != null
    ? Math.min(1, lastRow.matches / Math.max(lastRow.callcards * 10, 1))
    : null

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <header style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(8,12,24,.96)' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '22px 28px', display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ color: C.cyan, fontSize: 16, fontWeight: 950, marginBottom: 6 }}>PMO 운영 대시보드</div>
            <h1 style={{ fontSize: 34, margin: 0, fontWeight: 950, lineHeight: 1.15 }}>호출 수요와 배차 실패 구간을 보는 화면</h1>
            <p style={{ color: C.sub, fontSize: 17, lineHeight: 1.55, margin: '10px 0 0' }}>
              이 화면은 업로드나 매칭 실험을 하지 않습니다. 현재 Supabase에 적재된 범위와 expired/canceled 위험 구간만 요약합니다.
            </p>
          </div>
          <nav style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <LinkButton href="/ingest" tone={C.green}>적재 현황</LinkButton>
            <LinkButton href="/simulator" tone={C.purple}>매칭 시뮬레이터</LinkButton>
          </nav>
        </div>
      </header>

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: 28, display: 'grid', gap: 28 }}>
        {loading && <div style={{ color: C.sub, fontSize: 18, fontWeight: 800 }}>데이터를 불러오는 중입니다.</div>}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
          <StatCard label="호출데이터 적재 범위" value={dateRangeLabel(callcards)} caption={`${loadedDays || '-'}일 범위`} tone="good" />
          <StatCard label="총 콜카드" value={fmt(callcards?.count)} caption={`최근 기준일 ${lastDate}`} />
          <StatCard label="기사 벡터" value={fmt(driverMbti?.count)} caption={`기사 로그 ${fmt(driverLogs?.count)}건`} tone="neutral" />
          <StatCard label="최근일 매칭 커버리지" value={pct(matchCoverage)} caption="콜 1건당 Top 10 저장 기준" tone={matchCoverage == null ? 'neutral' : matchCoverage >= 0.95 ? 'good' : 'warn'} />
        </section>

        <Section title="최근 7일 적재 현황" desc="자동 적재가 제대로 이어지는지 보는 운영 체크입니다. 호출, 기사 로그, 매칭 계산이 같은 날짜 범위로 맞아야 합니다.">
          <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, background: C.panel }}>
              <thead>
                <tr>
                  {['날짜', '콜카드', '기사 로그', '매칭 결과', '상태'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '14px 16px', color: C.sub, fontSize: 16, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dateRows.map((row) => {
                  const ok = Boolean(row.callcards && row.driverLogs && row.matches)
                  return (
                    <tr key={row.date}>
                      <td style={td()}>{row.date}</td>
                      <td style={td(C.cyan)}>{fmt(row.callcards)}</td>
                      <td style={td(C.green)}>{fmt(row.driverLogs)}</td>
                      <td style={td(C.purple)}>{fmt(row.matches)}</td>
                      <td style={td(ok ? C.green : C.yellow)}>{ok ? '정상' : '확인 필요'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Section title="콜 처리 결과" desc="accepted는 기사 수락, expired/canceled는 문제 콜로 봅니다.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <StatCard label="전체 표본" value={fmt(summary?.total)} />
              <StatCard label="수락률" value={pct(summary?.accept_rate)} tone="good" />
              <StatCard label="만료율" value={pct(summary?.expired_rate)} tone={(summary?.expired_rate ?? 0) > 0.25 ? 'bad' : 'neutral'} />
              <StatCard label="문제율" value={pct(summary?.problem_rate)} tone={(summary?.problem_rate ?? 0) > 0.4 ? 'bad' : 'warn'} />
            </div>
          </Section>

          <Section title="앱미터 보조 데이터" desc="기사 MBTI의 주 원천이 아니라 천안 택시 흐름을 보는 시장 기준 데이터입니다.">
            <div style={{ display: 'grid', gap: 10 }}>
              {meterTables.map((row) => (
                <div key={row.table} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1.4fr', gap: 12, alignItems: 'center', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                  <strong style={{ fontSize: 17 }}>{row.label}</strong>
                  <span style={{ color: C.cyan, fontSize: 18, fontWeight: 900 }}>{fmt(row.count)}</span>
                  <span style={{ color: C.sub, fontSize: 16 }}>{dateRangeLabel(row)}</span>
                </div>
              ))}
              {meterDates?.slice(-3).map((row) => (
                <div key={row.date} style={{ color: C.muted, fontSize: 15, lineHeight: 1.45 }}>
                  {row.date}: 시간대 {fmt(row.hourly)}건, 기사별 {fmt(row.driver)}건
                </div>
              ))}
            </div>
          </Section>
        </section>

        <Section title="위험 구간" desc="요청수가 늘어도 기사가 수락하지 않으면 운행완료는 늘지 않습니다. 아래 구간은 AI 우선배차 검증에서 먼저 봐야 할 후보입니다.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <RiskList title="시간대 위험 Top 5" rows={hourRisk} />
            <RiskList title="거리 구간 위험 Top 5" rows={distanceRisk} />
          </div>
        </Section>

        <Section title="화면 역할 정리" desc="헷갈리지 않도록 화면별 역할을 분리했습니다.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
            <RoleCard title="대시보드" desc="호출 수요, 처리 결과, 위험 구간을 보는 운영 현황 화면입니다." active />
            <RoleCard title="적재 현황" desc="폴더 자동 적재 기준으로 날짜별 적재 상태와 누락 여부를 확인합니다." href="/ingest" />
            <RoleCard title="매칭 시뮬레이터" desc="콜카드 22D와 기사 22D의 코사인 유사도, Top 10, 반경 확장을 검증합니다." href="/simulator" />
          </div>
        </Section>
      </div>
    </main>
  )
}

function RiskList({ title, rows }: { title: string; rows: RiskGroup[] }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
      <h3 style={{ fontSize: 20, margin: 0, fontWeight: 950 }}>{title}</h3>
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {rows.length === 0 && <div style={{ color: C.muted, fontSize: 16 }}>표시할 위험 구간이 없습니다.</div>}
        {rows.map((row, index) => {
          const risk = row.adjusted_problem_rate ?? row.problem_rate
          return (
            <div key={`${row.key}-${index}`} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 90px 100px', gap: 12, alignItems: 'center', borderTop: index === 0 ? 'none' : `1px solid ${C.border}`, paddingTop: index === 0 ? 0 : 10 }}>
              <strong style={{ color: index < 3 ? C.yellow : C.sub, fontSize: 18 }}>{index + 1}</strong>
              <span style={{ fontSize: 17, fontWeight: 850 }}>{row.label}</span>
              <span style={{ color: C.red, fontSize: 18, fontWeight: 950 }}>{pct(risk)}</span>
              <span style={{ color: C.sub, fontSize: 15 }}>{fmt(row.total)}건</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RoleCard({ title, desc, href, active }: { title: string; desc: string; href?: string; active?: boolean }) {
  const content = (
    <div style={{ background: active ? '#122039' : C.panel, border: `1px solid ${active ? C.cyan : C.border}`, borderRadius: 8, padding: 18, minHeight: 132 }}>
      <div style={{ color: active ? C.cyan : C.text, fontSize: 20, fontWeight: 950 }}>{title}</div>
      <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.55, margin: '10px 0 0' }}>{desc}</p>
    </div>
  )
  if (!href) return content
  return <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</Link>
}

function td(color = C.text): React.CSSProperties {
  return {
    padding: '14px 16px',
    borderBottom: `1px solid ${C.border}`,
    color,
    fontSize: 16,
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
  }
}
