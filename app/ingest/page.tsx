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
  bg: '#070a10',
  panel: '#10151f',
  panel2: '#151b27',
  line: 'rgba(255,255,255,.09)',
  ink: '#f3f7ff',
  sub: '#b8c7da',
  muted: '#7f8da3',
  cyan: '#38bdf8',
  green: '#54d17a',
  orange: '#f59e42',
  violet: '#9b7cff',
  yellow: '#f2c14e',
  red: '#f15d64',
}

function fmt(value: number | null | undefined) {
  return value == null ? '-' : value.toLocaleString('ko-KR')
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : null
}

function rangeText(row?: TableStatus) {
  const start = dateOnly(row?.minDate)
  const end = dateOnly(row?.maxDate)
  if (!start || !end) return '-'
  return `${start} ~ ${end}`
}

function shortRange(row?: TableStatus) {
  const start = dateOnly(row?.minDate)
  const end = dateOnly(row?.maxDate)
  if (!start || !end) return '-'
  return `${start.slice(5)} ~ ${end.slice(5)}`
}

function dayCount(start?: string | null, end?: string | null) {
  const a = dateOnly(start)
  const b = dateOnly(end)
  if (!a || !b) return '-'
  const diff = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()
  if (Number.isNaN(diff)) return '-'
  return `${Math.max(0, Math.round(diff / 86400000) + 1)}일`
}

function rowReady(row?: TableStatus) {
  return Boolean(row?.count && row.status !== 'error')
}

function rowState(row?: TableStatus) {
  if (!row) return '확인 필요'
  if (row.status === 'error') return '오류'
  if (!row.count) return '비어 있음'
  return '정상'
}

function rowTone(row?: TableStatus) {
  if (!row) return C.yellow
  if (row.status === 'error') return C.red
  if (!row.count) return C.yellow
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
      const timeout = window.setTimeout(() => controller.abort(), 9000)

      const nextStatus = await fetch('/api/system-status', { cache: 'no-store', signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) return { error: `상태 API 응답 실패 (${res.status})` } as SystemStatusResponse
          return res.json() as Promise<SystemStatusResponse>
        })
        .catch((error: Error) => ({
          error: error.name === 'AbortError'
            ? '상태 API 응답이 지연되고 있습니다. Supabase 환경변수와 테이블 권한을 확인하세요.'
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

  const readyCount = [
    rowReady(callcards),
    rowReady(driverLogs),
    rowReady(driverVectors),
    rowReady(matching),
  ].filter(Boolean).length
  const statusLabel = loading ? '확인 중' : readyCount >= 3 ? '분석 가능' : '확인 필요'
  const statusTone = loading ? C.cyan : readyCount >= 3 ? C.green : C.yellow

  return (
    <main className="page">
      <PrimaryNav
        active="/ingest"
        title="KONAMOBILITY"
        subtitle="DATA RADAR"
        rightSlot={(
          <>
            <Pill color={C.green}>READ ONLY</Pill>
            <Pill color={C.cyan}>SUPABASE</Pill>
          </>
        )}
      />

      <section className="topRail" aria-label="적재 핵심 지표">
        <Kpi title="호출데이터" value={shortRange(callcards)} meta={`${dayCount(callcards?.minDate, callcards?.maxDate)} · ${fmt(callcards?.count)}건`} color={C.green} />
        <Kpi title="앱미터데이터" value={shortRange(meterHourly)} meta={`${dayCount(meterHourly?.minDate, meterHourly?.maxDate)} · ${fmt(meterHourly?.count)}건`} color={C.cyan} />
        <Kpi title="기사 운행패턴" value={fmt(driverVectors?.count)} meta="driver_mbti 22D 기사 벡터" color={C.violet} />
        <Kpi title="우선발송 후보" value={fmt(matching?.count)} meta="콜카드별 Top 10 계산 결과" color={C.orange} />
      </section>

      <div className="shell">
        <section className="hero">
          <div>
            <span className="eyebrow">DATA READINESS</span>
            <h1>콜수락율 분석에 필요한 데이터가 어디까지 쌓였는지 봅니다.</h1>
            <p>
              이 화면은 파일 업로드 화면이 아닙니다. 호출데이터와 앱미터데이터가 Supabase에 적재된 범위,
              기사 운행패턴 벡터 생성 여부, 콜카드별 우선발송 후보 계산 여부를 확인합니다.
            </p>
          </div>
          <StatusDial label={statusLabel} value={`${readyCount}/4`} color={statusTone} note={statusError ?? status?.message ?? '호출·기사·벡터·매칭 테이블을 읽고 있습니다.'} />
        </section>

        <section className="focusGrid" aria-label="적재 현황 핵심">
          <CoverageCard
            label="호출데이터"
            title="승객 호출과 콜카드 조건"
            row={callcards}
            color={C.green}
            body="지역, 요일, 시간, 출발지, 도착지, 예상거리, 예상요금, 호출유형을 읽어 콜카드 팩터를 만듭니다."
          />
          <CoverageCard
            label="기사 운행패턴"
            title="콜을 실제로 받아준 기사 기록"
            row={driverLogs}
            color={C.violet}
            body="기사별 수락·운행 기록을 모아 시간대, 요일, 거리, 요금, 상품 성향을 22D 벡터로 만듭니다."
          />
          <CoverageCard
            label="앱미터데이터"
            title="지역 시장 흐름을 보는 보조 데이터"
            row={meterHourly}
            color={C.cyan}
            body="천안 앱미터 기준의 운행량과 수입 흐름입니다. 기사 MBTI의 주 원천이 아니라 시장 보조 기준입니다."
          />
        </section>

        <section className="pipeline">
          <SectionTitle label="FROM DATA TO MATCHING" title="적재된 데이터가 우선배차 재료가 되는 흐름" />
          <div className="flowCards">
            <FlowCard no="01" title="콜카드 조건 추출" text="출발지·도착지, 시간, 요일, 거리, 요금, 호출유형을 콜 조건으로 정리합니다." color={C.green} />
            <FlowCard no="02" title="기사 운행패턴 임베딩" text="기사별 누적 운행기록을 같은 22개 기준으로 바꿔 비교 가능한 벡터로 만듭니다." color={C.violet} />
            <FlowCard no="03" title="유사도와 공간 적합도 계산" text="콜 조건과 기사 패턴의 유사도, 출발·도착 H3 적합도를 분리해 계산합니다." color={C.cyan} />
            <FlowCard no="04" title="먼저 보낼 기사 순서 저장" text="콜수락율을 높이기 위해 가장 받아줄 가능성이 높은 기사 순서로 Top 10 후보를 저장합니다." color={C.orange} />
          </div>
        </section>

        <section className="dateSection">
          <div>
            <SectionTitle label="DATE CONNECTION" title="날짜별 연결 상태" />
            <p className="sectionLead">날짜가 늘어날수록 모든 날짜 카드를 크게 보여주기보다, 최근 적재일의 콜·로그·매칭 연결만 빠르게 확인합니다.</p>
          </div>
          <CoverageTimeline rows={dateRows} />
        </section>

        <section className="supportGrid">
          <SupportPanel
            title="앱미터 보조 데이터"
            color={C.cyan}
            rows={[
              ['시간대 로그', rangeText(meterHourly), `${fmt(meterHourly?.count)}건`],
              ['기사별 로그', rangeText(meterDrivers), `${fmt(meterDrivers?.count)}건`],
              ['일별 요약', rangeText(meterDaily), `${fmt(meterDaily?.count)}건`],
            ]}
          />
          <SupportPanel
            title="누락 확인"
            color={missingRows.length ? C.yellow : C.green}
            rows={[
              ['누락 날짜', `${missingRows.length}일`, missingRows.length ? '확인 필요' : '최근 범위 정상'],
              ['호출-기사 연결', rowState(driverLogs), rangeText(driverLogs)],
              ['매칭 계산', rowState(matching), rangeText(matching)],
            ]}
          />
        </section>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          color: ${C.ink};
          background:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
            radial-gradient(circle at 30% 0%, rgba(56,189,248,.12), transparent 32rem),
            radial-gradient(circle at 80% 12%, rgba(155,124,255,.12), transparent 34rem),
            ${C.bg};
          background-size: 52px 52px, 52px 52px, auto, auto, auto;
        }
        .topRail {
          max-width: var(--maxw);
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-bottom: 1px solid ${C.line};
          border-left: 1px solid ${C.line};
        }
        .shell {
          max-width: var(--maxw);
          margin: 0 auto;
          padding: clamp(22px, 2.2vw, 38px) clamp(16px, 2vw, 28px) 72px;
        }
        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(300px, 430px);
          gap: clamp(18px, 2vw, 28px);
          align-items: stretch;
          border: 1px solid ${C.line};
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(16,21,31,.96), rgba(15,20,32,.78));
          box-shadow: 0 32px 120px rgba(0,0,0,.35);
          padding: clamp(24px, 3vw, 46px);
        }
        .eyebrow {
          display: block;
          color: ${C.cyan};
          font-size: 18px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        h1 {
          max-width: 16ch;
          margin: 16px 0 0;
          color: ${C.ink};
          font-size: clamp(42px, 5vw, 76px);
          line-height: .98;
          font-weight: 950;
          letter-spacing: -.06em;
        }
        .hero p {
          max-width: 62ch;
          margin: 24px 0 0;
          color: ${C.sub};
          font-size: clamp(20px, 1.45vw, 25px);
          line-height: 1.48;
          font-weight: 650;
        }
        .focusGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
        }
        .pipeline,
        .dateSection,
        .supportGrid {
          margin-top: 18px;
          border: 1px solid ${C.line};
          border-radius: 22px;
          background: rgba(16, 21, 31, .72);
          padding: clamp(20px, 2vw, 30px);
        }
        .flowCards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }
        .dateSection {
          display: grid;
          grid-template-columns: minmax(240px, .32fr) minmax(0, 1fr);
          gap: 22px;
          align-items: start;
        }
        .sectionLead {
          margin: 12px 0 0;
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.5;
          font-weight: 650;
        }
        .supportGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 1180px) {
          .topRail,
          .focusGrid,
          .flowCards,
          .dateSection,
          .supportGrid {
            grid-template-columns: 1fr 1fr;
          }
          .hero {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 760px) {
          .topRail,
          .focusGrid,
          .flowCards,
          .dateSection,
          .supportGrid {
            grid-template-columns: 1fr;
          }
          h1 {
            font-size: 42px;
          }
        }
      `}</style>
    </main>
  )
}

function Kpi({ title, value, meta, color }: { title: string; value: string; meta: string; color: string }) {
  return (
    <article className="kpi">
      <span>{title}</span>
      <strong style={{ color }}>{value}</strong>
      <em>{meta}</em>
      <style jsx>{`
        .kpi {
          min-height: 120px;
          padding: 22px 24px;
          border-right: 1px solid ${C.line};
          background: rgba(7,10,16,.72);
          display: grid;
          align-content: center;
          gap: 8px;
          min-width: 0;
        }
        span {
          color: ${C.muted};
          font-size: 18px;
          font-weight: 850;
        }
        strong {
          font-size: clamp(28px, 2.4vw, 42px);
          line-height: 1;
          font-weight: 950;
          letter-spacing: -.04em;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        em {
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.25;
          font-style: normal;
          font-weight: 650;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </article>
  )
}

function StatusDial({ label, value, color, note }: { label: string; value: string; color: string; note: string }) {
  return (
    <aside className="status" style={{ borderColor: `${color}55`, background: `${color}10` }}>
      <span>현재 상태</span>
      <strong style={{ color }}>{label}</strong>
      <div className="dial" style={{ borderColor: `${color}55`, color }}>
        {value}
      </div>
      <p>{note}</p>
      <style jsx>{`
        .status {
          position: relative;
          min-height: 260px;
          border: 1px solid;
          border-radius: 20px;
          padding: 28px;
          display: grid;
          align-content: center;
          gap: 12px;
          overflow: hidden;
        }
        .status::after {
          content: '';
          position: absolute;
          width: 220px;
          height: 220px;
          right: -70px;
          bottom: -70px;
          border-radius: 999px;
          background: currentColor;
          opacity: .06;
        }
        span {
          color: ${C.sub};
          font-size: 20px;
          font-weight: 850;
        }
        strong {
          max-width: 8ch;
          font-size: clamp(44px, 4vw, 66px);
          line-height: .95;
          font-weight: 950;
          letter-spacing: -.06em;
        }
        .dial {
          position: absolute;
          right: 28px;
          bottom: 24px;
          width: 88px;
          height: 88px;
          border: 1px solid;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-size: 26px;
          font-weight: 950;
          font-variant-numeric: tabular-nums;
        }
        p {
          max-width: 21rem;
          margin: 0;
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.45;
          font-weight: 650;
        }
      `}</style>
    </aside>
  )
}

function CoverageCard({ label, title, row, body, color }: {
  label: string
  title: string
  row?: TableStatus
  body: string
  color: string
}) {
  const tone = rowTone(row)
  return (
    <article className="coverage" style={{ borderColor: `${color}4d` }}>
      <div className="head">
        <span style={{ color }}>{label}</span>
        <b style={{ color: tone }}>{rowState(row)}</b>
      </div>
      <h2>{title}</h2>
      <strong>{rangeText(row)}</strong>
      <em>{dayCount(row?.minDate, row?.maxDate)} · {fmt(row?.count)}건</em>
      <p>{body}</p>
      <style jsx>{`
        .coverage {
          min-height: 290px;
          border: 1px solid;
          border-radius: 22px;
          background: linear-gradient(135deg, rgba(16,21,31,.94), rgba(21,27,39,.72));
          padding: 24px;
          box-shadow: 0 24px 80px rgba(0,0,0,.24);
        }
        .head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
        }
        span,
        b {
          font-size: 18px;
          font-weight: 900;
        }
        h2 {
          margin: 22px 0 0;
          color: ${C.ink};
          font-size: clamp(28px, 2vw, 38px);
          line-height: 1.1;
          font-weight: 950;
          letter-spacing: -.04em;
        }
        strong {
          display: block;
          margin-top: 22px;
          color: ${C.ink};
          font-size: 25px;
          line-height: 1.2;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        em {
          display: block;
          margin-top: 8px;
          color: ${C.sub};
          font-size: 20px;
          line-height: 1.3;
          font-style: normal;
          font-weight: 750;
        }
        p {
          margin: 18px 0 0;
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.5;
          font-weight: 650;
        }
      `}</style>
    </article>
  )
}

function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <span>{label}</span>
      <h2>{title}</h2>
      <style jsx>{`
        span {
          display: block;
          color: ${C.cyan};
          font-size: 18px;
          font-weight: 900;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        h2 {
          margin: 8px 0 0;
          color: ${C.ink};
          font-size: clamp(30px, 2.4vw, 44px);
          line-height: 1.08;
          font-weight: 950;
          letter-spacing: -.05em;
        }
      `}</style>
    </div>
  )
}

function FlowCard({ no, title, text, color }: { no: string; title: string; text: string; color: string }) {
  return (
    <article className="flowCard" style={{ borderColor: `${color}44` }}>
      <span style={{ color }}>{no}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <style jsx>{`
        .flowCard {
          border: 1px solid;
          border-radius: 18px;
          background: rgba(21,27,39,.72);
          padding: 20px;
          min-height: 210px;
        }
        span {
          display: block;
          font-size: 20px;
          font-weight: 950;
          font-variant-numeric: tabular-nums;
        }
        h3 {
          margin: 18px 0 0;
          color: ${C.ink};
          font-size: 25px;
          line-height: 1.16;
          font-weight: 950;
          letter-spacing: -.04em;
        }
        p {
          margin: 14px 0 0;
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.5;
          font-weight: 650;
        }
      `}</style>
    </article>
  )
}

function CoverageTimeline({ rows }: { rows: DateRow[] }) {
  if (!rows.length) {
    return (
      <div className="empty">
        날짜별 연결 상태를 표시할 데이터가 없습니다.
        <style jsx>{`
          .empty {
            border: 1px solid ${C.yellow}55;
            border-radius: 18px;
            background: ${C.yellow}12;
            padding: 24px;
            color: ${C.yellow};
            font-size: 20px;
            font-weight: 800;
          }
        `}</style>
      </div>
    )
  }

  const recentRows = rows.slice(-12)
  return (
    <div className="timeline">
      {recentRows.map((row) => {
        const ok = Boolean(row.callcards && row.driverLogs && row.matches)
        const tone = ok ? C.green : C.yellow
        const max = Math.max(row.callcards ?? 0, row.driverLogs ?? 0, row.matches ?? 0, 1)
        return (
          <article key={row.date} className="day" style={{ borderColor: `${tone}44`, background: `${tone}0d` }}>
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
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px;
        }
        .day {
          border: 1px solid;
          border-radius: 16px;
          padding: 16px;
          display: grid;
          gap: 12px;
        }
        .dayTop {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }
        .dayTop strong {
          color: ${C.ink};
          font-size: 25px;
          line-height: 1;
          font-weight: 950;
          font-variant-numeric: tabular-nums;
        }
        .dayTop span {
          font-size: 17px;
          font-weight: 900;
        }
      `}</style>
    </div>
  )
}

function MiniBar({ label, value, max, color }: { label: string; value: number | null; max: number; color: string }) {
  const width = value == null ? 0 : Math.max(3, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div className="bar">
      <div className="meta">
        <span>{label}</span>
        <strong>{fmt(value)}</strong>
      </div>
      <div className="track">
        <i style={{ width: `${width}%`, background: color }} />
      </div>
      <style jsx>{`
        .bar {
          display: grid;
          gap: 7px;
        }
        .meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: ${C.sub};
          font-size: 17px;
          font-weight: 850;
        }
        .meta strong {
          color: ${C.ink};
          font-variant-numeric: tabular-nums;
        }
        .track {
          height: 9px;
          border-radius: 999px;
          background: rgba(255,255,255,.08);
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

function SupportPanel({ title, color, rows }: { title: string; color: string; rows: [string, string, string][] }) {
  return (
    <article className="support">
      <h3 style={{ color }}>{title}</h3>
      <div className="rows">
        {rows.map(([label, value, meta]) => (
          <div key={label} className="cell">
            <span>{label}</span>
            <strong>{value}</strong>
            <em>{meta}</em>
          </div>
        ))}
      </div>
      <style jsx>{`
        .support {
          min-width: 0;
        }
        h3 {
          margin: 0 0 14px;
          font-size: 28px;
          line-height: 1.15;
          font-weight: 950;
          letter-spacing: -.04em;
        }
        .rows {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .cell {
          min-width: 0;
          border: 1px solid ${C.line};
          border-radius: 16px;
          background: ${C.panel2};
          padding: 18px;
        }
        span {
          display: block;
          color: ${C.sub};
          font-size: 18px;
          font-weight: 850;
        }
        strong {
          display: block;
          margin-top: 12px;
          color: ${C.ink};
          font-size: 22px;
          line-height: 1.2;
          font-weight: 950;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        em {
          display: block;
          margin-top: 8px;
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.3;
          font-style: normal;
          font-weight: 700;
        }
        @media (max-width: 900px) {
          .rows {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </article>
  )
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span style={{
      color,
      border: `1px solid ${color}55`,
      background: `${color}16`,
      borderRadius: 12,
      padding: '9px 13px',
      fontSize: 13,
      fontWeight: 900,
      letterSpacing: '.06em',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}
