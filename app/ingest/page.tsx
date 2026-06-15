'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { PmoShell } from '@/app/components/PmoShell'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  bg: '#080C18',
  panel: '#0F1628',
  border: '#1E2D4A',
  text: '#F1F5F9',
  sub: '#A9B7CC',
  muted: '#6C7D99',
  cyan: '#22D3EE',
  green: '#10B981',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
}

function fmt(n: number | null | undefined) {
  return n == null ? '-' : n.toLocaleString()
}

function range(row?: TableStatus) {
  if (!row?.minDate || !row?.maxDate) return '-'
  return `${row.minDate} ~ ${row.maxDate}`
}

function days(start?: string | null, end?: string | null) {
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
      const callRange = calls[0]
      const rows = await Promise.all(recentDates(callRange.maxDate).map(async (date) => ({
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
  const meterMain = meterTables.find((row) => row.table === 'meter_hourly_logs') ?? meterTables[0]
  const missingRows = useMemo(() => dateRows.filter((row) => !row.callcards || !row.driverLogs || !row.matches), [dateRows])

  return (
    <PmoShell
      active="적재현황"
      kicker="DATA COVERAGE"
      title="호출데이터와 앱미터데이터 적재 범위 확인"
      description="이 화면은 파일을 직접 업로드하지 않습니다. 폴더 자동 적재 기준으로 Supabase에 들어간 날짜 범위와 누락 여부만 확인합니다."
      status="자동 적재 상태"
    >
        {loading && <div style={{ color: C.sub, fontSize: 18 }}>데이터를 불러오는 중입니다.</div>}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 24 }}>
          <Stat title="호출데이터" value={range(callcards)} caption={days(callcards?.minDate, callcards?.maxDate)} color={C.green} />
          <Stat title="앱미터데이터" value={range(meterMain)} caption={meterMain?.label ?? '보조 시장 기준 데이터'} color={C.cyan} />
          <Stat title="콜카드 건수" value={fmt(callcards?.count)} caption="callcard_mbti" color={C.green} />
          <Stat title="누락 확인" value={`${missingRows.length}일`} caption="최근 14일 기준" color={missingRows.length ? C.yellow : C.green} />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 18 }}>
          <Panel title="호출데이터 날짜별 상태" desc="콜카드, 기사 로그, 매칭 결과가 같은 날짜로 맞아야 AI 우선배차 검증에 사용할 수 있습니다.">
            <Table
              headers={['날짜', '콜카드', '기사 로그', '매칭 결과', '상태']}
              rows={dateRows.map((row) => {
                const ok = Boolean(row.callcards && row.driverLogs && row.matches)
                return [row.date, fmt(row.callcards), fmt(row.driverLogs), fmt(row.matches), ok ? '정상' : '확인 필요']
              })}
            />
          </Panel>

          <Panel title="앱미터 적재 상태" desc="앱미터는 기사 MBTI의 주 원천이 아니라 천안 택시 흐름을 보는 보조 데이터입니다.">
            <div style={{ display: 'grid', gap: 10 }}>
              {meterTables.map((row) => (
                <div key={row.table} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, background: '#0B1222' }}>
                  <div style={{ fontSize: 17, fontWeight: 950 }}>{row.label}</div>
                  <div style={{ color: C.cyan, fontSize: 22, fontWeight: 950, marginTop: 8 }}>{fmt(row.count)}</div>
                  <div style={{ color: C.sub, fontSize: 15, marginTop: 6 }}>{range(row)}</div>
                </div>
              ))}
              {meterDates?.slice(-4).map((row) => (
                <div key={row.date} style={{ color: C.muted, fontSize: 15 }}>
                  {row.date}: 시간대 {fmt(row.hourly)}건 / 기사별 {fmt(row.driver)}건
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <Panel title="자동 적재 방식" desc="운영 화면 업로드는 큰 파일에서 실패할 수 있어 폴더 감시 방식으로 전환했습니다.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Code title="호출데이터 자동 감시" command="npm run call:watch" />
            <Code title="앱미터 자동 감시" command="npm run meter:watch" />
          </div>
        </Panel>
    </PmoShell>
  )
}

function Stat({ title, value, caption, color }: { title: string; value: string; caption: string; color: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18, minHeight: 126 }}>
      <div style={{ color: C.sub, fontSize: 16, fontWeight: 850 }}>{title}</div>
      <div style={{ color, fontSize: 26, lineHeight: 1.15, fontWeight: 950, marginTop: 12 }}>{value}</div>
      <div style={{ color: C.muted, fontSize: 15, marginTop: 8 }}>{caption}</div>
    </div>
  )
}

function Panel({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 18 }}>
      <h2 style={{ fontSize: 23, margin: 0, fontWeight: 950 }}>{title}</h2>
      <p style={{ color: C.sub, fontSize: 16, lineHeight: 1.55, margin: '8px 0 16px' }}>{desc}</p>
      {children}
    </section>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        <thead>
          <tr>{headers.map((h) => <th key={h} style={th()}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => <tr key={row[0]}>{row.map((cell, i) => <td key={`${row[0]}-${i}`} style={td(i === row.length - 1 && cell !== '정상' ? C.yellow : C.text)}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

function Code({ title, command }: { title: string; command: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, background: '#0B1222' }}>
      <div style={{ color: C.sub, fontSize: 15, fontWeight: 850 }}>{title}</div>
      <code style={{ display: 'block', color: C.green, fontSize: 18, fontWeight: 900, marginTop: 8 }}>{command}</code>
    </div>
  )
}

function th(): React.CSSProperties {
  return { textAlign: 'left', color: C.sub, padding: '12px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 15 }
}

function td(color = C.text): React.CSSProperties {
  return { color, padding: '12px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 15, fontWeight: 780 }
}
