'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'preview-build-key'
)

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

type MeterStatusResponse = {
  tables?: TableStatus[]
  dateCounts?: { date: string; hourly: number | null; driver: number | null }[]
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

function fmt(n: number | null | undefined) {
  return n == null ? '-' : n.toLocaleString()
}

function range(row?: TableStatus) {
  if (!row?.minDate || !row?.maxDate) return '-'
  return `${row.minDate} ~ ${row.maxDate}`
}

function dayCount(start?: string | null, end?: string | null) {
  if (!start || !end) return '-'
  const diff = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()
  return `${Math.max(0, Math.round(diff / 86400000) + 1)}일`
}

function recentDates(maxDate: string | null | undefined, count = 14) {
  if (!maxDate) return []
  const base = new Date(`${maxDate}T00:00:00`)
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(base)
    d.setDate(base.getDate() - (count - 1 - index))
    return d.toISOString().slice(0, 10)
  })
}

async function tableStatus(table: string, label: string, dateColumn: string): Promise<TableStatus> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) return { table, label, count: null, minDate: null, maxDate: null, error: error.message }
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

export default function IngestPage() {
  const [loading, setLoading] = useState(true)
  const [callTables, setCallTables] = useState<TableStatus[]>([])
  const [meterTables, setMeterTables] = useState<TableStatus[]>([])
  const [dateRows, setDateRows] = useState<DateRow[]>([])
  const [meterDates, setMeterDates] = useState<MeterStatusResponse['dateCounts']>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const calls = await Promise.all([
        tableStatus('callcard_mbti', '호출데이터 / 콜카드', 'call_date'),
        tableStatus('driver_daily_logs', '기사 호출 로그', 'service_date'),
        tableStatus('matching_scores', '매칭 Top 10 결과', 'match_date'),
      ])
      const rows = await Promise.all(recentDates(calls[0].maxDate).map(async (date) => ({
        date,
        callcards: await countByDate('callcard_mbti', 'call_date', date),
        driverLogs: await countByDate('driver_daily_logs', 'service_date', date),
        matches: await countByDate('matching_scores', 'match_date', date),
      })))
      const meter = await fetch('/api/meter-status', { cache: 'no-store' }).then((res) => res.json()).catch(() => ({} as MeterStatusResponse))

      if (cancelled) return
      setCallTables(calls)
      setDateRows(rows)
      setMeterTables(meter.tables ?? [])
      setMeterDates(meter.dateCounts ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const callcards = callTables.find((row) => row.table === 'callcard_mbti')
  const driverLogs = callTables.find((row) => row.table === 'driver_daily_logs')
  const matches = callTables.find((row) => row.table === 'matching_scores')
  const meterMain = meterTables.find((row) => row.table === 'meter_hourly_logs') ?? meterTables[0]
  const missingRows = useMemo(() => dateRows.filter((row) => !row.callcards || !row.driverLogs || !row.matches), [dateRows])

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Topbar />
      <KpiRail loading={loading} callcards={callcards} meterMain={meterMain} missing={missingRows.length} />

      <section style={{ position: 'relative', minHeight: 'calc(100vh - 126px)', overflow: 'hidden', borderTop: `1px solid ${C.border}` }}>
        <MapBackdrop />

        <aside style={leftPanel}>
          <PanelTitle kicker="DATA COVERAGE" title="적재 범위" />
          <CoverageCard title="호출데이터" range={range(callcards)} days={dayCount(callcards?.minDate, callcards?.maxDate)} count={fmt(callcards?.count)} color={C.green} />
          <CoverageCard title="기사 로그" range={range(driverLogs)} days={dayCount(driverLogs?.minDate, driverLogs?.maxDate)} count={fmt(driverLogs?.count)} color={C.cyan} />
          <CoverageCard title="앱미터데이터" range={range(meterMain)} days={dayCount(meterMain?.minDate, meterMain?.maxDate)} count={fmt(meterMain?.count)} color={C.purple} />
        </aside>

        <section style={stagePanel}>
          <div style={{ position: 'relative', zIndex: 3 }}>
            <div style={{ color: C.cyan, fontSize: 14, fontWeight: 950, letterSpacing: '.12em' }}>INGESTION RADAR</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 36, lineHeight: 1.08, fontWeight: 950 }}>파일 업로드 화면이 아니라 데이터 준비 상태를 보는 관제 화면</h1>
            <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.55, maxWidth: 760, marginTop: 12 }}>
              폴더 감시 파이프라인이 Supabase에 적재한 결과를 기준으로, AI 우선배차 검증에 필요한 콜카드, 기사 로그, 매칭 결과가 날짜별로 이어져 있는지 확인합니다.
            </p>
          </div>
          <CoverageTimeline rows={dateRows} />
        </section>

        <aside style={rightPanel}>
          <PanelTitle kicker="AUTOMATION" title="폴더 감시 파이프라인" />
          <CommandCard title="호출데이터 자동 적재" command="npm run call:watch" color={C.green} />
          <CommandCard title="앱미터 자동 적재" command="npm run meter:watch" color={C.cyan} />
          <div style={{ marginTop: 14, border: `1px solid ${C.yellow}66`, borderRadius: 16, background: 'rgba(245,158,11,.1)', padding: 16 }}>
            <div style={{ color: C.yellow, fontSize: 15, fontWeight: 950 }}>운영 기준</div>
            <p style={{ color: C.sub, fontSize: 15, lineHeight: 1.55, margin: '8px 0 0' }}>
              앱미터는 기사 MBTI의 주 원천이 아니라 천안 택시 흐름과 시장 기준을 보는 보조 데이터입니다.
            </p>
          </div>
        </aside>

        <BottomDock callTables={callTables} meterDates={meterDates ?? []} />
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
    <header style={{ height: 56, background: '#05070D', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '320px 1fr 260px', alignItems: 'center', padding: '0 18px', gap: 18 }}>
      <Link href="/dashboard" style={{ color: C.ink, textDecoration: 'none', fontSize: 18, fontWeight: 950 }}>
        Happycall PMO <span style={{ color: C.cyan }}>Data Radar</span>
      </Link>
      <nav style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {nav.map(([label, href]) => (
          <Link key={href} href={href} style={{ color: href === '/ingest' ? C.cyan : C.sub, textDecoration: 'none', border: `1px solid ${href === '/ingest' ? C.cyan : C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 900, background: href === '/ingest' ? 'rgba(34,211,238,.12)' : 'rgba(15,22,40,.62)' }}>
            {label}
          </Link>
        ))}
      </nav>
      <div style={{ justifySelf: 'end', display: 'flex', gap: 8 }}>
        <Pill color={C.green}>READ ONLY</Pill>
        <Pill color={C.cyan}>SUPABASE</Pill>
      </div>
    </header>
  )
}

function KpiRail({ loading, callcards, meterMain, missing }: { loading: boolean; callcards?: TableStatus; meterMain?: TableStatus; missing: number }) {
  const items = [
    ['호출데이터', loading ? '로딩 중' : range(callcards), dayCount(callcards?.minDate, callcards?.maxDate), C.green],
    ['앱미터데이터', range(meterMain), meterMain?.label ?? '보조 시장 기준', C.cyan],
    ['콜카드 건수', fmt(callcards?.count), 'callcard_mbti', C.purple],
    ['누락 확인', `${missing}일`, '최근 14일 기준', missing ? C.yellow : C.green],
    ['적재 방식', '폴더 감시', '업로드 버튼 제거 방향', C.orange],
  ]

  return (
    <section style={{ height: 70, background: '#080B13', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: `1px solid ${C.border}` }}>
      {items.map(([label, value, sub, color]) => (
        <div key={label} style={{ borderRight: `1px solid ${C.border}`, padding: '10px 18px' }}>
          <div style={{ color: C.muted, fontSize: 13, fontWeight: 900 }}>{label}</div>
          <div style={{ color: String(color), fontSize: 24, lineHeight: 1.05, fontWeight: 950, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{sub}</div>
        </div>
      ))}
    </section>
  )
}

function CoverageTimeline({ rows }: { rows: DateRow[] }) {
  return (
    <div style={{ position: 'absolute', left: 28, right: 28, bottom: 28, zIndex: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, 1fr)`, gap: 9 }}>
        {rows.map((row) => {
          const ok = Boolean(row.callcards && row.driverLogs && row.matches)
          return (
            <div key={row.date} style={{ minHeight: 170, border: `1px solid ${ok ? C.green : C.yellow}66`, borderRadius: 16, background: ok ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)', padding: 12, display: 'grid', alignContent: 'space-between' }}>
              <div>
                <div style={{ color: ok ? C.green : C.yellow, fontSize: 12, fontWeight: 950 }}>{row.date.slice(5)}</div>
                <div style={{ color: C.ink, fontSize: 18, fontWeight: 950, marginTop: 8 }}>{ok ? '정상' : '확인'}</div>
              </div>
              <div style={{ display: 'grid', gap: 5, color: C.sub, fontSize: 12, fontWeight: 850 }}>
                <span>콜 {fmt(row.callcards)}</span>
                <span>로그 {fmt(row.driverLogs)}</span>
                <span>매칭 {fmt(row.matches)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BottomDock({ callTables, meterDates }: { callTables: TableStatus[]; meterDates: { date: string; hourly: number | null; driver: number | null }[] }) {
  return (
    <section style={{ position: 'absolute', left: 350, right: 350, bottom: 18, minHeight: 112, border: `1px solid ${C.border}`, borderRadius: 18, background: 'linear-gradient(90deg, rgba(9,14,26,.96), rgba(9,14,26,.76))', boxShadow: '0 20px 70px rgba(0,0,0,.32)', zIndex: 8, padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {callTables.map((row) => <Dock key={row.table} title={row.label} value={fmt(row.count)} sub={range(row)} color={C.green} />)}
        {meterDates.slice(-1).map((row) => <Dock key={row.date} title="앱미터 최근일" value={row.date} sub={`시간대 ${fmt(row.hourly)} / 기사 ${fmt(row.driver)}`} color={C.cyan} />)}
      </div>
    </section>
  )
}

function CoverageCard({ title, range, days, count, color }: { title: string; range: string; days: string; count: string; color: string }) {
  return (
    <div style={{ marginTop: 14, border: `1px solid ${color}66`, borderRadius: 16, background: `${color}12`, padding: 16 }}>
      <div style={{ color, fontSize: 16, fontWeight: 950 }}>{title}</div>
      <div style={{ color: C.ink, fontSize: 22, lineHeight: 1.25, fontWeight: 950, marginTop: 10 }}>{range}</div>
      <div style={{ color: C.sub, fontSize: 14, marginTop: 8 }}>{days} · {count}건</div>
    </div>
  )
}

function CommandCard({ title, command, color }: { title: string; command: string; color: string }) {
  return (
    <div style={{ marginTop: 14, border: `1px solid ${color}66`, borderRadius: 16, background: `${color}12`, padding: 16 }}>
      <div style={{ color, fontSize: 16, fontWeight: 950 }}>{title}</div>
      <code style={{ display: 'block', color: C.ink, fontSize: 17, fontWeight: 950, marginTop: 10 }}>{command}</code>
    </div>
  )
}

function Dock({ title, value, sub, color }: { title: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: 'rgba(15,22,40,.88)', padding: 12 }}>
      <div style={{ color: C.muted, fontSize: 12, fontWeight: 850 }}>{title}</div>
      <div style={{ color, fontSize: 20, fontWeight: 950, marginTop: 6 }}>{value}</div>
      <div style={{ color: C.sub, fontSize: 12, marginTop: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
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

function MapBackdrop() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 48%, rgba(34,211,238,.12), transparent 30%), linear-gradient(135deg, #121820, #080B13 68%)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.36, backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
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

