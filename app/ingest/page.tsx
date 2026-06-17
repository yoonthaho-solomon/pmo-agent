'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

type TableStatus = {
  table: string
  label: string
  count: number | null
  minDate: string | null
  maxDate: string | null
  status?: 'ok' | 'empty' | 'error'
  importance?: 'core' | 'optional'
  error?: string
}

type DateRow = {
  date: string
  callcards: number | null
  driverLogs: number | null
  matches: number | null
}

type SystemStatusResponse = {
  ok?: boolean
  source?: string
  message?: string
  env?: Record<string, boolean>
  callTables?: TableStatus[]
  meterTables?: TableStatus[]
  vectorTables?: TableStatus[]
  dateRows?: DateRow[]
  watchProcesses?: { name: string; command: string; runsInVercel: boolean }[]
  error?: string
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

export default function IngestPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SystemStatusResponse | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [callTables, setCallTables] = useState<TableStatus[]>([])
  const [meterTables, setMeterTables] = useState<TableStatus[]>([])
  const [vectorTables, setVectorTables] = useState<TableStatus[]>([])
  const [dateRows, setDateRows] = useState<DateRow[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setStatusError(null)
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 8000)
      const nextStatus = await fetch('/api/system-status', { cache: 'no-store', signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) {
            return { error: `상태 API 응답 실패 (${res.status})` } as SystemStatusResponse
          }
          return res.json() as Promise<SystemStatusResponse>
        })
        .catch((error: Error) => ({
          error: error.name === 'AbortError'
            ? '상태 API 응답이 지연되고 있습니다. Preview 보호 설정 또는 네트워크 상태를 확인하세요.'
            : error.message,
        } as SystemStatusResponse))
        .finally(() => window.clearTimeout(timeout))

      if (cancelled) return
      setStatus(nextStatus)
      setStatusError(nextStatus.error ?? null)
      setCallTables(nextStatus.callTables ?? [])
      setDateRows(nextStatus.dateRows ?? [])
      setMeterTables(nextStatus.meterTables ?? [])
      setVectorTables(nextStatus.vectorTables ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const callcards = callTables.find((row) => row.table === 'callcard_mbti')
  const driverLogs = callTables.find((row) => row.table === 'driver_daily_logs')
  const meterMain = meterTables.find((row) => row.table === 'meter_hourly_logs') ?? meterTables[0]
  const driverVectors = vectorTables.find((row) => row.table === 'driver_mbti')
  const missingRows = useMemo(() => dateRows.filter((row) => !row.callcards || !row.driverLogs || !row.matches), [dateRows])

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Topbar />
      <KpiRail loading={loading} callcards={callcards} meterMain={meterMain} driverVectors={driverVectors} missing={missingRows.length} status={status} />

      <section style={{ position: 'relative', minHeight: 'calc(100vh - 126px)', overflow: 'hidden', borderTop: `1px solid ${C.border}` }}>
        <MapBackdrop />

        <aside style={leftPanel}>
          <PanelTitle kicker="DATA COVERAGE" title="적재 범위" />
          <CoverageCard title="호출데이터" range={range(callcards)} days={dayCount(callcards?.minDate, callcards?.maxDate)} count={fmt(callcards?.count)} color={C.green} />
          <CoverageCard title="기사 로그" range={range(driverLogs)} days={dayCount(driverLogs?.minDate, driverLogs?.maxDate)} count={fmt(driverLogs?.count)} color={C.cyan} />
          <CoverageCard title="앱미터데이터" range={range(meterMain)} days={dayCount(meterMain?.minDate, meterMain?.maxDate)} count={fmt(meterMain?.count)} color={C.purple} />
          <StatusNotice loading={loading} status={status} error={statusError} />
        </aside>

        <section style={stagePanel}>
          <div style={{ position: 'relative', zIndex: 3 }}>
            <div style={{ color: C.cyan, fontSize: 14, fontWeight: 950, letterSpacing: '.12em' }}>INGESTION RADAR</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 36, lineHeight: 1.08, fontWeight: 950 }}>파일 업로드 화면이 아니라 데이터 준비 상태를 보는 관제 화면</h1>
            <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.55, maxWidth: 760, marginTop: 12 }}>
              폴더 감시 파이프라인이 Supabase에 적재한 결과를 기준으로, AI 우선배차 검증에 필요한 콜카드, 기사 로그, 매칭 결과가 날짜별로 이어져 있는지 확인합니다.
            </p>
            <ReadinessSummary
              callcards={callcards}
              driverLogs={driverLogs}
              meterMain={meterMain}
              matching={callTables.find((row) => row.table === 'matching_scores')}
            />
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
          <EnvChecklist status={status} />
        </aside>

        <BottomDock callTables={callTables} meterTables={meterTables} vectorTables={vectorTables} />
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

function KpiRail({ loading, callcards, meterMain, driverVectors, missing, status }: { loading: boolean; callcards?: TableStatus; meterMain?: TableStatus; driverVectors?: TableStatus; missing: number; status: SystemStatusResponse | null }) {
  const items = [
    ['연결 상태', loading ? '확인 중' : status?.ok ? '정상' : '주의', status?.message ?? 'Supabase 상태 확인', status?.ok ? C.green : C.yellow],
    ['호출데이터', loading ? '로딩 중' : range(callcards), dayCount(callcards?.minDate, callcards?.maxDate), C.green],
    ['앱미터데이터', range(meterMain), meterMain?.label ?? '보조 시장 기준', C.cyan],
    ['기사 벡터', fmt(driverVectors?.count), 'driver_mbti', C.purple],
    ['누락 확인', `${missing}일`, '최근 14일 기준', missing ? C.yellow : C.green],
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

function ReadinessSummary({
  callcards,
  driverLogs,
  meterMain,
  matching,
}: {
  callcards?: TableStatus
  driverLogs?: TableStatus
  meterMain?: TableStatus
  matching?: TableStatus
}) {
  const items = [
    { title: '호출데이터', row: callcards, desc: '콜카드·출도착·상태 원천' },
    { title: '기사 로그', row: driverLogs, desc: '수락/미수락 기반 기사 성향' },
    { title: '앱미터', row: meterMain, desc: '천안 시장 흐름 보조 기준' },
    { title: '매칭 결과', row: matching, desc: 'Top 10 추천 저장 결과' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 22, maxWidth: 980 }}>
      {items.map((item) => {
        const errored = item.row?.status === 'error'
        const empty = item.row?.status === 'empty' || !item.row
        const tone = errored ? C.red : empty ? C.yellow : C.green
        const state = errored ? '오류' : empty ? '확인 필요' : '준비됨'
        return (
          <div key={item.title} style={{ border: `1px solid ${tone}55`, borderRadius: 14, background: `${tone}12`, padding: 14, minHeight: 126 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ color: tone, fontSize: 15, fontWeight: 950 }}>{item.title}</div>
              <div style={{ color: tone, fontSize: 12, fontWeight: 950 }}>{state}</div>
            </div>
            <div style={{ color: C.ink, fontSize: 18, fontWeight: 950, marginTop: 10 }}>{range(item.row)}</div>
            <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.45, marginTop: 8 }}>{dayCount(item.row?.minDate, item.row?.maxDate)} · {fmt(item.row?.count)}건</div>
            <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.4, marginTop: 8 }}>{item.row?.error ?? item.desc}</div>
          </div>
        )
      })}
    </div>
  )
}

function CoverageTimeline({ rows }: { rows: DateRow[] }) {
  if (!rows.length) {
    return (
      <div style={{ position: 'absolute', left: 28, right: 28, bottom: 28, zIndex: 4, border: `1px solid ${C.yellow}66`, borderRadius: 16, background: 'rgba(245,158,11,.1)', padding: 18 }}>
        <div style={{ color: C.yellow, fontSize: 15, fontWeight: 950 }}>날짜별 적재 현황을 표시할 데이터가 없습니다.</div>
        <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.5, margin: '8px 0 0' }}>
          Supabase 연결 실패, 호출데이터 0건, 또는 날짜 컬럼 조회 실패 중 하나입니다. 좌측 상태 카드의 원인을 먼저 확인하세요.
        </p>
      </div>
    )
  }

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

function BottomDock({ callTables, meterTables, vectorTables }: { callTables: TableStatus[]; meterTables: TableStatus[]; vectorTables: TableStatus[] }) {
  const rows = [...callTables, ...meterTables, ...vectorTables]
    .filter((row) => row.importance !== 'optional')
    .slice(0, 4)
  return (
    <section style={{ position: 'absolute', left: 350, right: 350, bottom: 18, minHeight: 112, border: `1px solid ${C.border}`, borderRadius: 18, background: 'linear-gradient(90deg, rgba(9,14,26,.96), rgba(9,14,26,.76))', boxShadow: '0 20px 70px rgba(0,0,0,.32)', zIndex: 8, padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {rows.map((row) => <Dock key={row.table} title={row.label} value={fmt(row.count)} sub={row.error ? `오류: ${row.error}` : range(row)} color={row.status === 'error' ? C.red : C.green} />)}
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

function StatusNotice({ loading, status, error }: { loading: boolean; status: SystemStatusResponse | null; error: string | null }) {
  const tone = loading ? C.cyan : status?.ok ? C.green : C.yellow
  const title = loading ? '상태 확인 중' : status?.ok ? '조회 정상' : '확인 필요'
  const message = error ?? status?.message ?? 'Supabase와 적재 테이블 상태를 확인합니다.'

  return (
    <div style={{ marginTop: 14, border: `1px solid ${tone}66`, borderRadius: 16, background: `${tone}12`, padding: 16 }}>
      <div style={{ color: tone, fontSize: 16, fontWeight: 950 }}>{title}</div>
      <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.5, margin: '8px 0 0' }}>{message}</p>
      <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.45, margin: '8px 0 0' }}>
        자동 적재는 Vercel 화면이 아니라 PC/서버의 watch 프로세스가 담당합니다.
      </p>
    </div>
  )
}

function EnvChecklist({ status }: { status: SystemStatusResponse | null }) {
  const env = status?.env ?? {}
  const pending = !status
  const items = [
    ['Supabase URL', env.NEXT_PUBLIC_SUPABASE_URL],
    ['Supabase anon', env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
    ['Service role', env.SUPABASE_SERVICE_ROLE_KEY],
    ['AI 분석 키', env.ANTHROPIC_API_KEY],
  ] as const

  return (
    <div style={{ marginTop: 14, border: `1px solid ${C.border}`, borderRadius: 16, background: 'rgba(15,22,40,.72)', padding: 16 }}>
      <div style={{ color: C.ink, fontSize: 15, fontWeight: 950 }}>환경 연결</div>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {items.map(([label, ok]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: C.sub, fontSize: 13, fontWeight: 850 }}>
            <span>{label}</span>
            <span style={{ color: pending ? C.cyan : ok ? C.green : C.yellow }}>{pending ? '확인 중' : ok ? '설정됨' : '없음'}</span>
          </div>
        ))}
      </div>
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

