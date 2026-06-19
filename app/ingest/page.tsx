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

function isReady(row?: TableStatus) {
  return Boolean(row?.count && row.status !== 'error')
}

function dateRowState(row: DateRow) {
  if (!row.callcards || !row.driverLogs || !row.matches) {
    return { label: '누락', tone: C.yellow, level: 'missing' as const }
  }
  if (row.callcards < 100 || row.driverLogs < 100 || row.matches < 100) {
    return { label: '부분', tone: C.orange, level: 'partial' as const }
  }
  return { label: '정상', tone: C.green, level: 'ok' as const }
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
  const driverVectors = vectorTables.find((row) => row.table === 'driver_mbti')

  const attentionRows = useMemo(
    () => dateRows.filter((row) => dateRowState(row).level !== 'ok'),
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
        <RailMetric label="호출데이터" value={shortRange(callcards)} meta={`${fmt(callcards?.count)}건 · 콜카드 원천`} color={C.green} />
        <RailMetric label="앱미터데이터" value={shortRange(meterHourly)} meta={`${fmt(meterHourly?.count)}건 · 시장 기준 보조`} color={C.cyan} />
        <RailMetric label="기사 22D 벡터" value={fmt(driverVectors?.count)} meta="기사 운행패턴 임베딩" color={C.purple} />
        <RailMetric label="매칭 계산" value={fmt(matching?.count)} meta="콜카드 × 후보기사 Top 10" color={C.orange} />
      </section>

      <div className="workspace">
        <section className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">INGEST TO EMBEDDING</p>
            <h1>호출과 운행 데이터를 22D 매칭 재료로 만들었습니다</h1>
            <p className="lead">
              호출데이터는 콜카드 조건과 기사 반응 로그의 원천이고, 앱미터데이터는 지역 택시 흐름을 보는 보조 기준입니다.
              이 데이터로 콜카드 팩터와 기사 운행패턴 팩터를 만들고, 22D 코사인 유사도 검증까지 연결합니다.
            </p>
          </div>
          <div className="readiness" style={{ '--tone': headlineTone } as CSSProperties}>
            <span>준비 판정</span>
            <strong>{headline}</strong>
            <p>{statusError ?? '콜카드 팩터, 기사 로그, 기사 벡터, 매칭 계산의 핵심 연결을 확인합니다.'}</p>
            <div className="ready-ring"><b>{readyCount}</b><em>/4</em></div>
          </div>
        </section>

        <section className="flow-card">
          <SectionTitle label="CORE FLOW" title="적재 데이터가 매칭 재료가 되는 흐름" />
          <div className="flow-steps">
            <FlowStep no="01" title="호출데이터 적재" body="콜 조건, 기사 ID, 차량 ID, 상태값, 좌표, 예상거리·요금·ETA를 읽습니다." color={C.green} />
            <FlowStep no="02" title="콜카드·기사 로그 생성" body="콜카드는 요청 조건 팩터가 되고, 수락·취소·만료 결과는 기사 반응 로그가 됩니다." color={C.cyan} />
            <FlowStep no="03" title="기사 22D 벡터 생성" body="기사별 누적 반응과 운행패턴을 시간대·요일·거리·요금·상품 기준으로 임베딩합니다." color={C.purple} />
            <FlowStep no="04" title="코사인 유사도 계산" body="콜카드 22D와 기사 22D를 비교해 Top 10 후보 검증 결과를 만듭니다." color={C.orange} />
          </div>
        </section>

        <section className="data-grid">
          <DataSummaryCard
            title="호출데이터"
            subtitle="AI 우선배차의 주 원천"
            color={C.green}
            rows={[
              ['적재 기간', rangeText(callcards)],
              ['콜카드 팩터', `${fmt(callcards?.count)}건`],
              ['기사 반응 로그', `${fmt(driverLogs?.count)}건`],
              ['역할', '콜 조건과 수락·미수락 패턴 생성'],
            ]}
          />
          <DataSummaryCard
            title="앱미터데이터"
            subtitle="기사 MBTI 주 원천이 아닌 시장 기준 보조 데이터"
            color={C.cyan}
            rows={[
              ['적재 기간', rangeText(meterHourly)],
              ['시간대 요약', `${fmt(meterHourly?.count)}건`],
              ['기사별 로그', `${fmt(meterDrivers?.count)}건`],
              ['건수가 적은 이유', '원천 콜 단위가 아니라 일별·시간대 요약 단위'],
            ]}
          />
        </section>

        <section className="result-panel">
          <SectionTitle label="GENERATED OUTPUT" title="적재 이후 생성된 매칭 재료" />
          <div className="result-grid">
            <ResultCard title="콜카드 팩터" value={fmt(callcards?.count)} body="실제 호출 조건을 22D 콜카드 벡터로 변환" color={C.green} />
            <ResultCard title="기사 로그" value={fmt(driverLogs?.count)} body="기사별 콜 수락·취소·만료 반응 패턴 집계" color={C.cyan} />
            <ResultCard title="기사 22D 벡터" value={fmt(driverVectors?.count)} body="누적 운행패턴 기반 driver_mbti 임베딩" color={C.purple} />
            <ResultCard title="매칭 계산" value={fmt(matching?.count)} body="콜카드와 후보기사 Top 10 유사도 계산 결과" color={C.orange} />
          </div>
        </section>

        <section className="attention-panel">
          <SectionTitle label="CHECK POINT" title="확인이 필요한 날짜만 봅니다" />
          <div className="attention-summary">
            <strong style={{ color: attentionRows.length ? C.yellow : C.green }}>{attentionRows.length}일</strong>
            <p>
              전체 날짜를 모두 나열하지 않고, 콜카드·기사 로그·매칭 계산이 비어 있거나 비정상적으로 적은 날짜만 표시합니다.
            </p>
          </div>
          <CoverageTimeline rows={attentionRows} />
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
        .flow-card,
        .data-card,
        .result-panel,
        .attention-panel {
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
          font-size: clamp(46px, 3vw, 58px);
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
          font-size: clamp(42px, 3vw, 54px);
          line-height: 1;
          word-break: keep-all;
        }

        .readiness p {
          max-width: 285px;
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

        .data-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 22px;
          align-items: start;
        }

        .flow-card,
        .result-panel,
        .attention-panel {
          padding: 28px;
        }

        .flow-steps {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .result-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .attention-panel {
          display: grid;
          gap: 18px;
        }

        .attention-summary {
          display: grid;
          grid-template-columns: 160px minmax(0, 1fr);
          gap: 18px;
          align-items: center;
          padding: 18px;
          border: 1px solid ${C.line};
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.64);
        }

        .attention-summary strong {
          font-size: 46px;
          line-height: 1;
        }

        .attention-summary p {
          margin: 0;
          color: ${C.sub};
          font-size: 21px;
          line-height: 1.45;
          font-weight: 700;
        }

        @media (max-width: 1320px) {
          .flow-steps,
          .result-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .top-rail,
          .hero-card,
          .data-grid,
          .flow-steps,
          .result-grid,
          .attention-summary {
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

function FlowStep({ no, title, body, color }: { no: string; title: string; body: string; color: string }) {
  return (
    <article className="flow-step" style={{ '--tone': color } as CSSProperties}>
      <span>{no}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <style jsx>{`
        .flow-step {
          min-height: 230px;
          display: grid;
          align-content: start;
          gap: 13px;
          padding: 22px;
          border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
          border-radius: 8px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 12%, transparent), rgba(15, 23, 42, 0.55));
        }

        span {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          color: var(--tone);
          border: 1px solid color-mix(in srgb, var(--tone) 48%, transparent);
          border-radius: 16px;
          background: rgba(5, 8, 16, 0.58);
          font-size: 22px;
          font-weight: 950;
        }

        h3 {
          margin: 0;
          color: ${C.ink};
          font-size: 26px;
          line-height: 1.14;
        }

        p {
          margin: 0;
          color: ${C.sub};
          font-size: 20px;
          line-height: 1.42;
          font-weight: 680;
        }
      `}</style>
    </article>
  )
}

function DataSummaryCard({
  title,
  subtitle,
  color,
  rows,
}: {
  title: string
  subtitle: string
  color: string
  rows: [string, string][]
}) {
  return (
    <article className="data-card" style={{ '--tone': color } as CSSProperties}>
      <div className="data-head">
        <span>DATA SOURCE</span>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="data-rows">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <style jsx>{`
        .data-card {
          min-width: 0;
          padding: 28px;
          border-color: color-mix(in srgb, var(--tone) 42%, transparent);
        }

        .data-head span {
          color: var(--tone);
          font-size: 20px;
          font-weight: 950;
        }

        h3 {
          margin: 10px 0 0;
          color: ${C.ink};
          font-size: 42px;
          line-height: 1.08;
        }

        p {
          margin: 10px 0 0;
          color: ${C.sub};
          font-size: 21px;
          line-height: 1.42;
          font-weight: 700;
        }

        .data-rows {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 24px;
        }

        .data-rows div {
          min-width: 0;
          min-height: 116px;
          display: grid;
          align-content: center;
          gap: 8px;
          padding: 18px;
          border: 1px solid ${C.line};
          border-radius: 8px;
          background: rgba(5, 8, 16, 0.48);
        }

        .data-rows span {
          color: ${C.muted};
          font-size: 18px;
          font-weight: 900;
        }

        .data-rows strong {
          color: ${C.ink};
          font-size: 23px;
          line-height: 1.22;
          overflow-wrap: anywhere;
        }

        @media (max-width: 760px) {
          .data-rows {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </article>
  )
}

function ResultCard({ title, value, body, color }: { title: string; value: string; body: string; color: string }) {
  return (
    <article className="result-card" style={{ '--tone': color } as CSSProperties}>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{body}</p>
      <style jsx>{`
        .result-card {
          min-width: 0;
          min-height: 210px;
          display: grid;
          align-content: start;
          gap: 12px;
          padding: 22px;
          border: 1px solid color-mix(in srgb, var(--tone) 42%, transparent);
          border-radius: 8px;
          background: linear-gradient(145deg, color-mix(in srgb, var(--tone) 10%, transparent), rgba(15, 23, 42, 0.58));
        }

        span {
          color: var(--tone);
          font-size: 21px;
          font-weight: 950;
        }

        strong {
          color: ${C.ink};
          font-size: 38px;
          line-height: 1.05;
          overflow-wrap: anywhere;
        }

        p {
          margin: 0;
          color: ${C.sub};
          font-size: 20px;
          line-height: 1.42;
          font-weight: 700;
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
        const state = dateRowState(row)
        const tone = state.tone
        const max = Math.max(row.callcards ?? 0, row.driverLogs ?? 0, row.matches ?? 0, 1)
        return (
          <article key={row.date} className="date-card" style={{ '--tone': tone } as CSSProperties}>
            <div className="date-head">
              <strong>{row.date.slice(5)}</strong>
              <span>{state.label}</span>
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

function Pill({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span style={{ color, border: `1px solid ${color}66`, background: `${color}18`, borderRadius: 8, padding: '10px 14px', fontSize: 16, fontWeight: 900 }}>
      {children}
    </span>
  )
}
