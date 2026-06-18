'use client'

import { PrimaryNav } from '@/app/components/PrimaryNav'
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
  sub: '#B8C7DE',
  muted: '#8290A8',
  panel: 'rgba(9,14,26,.92)',
  panel2: 'rgba(14,22,39,.76)',
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

function rangeText(row?: TableStatus) {
  if (!row?.minDate || !row?.maxDate) return '-'
  return `${row.minDate} ~ ${row.maxDate}`
}

function dayCount(start?: string | null, end?: string | null) {
  if (!start || !end) return '-'
  const diff = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()
  return `${Math.max(0, Math.round(diff / 86400000) + 1)}일`
}

function tableState(row?: TableStatus) {
  if (!row) return '확인 필요'
  if (row.status === 'error') return '오류'
  if (row.status === 'empty' || !row.count) return '비어 있음'
  return '준비됨'
}

function tableTone(row?: TableStatus) {
  if (!row || row.status === 'empty' || !row.count) return C.yellow
  if (row.status === 'error') return C.red
  return C.green
}

export default function IngestPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SystemStatusResponse | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setStatusError(null)
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 8000)

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
    return () => {
      cancelled = true
    }
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
  const meterDaily = meterTables.find((row) => row.table === 'meter_daily_logs')
  const driverVectors = vectorTables.find((row) => row.table === 'driver_mbti')

  const missingRows = useMemo(
    () => dateRows.filter((row) => !row.callcards || !row.driverLogs || !row.matches),
    [dateRows],
  )

  const coreReady = Boolean(callcards?.count && driverLogs?.count && driverVectors?.count)
  const headline = loading ? '확인 중' : coreReady ? '준비됨' : '확인 필요'
  const headlineTone = loading ? C.cyan : coreReady ? C.green : C.yellow

  return (
    <main className="page">
      <PrimaryNav
        active="/ingest"
        title="Happycall PMO"
        subtitle="Data Radar"
        rightSlot={(
          <>
            <Pill color={C.green}>READ ONLY</Pill>
            <Pill color={C.cyan}>SUPABASE</Pill>
          </>
        )}
      />

      <section className="kpiRail" aria-label="적재 핵심 지표">
        <Kpi title="호출데이터" value={rangeText(callcards)} meta={`${dayCount(callcards?.minDate, callcards?.maxDate)} · ${fmt(callcards?.count)}건`} color={C.green} />
        <Kpi title="앱미터데이터" value={rangeText(meterHourly)} meta={`${dayCount(meterHourly?.minDate, meterHourly?.maxDate)} · ${fmt(meterHourly?.count)}건`} color={C.cyan} />
        <Kpi title="기사 벡터" value={fmt(driverVectors?.count)} meta="driver_mbti 기준" color={C.purple} />
        <Kpi title="매칭 결과" value={fmt(matching?.count)} meta="Top 10 저장 결과" color={C.orange} />
      </section>

      <section className="workspace">
        <div className="backdrop" aria-hidden />

        <section className="heroPanel">
          <div className="heroCopy">
            <p className="eyebrow">DATA READINESS</p>
            <h1>AI 우선배차를 시작할 수 있는 데이터인지 확인합니다</h1>
            <p className="lead">
              이 화면의 코어는 업로드가 아니라 적재 범위, 기사 벡터 생성, 매칭 결과가 날짜별로 이어졌는지 보는 것입니다.
            </p>
          </div>
          <div className="readinessCard" style={{ borderColor: `${headlineTone}66`, background: `${headlineTone}12` }}>
            <span>현재 상태</span>
            <strong style={{ color: headlineTone }}>{headline}</strong>
            <em>{statusError ?? status?.message ?? 'Supabase 테이블 상태를 읽고 있습니다.'}</em>
          </div>
        </section>

        <section className="coreGrid">
          <article className="corePanel mainStatus">
            <SectionTitle kicker="CORE" title="준비 상태" />
            <div className="statusStack">
              <StatusLine label="호출데이터" row={callcards} detail="콜카드 팩터와 수락/미수락 기준 데이터" />
              <StatusLine label="기사 로그" row={driverLogs} detail="기사별 누적 호출 반응과 운행 성향 기초" />
              <StatusLine label="기사 벡터" row={driverVectors} detail="driver_mbti 22D 성향 벡터" />
              <StatusLine label="매칭 결과" row={matching} detail="콜카드별 Top 10 추천 저장 결과" optional />
            </div>
          </article>

          <article className="corePanel timelinePanel">
            <SectionTitle kicker="DATE COVERAGE" title="최근 날짜별 적재 연결" />
            <CoverageTimeline rows={dateRows} />
          </article>

          <article className="corePanel sidePanel">
            <SectionTitle kicker="AUTOMATION" title="자동 적재 방식" />
            <CommandBlock title="호출데이터" command="npm run call:watch" color={C.green} />
            <CommandBlock title="앱미터데이터" command="npm run meter:watch" color={C.cyan} />
            <div className="ruleBox">
              <strong>보여줄 것</strong>
              <p>몇일부터 몇일까지 준비됐는지, 벡터와 매칭 계산이 이어졌는지.</p>
            </div>
            <div className="ruleBox warning">
              <strong>보이지 않을 것</strong>
              <p>긴 JSON, 내부 로그 반복, 확정되지 않은 배차 가정.</p>
            </div>
          </article>
        </section>

        <section className="supportGrid">
          <SupportCard title="앱미터 보조 기준" color={C.cyan} rows={[
            ['시간대 로그', rangeText(meterHourly), fmt(meterHourly?.count)],
            ['기사별 로그', rangeText(meterDrivers), fmt(meterDrivers?.count)],
            ['일별 요약', rangeText(meterDaily), fmt(meterDaily?.count)],
          ]} />
          <SupportCard title="누락 확인" color={missingRows.length ? C.yellow : C.green} rows={[
            ['최근 14일 누락', `${missingRows.length}일`, missingRows.length ? '확인 필요' : '정상'],
            ['호출-기사 연결', tableState(driverLogs), rangeText(driverLogs)],
            ['매칭 계산', tableState(matching), rangeText(matching)],
          ]} />
        </section>
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: ${C.bg};
          color: ${C.ink};
          font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .kpiRail {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-bottom: 1px solid ${C.border};
          background: #080B13;
        }
        .workspace {
          position: relative;
          min-height: calc(100vh - 162px);
          overflow: hidden;
          padding: clamp(20px, 2.2vw, 34px);
        }
        .backdrop {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 28% 18%, rgba(34,211,238,.15), transparent 28%),
            radial-gradient(circle at 72% 22%, rgba(139,92,246,.14), transparent 30%),
            linear-gradient(135deg, #111827, #070A12 64%);
        }
        .backdrop::after {
          content: '';
          position: absolute;
          inset: 0;
          opacity: .28;
          background-image:
            linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px);
          background-size: 58px 58px;
        }
        .heroPanel,
        .coreGrid,
        .supportGrid {
          position: relative;
          z-index: 1;
        }
        .heroPanel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 460px);
          gap: 22px;
          align-items: stretch;
          margin-bottom: 22px;
        }
        .heroCopy,
        .readinessCard,
        .corePanel,
        .supportCard {
          border: 1px solid ${C.border};
          border-radius: 22px;
          background: ${C.panel};
          box-shadow: 0 24px 76px rgba(0,0,0,.32);
        }
        .heroCopy {
          padding: clamp(24px, 3vw, 40px);
        }
        .eyebrow {
          margin: 0;
          color: ${C.cyan};
          font-size: 20px;
          font-weight: 950;
          letter-spacing: .08em;
        }
        h1 {
          margin: 10px 0 0;
          max-width: 940px;
          font-size: clamp(42px, 4.6vw, 76px);
          line-height: 1.02;
          font-weight: 950;
          letter-spacing: 0;
        }
        .lead {
          max-width: 900px;
          color: ${C.sub};
          font-size: clamp(22px, 1.6vw, 28px);
          line-height: 1.45;
          margin: 20px 0 0;
          font-weight: 750;
        }
        .readinessCard {
          padding: 26px;
          display: grid;
          align-content: center;
          gap: 12px;
        }
        .readinessCard span {
          color: ${C.muted};
          font-size: 20px;
          font-weight: 950;
        }
        .readinessCard strong {
          font-size: clamp(48px, 5vw, 82px);
          line-height: .95;
          font-weight: 950;
        }
        .readinessCard em {
          color: ${C.sub};
          font-size: 21px;
          line-height: 1.4;
          font-style: normal;
          font-weight: 700;
        }
        .coreGrid {
          display: grid;
          grid-template-columns: minmax(340px, .95fr) minmax(520px, 1.7fr) minmax(320px, .9fr);
          gap: 22px;
        }
        .corePanel {
          min-height: 520px;
          padding: clamp(20px, 2vw, 28px);
        }
        .statusStack {
          display: grid;
          gap: 16px;
          margin-top: 22px;
        }
        .supportGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 22px;
          margin-top: 22px;
        }
        .ruleBox {
          margin-top: 18px;
          border: 1px solid rgba(16,185,129,.4);
          border-radius: 18px;
          padding: 18px;
          background: rgba(16,185,129,.1);
        }
        .ruleBox.warning {
          border-color: rgba(245,158,11,.45);
          background: rgba(245,158,11,.1);
        }
        .ruleBox strong {
          color: ${C.ink};
          font-size: 22px;
          font-weight: 950;
        }
        .ruleBox p {
          color: ${C.sub};
          font-size: 20px;
          line-height: 1.45;
          margin: 10px 0 0;
        }
        @media (max-width: 1440px) {
          .coreGrid {
            grid-template-columns: 1fr 1.35fr;
          }
          .sidePanel {
            grid-column: 1 / -1;
            min-height: auto;
          }
        }
        @media (max-width: 1100px) {
          .kpiRail,
          .heroPanel,
          .coreGrid,
          .supportGrid {
            grid-template-columns: 1fr;
          }
          .corePanel {
            min-height: auto;
          }
        }
      `}</style>
    </main>
  )
}

function Kpi({ title, value, meta, color }: { title: string; value: string; meta: string; color: string }) {
  return (
    <article className="kpi">
      <div>{title}</div>
      <strong style={{ color }}>{value}</strong>
      <span>{meta}</span>
      <style jsx>{`
        .kpi {
          min-height: 92px;
          padding: 16px 22px;
          border-right: 1px solid ${C.border};
          display: grid;
          align-content: center;
          gap: 6px;
        }
        .kpi div {
          color: ${C.muted};
          font-size: 20px;
          font-weight: 950;
        }
        .kpi strong {
          min-width: 0;
          font-size: clamp(25px, 2vw, 36px);
          line-height: 1.05;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .kpi span {
          color: ${C.sub};
          font-size: 20px;
          font-weight: 750;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </article>
  )
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="sectionTitle">
      <span>{kicker}</span>
      <h2>{title}</h2>
      <style jsx>{`
        .sectionTitle span {
          color: ${C.muted};
          font-size: 20px;
          font-weight: 950;
          letter-spacing: .08em;
        }
        .sectionTitle h2 {
          margin: 8px 0 0;
          color: ${C.ink};
          font-size: clamp(30px, 2.4vw, 44px);
          line-height: 1.05;
          font-weight: 950;
        }
      `}</style>
    </div>
  )
}

function StatusLine({ label, row, detail, optional = false }: { label: string; row?: TableStatus; detail: string; optional?: boolean }) {
  const tone = tableTone(row)
  return (
    <div className="statusLine" style={{ borderColor: `${tone}66`, background: `${tone}10` }}>
      <div className="stateDot" style={{ background: tone }} />
      <div>
        <div className="statusHead">
          <strong>{label}</strong>
          <span style={{ color: tone }}>{optional ? `보조 · ${tableState(row)}` : tableState(row)}</span>
        </div>
        <p>{rangeText(row)}</p>
        <em>{dayCount(row?.minDate, row?.maxDate)} · {fmt(row?.count)}건 · {row?.error ?? detail}</em>
      </div>
      <style jsx>{`
        .statusLine {
          display: grid;
          grid-template-columns: 16px 1fr;
          gap: 16px;
          border: 1px solid;
          border-radius: 18px;
          padding: 18px;
        }
        .stateDot {
          width: 16px;
          height: 16px;
          border-radius: 999px;
          margin-top: 7px;
          box-shadow: 0 0 20px currentColor;
        }
        .statusHead {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
        }
        strong {
          color: ${C.ink};
          font-size: 24px;
          font-weight: 950;
        }
        span {
          font-size: 20px;
          font-weight: 950;
          white-space: nowrap;
        }
        p {
          color: ${C.ink};
          font-size: 24px;
          line-height: 1.25;
          margin: 12px 0 0;
          font-weight: 950;
          word-break: keep-all;
        }
        em {
          display: block;
          color: ${C.sub};
          font-size: 20px;
          line-height: 1.4;
          margin-top: 10px;
          font-style: normal;
          font-weight: 700;
        }
      `}</style>
    </div>
  )
}

function CoverageTimeline({ rows }: { rows: DateRow[] }) {
  if (!rows.length) {
    return <div className="emptyTimeline">날짜별 적재 현황을 표시할 데이터가 없습니다.</div>
  }

  return (
    <div className="timeline">
      {rows.map((row) => {
        const ok = Boolean(row.callcards && row.driverLogs && row.matches)
        const tone = ok ? C.green : C.yellow
        const max = Math.max(row.callcards ?? 0, row.driverLogs ?? 0, row.matches ?? 0, 1)
        return (
          <article key={row.date} className="dayCard" style={{ borderColor: `${tone}66`, background: `${tone}10` }}>
            <div className="dayTop">
              <strong>{row.date.slice(5)}</strong>
              <span style={{ color: tone }}>{ok ? '정상' : '확인'}</span>
            </div>
            <MiniBar label="콜" value={row.callcards} max={max} color={C.green} />
            <MiniBar label="로그" value={row.driverLogs} max={max} color={C.cyan} />
            <MiniBar label="매칭" value={row.matches} max={max} color={C.orange} />
          </article>
        )
      })}
      <style jsx>{`
        .timeline {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(156px, 1fr));
          gap: 14px;
          margin-top: 24px;
        }
        .dayCard {
          min-height: 178px;
          border: 1px solid;
          border-radius: 18px;
          padding: 16px;
          display: grid;
          align-content: space-between;
          gap: 10px;
        }
        .dayTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .dayTop strong {
          color: ${C.ink};
          font-size: 24px;
          font-weight: 950;
        }
        .dayTop span {
          font-size: 20px;
          font-weight: 950;
        }
        .emptyTimeline {
          margin-top: 24px;
          border: 1px solid rgba(245,158,11,.45);
          border-radius: 18px;
          background: rgba(245,158,11,.1);
          padding: 24px;
          color: ${C.yellow};
          font-size: 24px;
          font-weight: 950;
        }
      `}</style>
    </div>
  )
}

function MiniBar({ label, value, max, color }: { label: string; value: number | null; max: number; color: string }) {
  const width = value == null ? 0 : Math.max(4, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div className="miniBar">
      <div className="barMeta">
        <span>{label}</span>
        <strong>{fmt(value)}</strong>
      </div>
      <div className="track"><i style={{ width: `${width}%`, background: color }} /></div>
      <style jsx>{`
        .miniBar {
          display: grid;
          gap: 7px;
        }
        .barMeta {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: ${C.sub};
          font-size: 20px;
          font-weight: 850;
        }
        .barMeta strong {
          color: ${C.ink};
          font-size: 20px;
          font-weight: 950;
        }
        .track {
          height: 10px;
          border-radius: 999px;
          background: rgba(130,144,168,.22);
          overflow: hidden;
        }
        .track i {
          display: block;
          height: 100%;
          border-radius: inherit;
        }
      `}</style>
    </div>
  )
}

function CommandBlock({ title, command, color }: { title: string; command: string; color: string }) {
  return (
    <div className="command" style={{ borderColor: `${color}66`, background: `${color}10` }}>
      <span style={{ color }}>{title}</span>
      <code>{command}</code>
      <style jsx>{`
        .command {
          margin-top: 18px;
          border: 1px solid;
          border-radius: 18px;
          padding: 18px;
        }
        span {
          display: block;
          font-size: 22px;
          font-weight: 950;
        }
        code {
          display: block;
          color: ${C.ink};
          font-size: 22px;
          font-weight: 950;
          margin-top: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  )
}

function SupportCard({ title, color, rows }: { title: string; color: string; rows: [string, string, string][] }) {
  return (
    <article className="supportCard">
      <h3 style={{ color }}>{title}</h3>
      <div className="supportRows">
        {rows.map(([label, value, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <em>{count}</em>
          </div>
        ))}
      </div>
      <style jsx>{`
        .supportCard {
          padding: 22px;
        }
        h3 {
          margin: 0;
          font-size: 30px;
          line-height: 1.1;
          font-weight: 950;
        }
        .supportRows {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }
        .supportRows div {
          border: 1px solid ${C.border};
          border-radius: 16px;
          background: ${C.panel2};
          padding: 16px;
          min-width: 0;
        }
        span,
        em {
          display: block;
          color: ${C.sub};
          font-size: 20px;
          font-style: normal;
          font-weight: 800;
        }
        strong {
          display: block;
          color: ${C.ink};
          font-size: 24px;
          line-height: 1.2;
          font-weight: 950;
          margin: 10px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 900px) {
          .supportRows {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </article>
  )
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span style={{ color, border: `1px solid ${color}66`, background: `${color}18`, borderRadius: 12, padding: '10px 14px', fontSize: 16, fontWeight: 950 }}>
      {children}
    </span>
  )
}