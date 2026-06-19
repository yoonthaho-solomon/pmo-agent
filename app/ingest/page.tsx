'use client'

import { DispatchFlow } from '@/app/components/DispatchFlow'
import { PrimaryNav } from '@/app/components/PrimaryNav'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

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
  bg: '#05070D',
  panel: 'rgba(10, 15, 27, 0.92)',
  panel2: 'rgba(16, 24, 39, 0.78)',
  ink: '#F8FAFC',
  sub: '#B8C7DE',
  muted: '#7C8AA3',
  line: 'rgba(148, 163, 184, 0.18)',
  cyan: '#22D3EE',
  green: '#34D399',
  yellow: '#FBBF24',
  orange: '#FB923C',
  red: '#F43F5E',
  purple: '#A78BFA',
  slate: '#64748B',
} as const

function fmt(n: number | null | undefined) {
  return n == null ? '-' : n.toLocaleString('ko-KR')
}

function rangeText(row?: TableStatus) {
  if (!row?.minDate || !row?.maxDate) return '-'
  return `${row.minDate} ~ ${row.maxDate}`
}

function shortRange(row?: TableStatus) {
  if (!row?.minDate || !row?.maxDate) return '-'
  return `${row.minDate.slice(5)} ~ ${row.maxDate.slice(5)}`
}

function isReady(row?: TableStatus) {
  return Boolean(row?.count && row.status !== 'error')
}

function dateRowState(row: DateRow) {
  if (!row.callcards || !row.driverLogs || !row.matches) {
    return { label: '누락', tone: C.red, level: 'missing' as const, score: 20 }
  }
  if (row.callcards < 100 || row.driverLogs < 100 || row.matches < 100) {
    return { label: '부분', tone: C.yellow, level: 'partial' as const, score: 55 }
  }
  return { label: '정상', tone: C.green, level: 'ok' as const, score: 92 }
}

function statusCount(rows: DateRow[], level: 'ok' | 'partial' | 'missing') {
  return rows.filter((row) => dateRowState(row).level === level).length
}

export default function IngestPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SystemStatusResponse | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [metric, setMetric] = useState<'callcards' | 'driverLogs' | 'matches'>('callcards')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setStatusError(null)
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 9000)
      const nextStatus = await fetch('/api/system-status', { cache: 'no-store', signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) return { error: `상태 API 응답 실패 (${res.status})` } as SystemStatusResponse
          return res.json() as Promise<SystemStatusResponse>
        })
        .catch((error: Error) => ({
          error: error.name === 'AbortError'
            ? '상태 API 응답이 지연되고 있습니다. Supabase 연결과 Vercel 환경변수를 확인하세요.'
            : error.message,
        } as SystemStatusResponse))
        .finally(() => window.clearTimeout(timeout))

      if (cancelled) return
      setStatus(nextStatus)
      setStatusError(nextStatus.error ?? null)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const callTables = useMemo(() => status?.callTables ?? [], [status?.callTables])
  const meterTables = useMemo(() => status?.meterTables ?? [], [status?.meterTables])
  const vectorTables = useMemo(() => status?.vectorTables ?? [], [status?.vectorTables])
  const dateRows = useMemo(() => status?.dateRows ?? [], [status?.dateRows])

  const callcards = callTables.find((row) => row.table === 'callcard_mbti')
  const driverLogs = callTables.find((row) => row.table === 'driver_daily_logs')
  const matching = callTables.find((row) => row.table === 'matching_scores')
  const meterHourly = meterTables.find((row) => row.table === 'meter_hourly_logs')
  const meterDrivers = meterTables.find((row) => row.table === 'meter_driver_logs')
  const driverVectors = vectorTables.find((row) => row.table === 'driver_mbti')

  const okDays = statusCount(dateRows, 'ok')
  const partialDays = statusCount(dateRows, 'partial')
  const missingDays = statusCount(dateRows, 'missing')
  const issueRows = useMemo(
    () => dateRows.filter((row) => dateRowState(row).level !== 'ok').slice(0, 5),
    [dateRows],
  )
  const coreReady = Boolean(isReady(callcards) && isReady(driverLogs) && isReady(driverVectors))
  const headline = loading ? '조회 중' : coreReady ? '매칭 준비 완료' : '확인 필요'
  const headlineTone = loading ? C.cyan : coreReady ? C.green : C.yellow

  return (
    <main className="page">
      <PrimaryNav
        active="/ingest"
        title="KONAMOBILITY"
        subtitle="Data Status"
        rightSlot={<><Pill color={C.green}>READ ONLY</Pill><Pill color={C.cyan}>SUPABASE</Pill></>}
      />

      <DispatchFlow active={['request', 'callcard']} />

      <section className="kpi-strip" aria-label="데이터 현황 핵심 지표">
        <Kpi label="호출데이터" value={shortRange(callcards)} meta={`${fmt(callcards?.count)}건`} color={C.cyan} />
        <Kpi label="앱미터데이터" value={shortRange(meterHourly)} meta={`${fmt(meterHourly?.count)}건`} color={C.green} />
        <Kpi label="기사 벡터" value={fmt(driverVectors?.count)} meta="driver_mbti 22D" color={C.purple} />
        <Kpi label="매칭 결과" value={fmt(matching?.count)} meta="Top 10 저장 결과" color={C.orange} />
        <Kpi label="누락 확인" value={`${missingDays}일`} meta={`${okDays}일 정상 · ${partialDays}일 부분`} color={missingDays ? C.red : C.green} />
      </section>

      <section className="ops-board">
        <aside className="left-rail panel">
          <PanelTitle label="CRITICAL ISSUES" title="먼저 확인할 것" />
          <IssueList rows={issueRows} loading={loading} error={statusError} />
          <SourceCard
            title="호출데이터"
            badge="주 원천"
            color={C.cyan}
            rows={[
              ['기간', rangeText(callcards)],
              ['콜카드 팩터', `${fmt(callcards?.count)}건`],
              ['기사 반응 로그', `${fmt(driverLogs?.count)}건`],
            ]}
          />
          <SourceCard
            title="앱미터데이터"
            badge="시장 기준"
            color={C.green}
            rows={[
              ['기간', rangeText(meterHourly)],
              ['시간대 로그', `${fmt(meterHourly?.count)}건`],
              ['기사별 로그', `${fmt(meterDrivers?.count)}건`],
            ]}
          />
        </aside>

        <section className="center-stage panel">
          <div className="stage-head">
            <div>
              <span>DATA READINESS MAP</span>
              <h1>적재된 데이터가 임베딩과 매칭 계산으로 이어졌는지 봅니다</h1>
            </div>
            <div className="status-orb" style={{ '--tone': headlineTone } as CSSProperties}>
              <span>현재 상태</span>
              <b>{headline}</b>
            </div>
          </div>

          <div className="metric-tabs" aria-label="날짜 셀 기준 선택">
            <button type="button" className={metric === 'callcards' ? 'active' : ''} onClick={() => setMetric('callcards')}>콜카드</button>
            <button type="button" className={metric === 'driverLogs' ? 'active' : ''} onClick={() => setMetric('driverLogs')}>기사 로그</button>
            <button type="button" className={metric === 'matches' ? 'active' : ''} onClick={() => setMetric('matches')}>매칭 결과</button>
          </div>

          <DateCellMap rows={dateRows} metric={metric} />

          <div className="flow-summary">
            <FlowCard no="01" title="호출 원천" value={fmt(callcards?.count)} color={C.cyan} />
            <FlowCard no="02" title="기사 로그" value={fmt(driverLogs?.count)} color={C.green} />
            <FlowCard no="03" title="기사 22D" value={fmt(driverVectors?.count)} color={C.purple} />
            <FlowCard no="04" title="매칭 계산" value={fmt(matching?.count)} color={C.orange} />
          </div>
        </section>

        <aside className="right-rail panel">
          <PanelTitle label="ANALYSIS MODE" title="분석 기준" />
          <ModeList active={metric} onChange={setMetric} />
          <PanelTitle label="GENERATED OUTPUT" title="생성된 재료" />
          <OutputStack
            items={[
              ['콜카드 팩터', fmt(callcards?.count), C.cyan],
              ['기사 반응 로그', fmt(driverLogs?.count), C.green],
              ['기사 22D 벡터', fmt(driverVectors?.count), C.purple],
              ['매칭 결과', fmt(matching?.count), C.orange],
            ]}
          />
          <div className="note-card">
            <span>운영 기준</span>
            <p>호출데이터는 AI 우선배차의 핵심 원천입니다. 앱미터데이터는 기사 MBTI 주 원천이 아니라 지역 택시 흐름을 보는 보조 기준입니다.</p>
          </div>
        </aside>
      </section>

      <style jsx>{pageCss}</style>
    </main>
  )
}

function Kpi({ label, value, meta, color }: { label: string; value: string; meta: string; color: string }) {
  return (
    <article className="kpi">
      <span>{label}</span>
      <b style={{ color }}>{value}</b>
      <p>{meta}</p>
    </article>
  )
}

function PanelTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="panel-title">
      <span>{label}</span>
      <h2>{title}</h2>
    </div>
  )
}

function IssueList({ rows, loading, error }: { rows: DateRow[]; loading: boolean; error: string | null }) {
  if (loading) return <div className="issue-card info"><b>상태 조회 중</b><p>Supabase 적재 현황을 확인하고 있습니다.</p></div>
  if (error) return <div className="issue-card high"><b>연결 확인 필요</b><p>{error}</p></div>
  if (!rows.length) return <div className="issue-card ok"><b>주요 누락 없음</b><p>조회된 날짜 기준으로 콜카드, 기사 로그, 매칭 결과가 연결되어 있습니다.</p></div>
  return (
    <div className="issue-list">
      {rows.map((row) => {
        const state = dateRowState(row)
        return (
          <article key={row.date} className="issue-card" style={{ '--tone': state.tone } as CSSProperties}>
            <span>{state.label}</span>
            <b>{row.date}</b>
            <p>콜 {fmt(row.callcards)} · 로그 {fmt(row.driverLogs)} · 매칭 {fmt(row.matches)}</p>
          </article>
        )
      })}
    </div>
  )
}

function SourceCard({ title, badge, color, rows }: { title: string; badge: string; color: string; rows: [string, string][] }) {
  return (
    <article className="source-card" style={{ '--tone': color } as CSSProperties}>
      <div>
        <span>{badge}</span>
        <h3>{title}</h3>
      </div>
      {rows.map(([label, value]) => (
        <p key={label}><em>{label}</em><b>{value}</b></p>
      ))}
    </article>
  )
}

function DateCellMap({ rows, metric }: { rows: DateRow[]; metric: 'callcards' | 'driverLogs' | 'matches' }) {
  if (!rows.length) {
    return <div className="empty-map">날짜별 적재 상태를 표시할 데이터가 없습니다.</div>
  }
  const max = Math.max(...rows.map((row) => Number(row[metric] ?? 0)), 1)
  return (
    <div className="date-map">
      {rows.map((row) => {
        const state = dateRowState(row)
        const raw = Number(row[metric] ?? 0)
        const intensity = Math.max(0.18, Math.min(1, raw / max))
        return (
          <article
            key={row.date}
            className="date-cell"
            style={{ '--tone': state.tone, '--alpha': intensity } as CSSProperties}
            title={`${row.date} · ${metric} ${raw}`}
          >
            <span>{row.date.slice(5)}</span>
            <b>{fmt(raw)}</b>
            <em>{state.label}</em>
          </article>
        )
      })}
    </div>
  )
}

function FlowCard({ no, title, value, color }: { no: string; title: string; value: string; color: string }) {
  return (
    <article className="flow-card" style={{ '--tone': color } as CSSProperties}>
      <span>{no}</span>
      <b>{title}</b>
      <strong>{value}</strong>
    </article>
  )
}

function ModeList({ active, onChange }: { active: 'callcards' | 'driverLogs' | 'matches'; onChange: (value: 'callcards' | 'driverLogs' | 'matches') => void }) {
  const items = [
    ['callcards', '콜카드 기준', '원천 호출 조건'],
    ['driverLogs', '기사 로그 기준', '기사 반응 패턴'],
    ['matches', '매칭 결과 기준', 'Top 10 저장 결과'],
  ] as const
  return (
    <div className="mode-list">
      {items.map(([key, label, desc]) => (
        <button key={key} type="button" className={active === key ? 'active' : ''} onClick={() => onChange(key)}>
          <b>{label}</b>
          <span>{desc}</span>
        </button>
      ))}
    </div>
  )
}

function OutputStack({ items }: { items: [string, string, string][] }) {
  return (
    <div className="output-stack">
      {items.map(([label, value, color]) => (
        <div key={label} style={{ '--tone': color } as CSSProperties}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  )
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span style={{ color, border: `1px solid ${color}66`, background: `${color}18`, borderRadius: 12, padding: '10px 14px', fontSize: 18, fontWeight: 900 }}>
      {children}
    </span>
  )
}

const pageCss = `
  .page {
    min-height: 100vh;
    color: ${C.ink};
    background:
      linear-gradient(90deg, rgba(148,163,184,.045) 1px, transparent 1px),
      linear-gradient(180deg, rgba(148,163,184,.035) 1px, transparent 1px),
      radial-gradient(circle at 50% 0%, rgba(34,211,238,.11), transparent 34rem),
      ${C.bg};
    background-size: 72px 72px, 72px 72px, auto, auto;
    font-family: Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: var(--pmo-fs-label);
  }
  .kpi-strip {
    position: sticky;
    top: 84px;
    z-index: 90;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    border-bottom: 1px solid ${C.line};
    background: rgba(5,7,13,.92);
    backdrop-filter: blur(18px);
  }
  .kpi {
    min-height: 118px;
    display: grid;
    align-content: center;
    gap: 4px;
    padding: 18px 24px;
    border-right: 1px solid ${C.line};
  }
  .kpi span {
    color: ${C.sub};
    font-size: var(--pmo-fs-label);
    font-weight: 950;
  }
  .kpi b {
    font-size: var(--pmo-fs-metric);
    line-height: 1;
    font-weight: 950;
    text-shadow: 0 0 14px rgba(34,211,238,.16);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kpi p {
    margin: 0;
    color: ${C.sub};
    font-size: var(--pmo-fs-label);
    line-height: 1.2;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ops-board {
    display: grid;
    grid-template-columns: minmax(300px, 0.82fr) minmax(640px, 2.05fr) minmax(300px, .88fr);
    min-height: calc(100vh - 270px);
  }
  .panel {
    min-width: 0;
    border: 1px solid rgba(148,163,184,.18);
    background: linear-gradient(180deg, rgba(10,15,27,.92), rgba(5,8,16,.94));
    box-shadow: 0 26px 80px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.035);
  }
  .left-rail,
  .right-rail {
    padding: 24px;
    display: grid;
    align-content: start;
    gap: 18px;
  }
  .center-stage {
    padding: 28px;
    border-left: 1px solid ${C.line};
    border-right: 1px solid ${C.line};
  }
  .panel-title {
    display: grid;
    gap: 8px;
  }
  .panel-title span,
  .stage-head span {
    color: ${C.cyan};
    font-size: var(--pmo-fs-label);
    font-weight: 950;
  }
  .panel-title h2 {
    margin: 0;
    color: ${C.ink};
    font-size: var(--pmo-fs-section);
    line-height: 1.08;
  }
  .stage-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 24px;
    align-items: stretch;
  }
  .stage-head h1 {
    max-width: 980px;
    margin: 8px 0 0;
    font-size: var(--pmo-fs-hero);
    line-height: 1.04;
    letter-spacing: 0;
  }
  .status-orb {
    display: grid;
    align-content: center;
    gap: 8px;
    min-height: 180px;
    padding: 24px;
    border: 1px solid color-mix(in srgb, var(--tone) 48%, transparent);
    border-radius: 22px;
    background: radial-gradient(circle at 70% 30%, color-mix(in srgb, var(--tone) 22%, transparent), transparent 60%), rgba(15,23,42,.62);
  }
  .status-orb span {
    color: ${C.sub};
    font-size: var(--pmo-fs-label);
    font-weight: 950;
  }
  .status-orb b {
    color: var(--tone);
    font-size: 44px;
    line-height: 1.04;
  }
  .metric-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 22px;
  }
  .metric-tabs button,
  .mode-list button {
    border: 1px solid ${C.line};
    border-radius: 999px;
    color: ${C.sub};
    background: rgba(15,23,42,.76);
    padding: 12px 20px;
    font-size: var(--pmo-fs-label);
    font-weight: 950;
    cursor: pointer;
    transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
  }
  .metric-tabs button.active,
  .metric-tabs button:hover {
    color: #06101B;
    border-color: ${C.green};
    background: ${C.green};
  }
  .date-map {
    margin-top: 22px;
    min-height: 480px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
    gap: 12px;
    align-content: start;
    padding: 18px;
    border: 1px solid ${C.line};
    border-radius: 24px;
    background:
      radial-gradient(circle at 50% 35%, rgba(34,211,238,.12), transparent 28rem),
      rgba(2,6,15,.62);
  }
  .date-cell {
    min-height: 112px;
    display: grid;
    align-content: space-between;
    gap: 10px;
    padding: 14px;
    border: 1px solid color-mix(in srgb, var(--tone) 52%, transparent);
    border-radius: 18px;
    background: color-mix(in srgb, var(--tone) calc(var(--alpha) * 34%), rgba(15,23,42,.78));
    box-shadow: 0 0 18px color-mix(in srgb, var(--tone) calc(var(--alpha) * 18%), transparent);
  }
  .date-cell span {
    color: ${C.ink};
    font-size: var(--pmo-fs-body-lg);
    font-weight: 950;
  }
  .date-cell b {
    color: ${C.ink};
    font-size: var(--pmo-fs-body-lg);
    line-height: 1;
    overflow-wrap: anywhere;
  }
  .date-cell em {
    color: var(--tone);
    font-size: var(--pmo-fs-caption);
    font-style: normal;
    font-weight: 950;
  }
  .empty-map {
    margin-top: 22px;
    min-height: 420px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(245,158,11,.42);
    border-radius: 24px;
    color: ${C.yellow};
    background: rgba(245,158,11,.08);
    font-size: var(--pmo-fs-body-lg);
    font-weight: 900;
  }
  .flow-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 18px;
  }
  .flow-card {
    min-width: 0;
    border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
    border-radius: 18px;
    background: color-mix(in srgb, var(--tone) 10%, rgba(15,23,42,.72));
    padding: 16px;
  }
  .flow-card span {
    color: var(--tone);
    font-size: var(--pmo-fs-caption);
    font-weight: 950;
  }
  .flow-card b {
    display: block;
    margin-top: 8px;
    font-size: var(--pmo-fs-body);
  }
  .flow-card strong {
    display: block;
    margin-top: 8px;
    font-size: var(--pmo-fs-section);
    line-height: 1;
  }
  .issue-list {
    display: grid;
    gap: 12px;
  }
  .issue-card {
    display: grid;
    gap: 8px;
    border: 1px solid color-mix(in srgb, var(--tone, ${C.yellow}) 42%, transparent);
    border-radius: 18px;
    background: color-mix(in srgb, var(--tone, ${C.yellow}) 10%, rgba(15,23,42,.76));
    padding: 18px;
  }
  .issue-card span {
    width: fit-content;
    border-radius: 999px;
    color: var(--tone, ${C.yellow});
    background: color-mix(in srgb, var(--tone, ${C.yellow}) 14%, transparent);
    padding: 4px 10px;
    font-size: var(--pmo-fs-caption);
    font-weight: 950;
  }
  .issue-card b {
    font-size: var(--pmo-fs-body-lg);
    line-height: 1.15;
  }
  .issue-card p {
    margin: 0;
    color: ${C.sub};
    font-size: var(--pmo-fs-label);
    line-height: 1.35;
    font-weight: 800;
  }
  .issue-card.ok { --tone: ${C.green}; }
  .issue-card.high { --tone: ${C.red}; }
  .issue-card.info { --tone: ${C.cyan}; }
  .source-card,
  .note-card {
    display: grid;
    gap: 12px;
    border: 1px solid color-mix(in srgb, var(--tone, ${C.orange}) 38%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--tone, ${C.orange}) 9%, rgba(15,23,42,.72));
    padding: 18px;
  }
  .source-card span,
  .note-card span {
    color: var(--tone, ${C.orange});
    font-size: var(--pmo-fs-caption);
    font-weight: 950;
  }
  .source-card h3 {
    margin: 2px 0 0;
    font-size: var(--pmo-fs-section);
    line-height: 1;
  }
  .source-card p {
    display: grid;
    gap: 4px;
    margin: 0;
  }
  .source-card em {
    color: ${C.muted};
    font-size: var(--pmo-fs-caption);
    font-style: normal;
    font-weight: 900;
  }
  .source-card b {
    color: ${C.ink};
    font-size: var(--pmo-fs-body);
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .mode-list {
    display: grid;
    gap: 12px;
  }
  .mode-list button {
    display: grid;
    justify-items: start;
    gap: 4px;
    border-radius: 18px;
    padding: 16px;
    text-align: left;
  }
  .mode-list button.active,
  .mode-list button:hover {
    border-color: ${C.cyan};
    background: rgba(34,211,238,.12);
    color: ${C.ink};
  }
  .mode-list b {
    font-size: var(--pmo-fs-body);
  }
  .mode-list span {
    color: ${C.muted};
    font-size: var(--pmo-fs-caption);
    font-weight: 850;
  }
  .output-stack {
    display: grid;
    gap: 12px;
  }
  .output-stack div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    border: 1px solid color-mix(in srgb, var(--tone) 36%, transparent);
    border-radius: 16px;
    background: color-mix(in srgb, var(--tone) 8%, rgba(15,23,42,.74));
    padding: 15px;
  }
  .output-stack span {
    color: ${C.sub};
    font-size: var(--pmo-fs-label);
    font-weight: 900;
  }
  .output-stack b {
    color: var(--tone);
    font-size: var(--pmo-fs-body-lg);
    line-height: 1;
  }
  .note-card p {
    margin: 0;
    color: ${C.sub};
    font-size: var(--pmo-fs-label);
    line-height: 1.45;
    font-weight: 780;
  }
  @media (max-width: 1360px) {
    .ops-board { grid-template-columns: 1fr; }
    .left-rail, .right-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .center-stage { border-left: 0; border-right: 0; }
    .kpi-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); position: static; }
  }
  @media (max-width: 860px) {
    .left-rail, .right-rail, .stage-head, .flow-summary { grid-template-columns: 1fr; }
    .date-map { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .stage-head h1 { font-size: 40px; }
  }
`
