'use client'

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
  bg: '#050810',
  panel: 'rgba(10, 16, 29, 0.88)',
  panel2: 'rgba(15, 23, 42, 0.72)',
  ink: '#F8FAFC',
  sub: '#B8C7DE',
  muted: '#8290A8',
  line: 'rgba(148, 163, 184, 0.22)',
  cyan: '#22D3EE',
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#FB923C',
  red: '#F43F5E',
  purple: '#8B5CF6',
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

function dayCount(start?: string | null, end?: string | null) {
  if (!start || !end) return '-'
  const diff = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()
  return `${Math.max(0, Math.round(diff / 86400000) + 1)}일`
}

function tableState(row?: TableStatus) {
  if (!row) return '확인 필요'
  if (row.status === 'error') return '오류'
  if (row.status === 'empty' || !row.count) return '데이터 없음'
  return '정상'
}

function tableTone(row?: TableStatus) {
  if (row?.status === 'error') return C.red
  if (!row || row.status === 'empty' || !row.count) return C.yellow
  return C.green
}

function isReady(row?: TableStatus) {
  return Boolean(row?.count && row.status !== 'error')
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
  const meterDaily = meterTables.find((row) => row.table === 'meter_daily_logs')
  const driverVectors = vectorTables.find((row) => row.table === 'driver_mbti')

  const missingRows = useMemo(
    () => dateRows.filter((row) => !row.callcards || !row.driverLogs || !row.matches),
    [dateRows],
  )

  const readyCount = [callcards, driverLogs, driverVectors, matching].filter(isReady).length
  const coreReady = Boolean(isReady(callcards) && isReady(driverLogs) && isReady(driverVectors))
  const headline = loading ? '확인 중' : coreReady ? '데이터 준비됨' : '확인 필요'
  const headlineTone = loading ? C.cyan : coreReady ? C.green : C.yellow

  return (
    <main className="page">
      <PrimaryNav
        active="/ingest"
        title="Happycall PMO"
        subtitle="Data Readiness"
        rightSlot={<><Pill color={C.green}>READ ONLY</Pill><Pill color={C.cyan}>SUPABASE</Pill></>}
      />

      <section className="top-rail" aria-label="데이터 적재 핵심 지표">
        <RailMetric label="호출데이터" value={shortRange(callcards)} meta={`${dayCount(callcards?.minDate, callcards?.maxDate)} · ${fmt(callcards?.count)}건`} color={C.green} />
        <RailMetric label="앱미터데이터" value={shortRange(meterHourly)} meta={`${dayCount(meterHourly?.minDate, meterHourly?.maxDate)} · ${fmt(meterHourly?.count)}건`} color={C.cyan} />
        <RailMetric label="기사 벡터" value={fmt(driverVectors?.count)} meta="driver_mbti 22D" color={C.purple} />
        <RailMetric label="매칭 결과" value={fmt(matching?.count)} meta="Top 10 저장 결과" color={C.orange} />
      </section>

      <div className="workspace">
        <section className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">DATA READINESS</p>
            <h1>AI 우선배차 검증 데이터가 어디까지 준비됐는지 봅니다</h1>
            <p className="lead">
              이 화면은 파일 업로드가 아니라 운영 데이터 준비 상태를 보는 관제 화면입니다.
              호출데이터, 앱미터데이터, 기사 벡터, 매칭 계산이 날짜별로 이어졌는지 확인합니다.
            </p>
          </div>
          <div className="readiness" style={{ '--tone': headlineTone } as CSSProperties}>
            <span>현재 상태</span>
            <strong>{headline}</strong>
            <p>{statusError ?? status?.message ?? 'Supabase 테이블 상태를 확인하고 있습니다.'}</p>
            <div className="ready-ring"><b>{readyCount}</b><em>/4</em></div>
          </div>
        </section>

        <section className="main-grid">
          <aside className="left-stack">
            <SectionTitle label="DATA COVERAGE" title="적재 범위" />
            <CoverageCard title="호출데이터" row={callcards} color={C.green} description="콜카드 팩터와 수락·미수락 기준" />
            <CoverageCard title="기사 로그" row={driverLogs} color={C.cyan} description="기사별 호출 반응과 운행 패턴 기초" />
            <CoverageCard title="앱미터데이터" row={meterHourly} color={C.purple} description="천안 택시 흐름과 시장 기준 보조 데이터" />
          </aside>

          <section className="center-stage">
            <SectionTitle label="DATE TIMELINE" title="날짜별 연결 상태" />
            <CoverageTimeline rows={dateRows} />
          </section>

          <aside className="right-stack">
            <SectionTitle label="AUTOMATION" title="자동 적재 파이프라인" />
            <CommandCard title="호출데이터 자동 적재" command="npm run call:watch" color={C.green} />
            <CommandCard title="앱미터 자동 적재" command="npm run meter:watch" color={C.cyan} />
            <NoticeCard title="중요" body="Vercel 화면이 폴더를 직접 감시하는 것이 아닙니다. PC 또는 서버에서 watch 프로세스가 실행되어야 새 파일이 Supabase로 들어갑니다." color={C.orange} />
            <NoticeCard title="운영 기준" body="앱미터는 기사 MBTI의 주 원천이 아니라 지역별 택시 흐름과 시장 기준을 보는 보조 데이터입니다." color={C.purple} />
          </aside>
        </section>

        <section className="bottom-grid">
          <SupportPanel title="앱미터 보조 기준" color={C.cyan} rows={[
            ['시간대 로그', rangeText(meterHourly), fmt(meterHourly?.count)],
            ['기사별 로그', rangeText(meterDrivers), fmt(meterDrivers?.count)],
            ['일별 요약', rangeText(meterDaily), fmt(meterDaily?.count)],
          ]} />
          <SupportPanel title="누락 확인" color={missingRows.length ? C.yellow : C.green} rows={[
            ['최근 14일 누락', `${missingRows.length}일`, missingRows.length ? '확인 필요' : '정상'],
            ['호출-기사 연결', tableState(driverLogs), rangeText(driverLogs)],
            ['매칭 계산', tableState(matching), rangeText(matching)],
          ]} />
        </section>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          color: ${C.ink};
          background:
            linear-gradient(90deg, rgba(34, 211, 238, 0.045) 1px, transparent 1px),
            linear-gradient(180deg, rgba(34, 211, 238, 0.035) 1px, transparent 1px),
            radial-gradient(circle at 18% 12%, rgba(34, 211, 238, 0.14), transparent 30rem),
            radial-gradient(circle at 82% 14%, rgba(139, 92, 246, 0.12), transparent 28rem),
            ${C.bg};
          background-size: 72px 72px, 72px 72px, auto, auto, auto;
          font-family: Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .top-rail {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-bottom: 1px solid ${C.line};
          background: rgba(5, 8, 16, 0.88);
        }

        .workspace {
          width: 100%;
          max-width: 1760px;
          margin: 0 auto;
          padding: 28px;
          display: grid;
          gap: 22px;
        }

        .hero-card,
        .left-stack,
        .center-stage,
        .right-stack,
        .support-panel {
          border: 1px solid ${C.line};
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(5, 8, 16, 0.86));
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .hero-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 24px;
          padding: 34px;
          align-items: stretch;
        }

        .hero-copy {
          display: grid;
          align-content: center;
          gap: 14px;
        }

        .eyebrow {
          margin: 0;
          color: ${C.cyan};
          font-size: 20px;
          line-height: 1.2;
          font-weight: 900;
        }

        h1 {
          max-width: 980px;
          margin: 0;
          font-size: 58px;
          line-height: 1.06;
          letter-spacing: 0;
        }

        .lead {
          max-width: 940px;
          margin: 0;
          color: ${C.sub};
          font-size: 22px;
          line-height: 1.55;
          font-weight: 650;
        }

        .readiness {
          position: relative;
          min-height: 250px;
          display: grid;
          align-content: center;
          gap: 10px;
          padding: 26px;
          border: 1px solid color-mix(in srgb, var(--tone) 48%, transparent);
          border-radius: 8px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 13%, transparent), rgba(15, 23, 42, 0.64));
          overflow: hidden;
        }

        .readiness span {
          color: ${C.sub};
          font-size: 20px;
          font-weight: 900;
        }

        .readiness strong {
          color: var(--tone);
          font-size: 54px;
          line-height: 1;
        }

        .readiness p {
          max-width: 270px;
          margin: 0;
          color: ${C.sub};
          font-size: 19px;
          line-height: 1.45;
          font-weight: 650;
        }

        .ready-ring {
          position: absolute;
          right: 24px;
          bottom: 24px;
          width: 94px;
          height: 94px;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--tone) 52%, transparent);
          border-radius: 50%;
          background: rgba(5, 8, 16, 0.54);
        }

        .ready-ring b {
          color: var(--tone);
          font-size: 38px;
          line-height: 1;
        }

        .ready-ring em {
          margin-top: -24px;
          color: ${C.sub};
          font-size: 18px;
          font-style: normal;
          font-weight: 800;
        }

        .main-grid {
          display: grid;
          grid-template-columns: 330px minmax(0, 1fr) 340px;
          gap: 22px;
          align-items: start;
        }

        .left-stack,
        .right-stack,
        .center-stage {
          min-width: 0;
          padding: 24px;
        }

        .left-stack,
        .right-stack {
          display: grid;
          gap: 16px;
          align-content: start;
        }

        .center-stage {
          min-height: 620px;
        }

        .bottom-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 22px;
        }

        @media (max-width: 1320px) {
          .main-grid {
            grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr);
          }

          .right-stack {
            grid-column: 1 / -1;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .top-rail,
          .hero-card,
          .main-grid,
          .bottom-grid,
          .right-stack {
            grid-template-columns: 1fr;
          }

          .workspace {
            padding: 18px;
          }

          h1 {
            font-size: 40px;
          }

          .lead {
            font-size: 20px;
          }

          .center-stage {
            min-height: auto;
          }
        }
      `}</style>
    </main>
  )
}

function RailMetric({ label, value, meta, color }: { label: string; value: string; meta: string; color: string }) {
  return (
    <article className="rail-metric">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
      <p>{meta}</p>
      <style jsx>{`
        .rail-metric {
          min-height: 106px;
          display: grid;
          align-content: center;
          gap: 5px;
          padding: 18px 24px;
          border-right: 1px solid ${C.line};
        }

        span {
          color: ${C.muted};
          font-size: 18px;
          font-weight: 900;
        }

        strong {
          min-width: 0;
          font-size: 30px;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        p {
          margin: 0;
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </article>
  )
}

function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="section-title">
      <span>{label}</span>
      <h2>{title}</h2>
      <style jsx>{`
        .section-title {
          display: grid;
          gap: 7px;
          margin-bottom: 16px;
        }

        span {
          color: ${C.muted};
          font-size: 18px;
          font-weight: 900;
        }

        h2 {
          margin: 0;
          color: ${C.ink};
          font-size: 30px;
          line-height: 1.15;
        }
      `}</style>
    </div>
  )
}

function CoverageCard({ title, row, color, description }: { title: string; row?: TableStatus; color: string; description: string }) {
  const tone = tableTone(row) || color
  return (
    <article className="coverage" style={{ '--tone': tone } as CSSProperties}>
      <div className="coverage-head">
        <h3>{title}</h3>
        <span>{tableState(row)}</span>
      </div>
      <strong>{rangeText(row)}</strong>
      <p>{dayCount(row?.minDate, row?.maxDate)} · {fmt(row?.count)}건</p>
      <em>{row?.error ?? description}</em>
      <style jsx>{`
        .coverage {
          display: grid;
          gap: 10px;
          padding: 18px;
          border: 1px solid color-mix(in srgb, var(--tone) 44%, transparent);
          border-radius: 8px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 10%, transparent), rgba(15, 23, 42, 0.5));
        }

        .coverage-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        h3 {
          margin: 0;
          color: ${C.ink};
          font-size: 23px;
          line-height: 1.18;
        }

        span {
          color: var(--tone);
          font-size: 18px;
          font-weight: 900;
          white-space: nowrap;
        }

        strong {
          color: ${C.ink};
          font-size: 22px;
          line-height: 1.22;
          word-break: keep-all;
        }

        p,
        em {
          margin: 0;
          color: ${C.sub};
          font-size: 19px;
          line-height: 1.42;
          font-style: normal;
          font-weight: 650;
        }
      `}</style>
    </article>
  )
}

function CoverageTimeline({ rows }: { rows: DateRow[] }) {
  if (!rows.length) {
    return (
      <div className="empty-timeline">
        날짜별 적재 현황을 표시할 데이터가 없습니다. Supabase 연결 또는 날짜별 조회 API를 확인해야 합니다.
        <style jsx>{`
          .empty-timeline {
            margin-top: 18px;
            padding: 24px;
            border: 1px solid rgba(245, 158, 11, 0.42);
            border-radius: 8px;
            color: ${C.yellow};
            background: rgba(245, 158, 11, 0.1);
            font-size: 21px;
            line-height: 1.5;
            font-weight: 750;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="timeline">
      {rows.map((row) => {
        const ok = Boolean(row.callcards && row.driverLogs && row.matches)
        const tone = ok ? C.green : C.yellow
        const max = Math.max(row.callcards ?? 0, row.driverLogs ?? 0, row.matches ?? 0, 1)
        return (
          <article key={row.date} className="date-card" style={{ '--tone': tone } as CSSProperties}>
            <div className="date-head">
              <strong>{row.date.slice(5)}</strong>
              <span>{ok ? '정상' : '확인'}</span>
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
          grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
          gap: 14px;
        }

        .date-card {
          min-height: 170px;
          display: grid;
          align-content: space-between;
          gap: 12px;
          padding: 16px;
          border: 1px solid color-mix(in srgb, var(--tone) 44%, transparent);
          border-radius: 8px;
          background: linear-gradient(145deg, color-mix(in srgb, var(--tone) 9%, transparent), rgba(15, 23, 42, 0.58));
        }

        .date-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .date-head strong {
          color: ${C.ink};
          font-size: 24px;
          line-height: 1;
        }

        .date-head span {
          color: var(--tone);
          font-size: 18px;
          font-weight: 900;
        }
      `}</style>
    </div>
  )
}

function MiniBar({ label, value, max, color }: { label: string; value: number | null; max: number; color: string }) {
  const width = value == null ? 0 : Math.max(4, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div className="mini-bar">
      <div className="mini-meta">
        <span>{label}</span>
        <strong>{fmt(value)}</strong>
      </div>
      <div className="track"><i style={{ width: `${width}%`, background: color }} /></div>
      <style jsx>{`
        .mini-bar {
          display: grid;
          gap: 7px;
        }

        .mini-meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: ${C.sub};
          font-size: 18px;
          font-weight: 750;
        }

        .mini-meta strong {
          color: ${C.ink};
          font-size: 18px;
          font-weight: 900;
        }

        .track {
          height: 9px;
          border-radius: 999px;
          background: rgba(130, 144, 168, 0.2);
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

function CommandCard({ title, command, color }: { title: string; command: string; color: string }) {
  return (
    <article className="command" style={{ '--tone': color } as CSSProperties}>
      <span>{title}</span>
      <code>{command}</code>
      <style jsx>{`
        .command {
          display: grid;
          gap: 10px;
          padding: 18px;
          border: 1px solid color-mix(in srgb, var(--tone) 44%, transparent);
          border-radius: 8px;
          background: color-mix(in srgb, var(--tone) 9%, transparent);
        }

        span {
          color: var(--tone);
          font-size: 20px;
          font-weight: 900;
        }

        code {
          min-width: 0;
          color: ${C.ink};
          font-size: 21px;
          line-height: 1.25;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </article>
  )
}

function NoticeCard({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <article className="notice" style={{ '--tone': color } as CSSProperties}>
      <h3>{title}</h3>
      <p>{body}</p>
      <style jsx>{`
        .notice {
          padding: 18px;
          border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
          border-radius: 8px;
          background: color-mix(in srgb, var(--tone) 9%, transparent);
        }

        h3 {
          margin: 0;
          color: var(--tone);
          font-size: 22px;
          line-height: 1.2;
        }

        p {
          margin: 10px 0 0;
          color: ${C.sub};
          font-size: 20px;
          line-height: 1.45;
          font-weight: 650;
        }
      `}</style>
    </article>
  )
}

function SupportPanel({ title, color, rows }: { title: string; color: string; rows: [string, string, string][] }) {
  return (
    <article className="support-panel">
      <h3 style={{ color }}>{title}</h3>
      <div className="support-rows">
        {rows.map(([label, value, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <em>{count}</em>
          </div>
        ))}
      </div>
      <style jsx>{`
        .support-panel {
          padding: 24px;
        }

        h3 {
          margin: 0 0 18px;
          font-size: 28px;
          line-height: 1.15;
        }

        .support-rows {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .support-rows div {
          min-width: 0;
          padding: 18px;
          border: 1px solid ${C.line};
          border-radius: 8px;
          background: ${C.panel2};
        }

        span,
        em {
          display: block;
          color: ${C.sub};
          font-size: 18px;
          line-height: 1.35;
          font-style: normal;
          font-weight: 700;
        }

        strong {
          display: block;
          min-width: 0;
          margin: 9px 0;
          color: ${C.ink};
          font-size: 22px;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (max-width: 860px) {
          .support-rows {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </article>
  )
}

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span style={{ color, border: `1px solid ${color}66`, background: `${color}18`, borderRadius: 8, padding: '10px 14px', fontSize: 16, fontWeight: 900 }}>
      {children}
    </span>
  )
}
