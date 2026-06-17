import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type TableStatus = {
  table: string
  label: string
  count: number | null
  minDate: string | null
  maxDate: string | null
  status: 'ok' | 'empty' | 'error'
  importance: 'core' | 'optional'
  error?: string
}

type DateRow = {
  date: string
  callcards: number | null
  driverLogs: number | null
  matches: number | null
}

function envPresent(name: string) {
  return Boolean(process.env[name])
}

function source() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'
}

function readableError(message: string | undefined) {
  return message?.trim() || 'Check table access or table status.'
}

async function tableStatus(
  supabase: SupabaseClient,
  table: string,
  label: string,
  dateColumn: string,
  importance: TableStatus['importance'] = 'core',
): Promise<TableStatus> {
  const { count, error } = await supabase.from(table).select('*', { count: 'planned', head: true })
  if (error) {
    return { table, label, count: null, minDate: null, maxDate: null, status: 'error', importance, error: readableError(error.message) }
  }

  const [minRes, maxRes] = await Promise.all([
    supabase.from(table).select(dateColumn).order(dateColumn, { ascending: true }).limit(1),
    supabase.from(table).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
  ])
  const rangeError = minRes.error?.message ?? maxRes.error?.message
  if (rangeError) {
    return { table, label, count: count ?? 0, minDate: null, maxDate: null, status: 'error', importance, error: readableError(rangeError) }
  }

  const minDate = (minRes.data?.[0] as Record<string, string> | undefined)?.[dateColumn] ?? null
  const maxDate = (maxRes.data?.[0] as Record<string, string> | undefined)?.[dateColumn] ?? null

  return {
    table,
    label,
    count: count ?? 0,
    minDate,
    maxDate,
    status: count ? 'ok' : 'empty',
    importance,
  }
}

async function countByDate(supabase: SupabaseClient, table: string, column: string, date: string) {
  const { count, error } = await supabase.from(table).select('*', { count: 'planned', head: true }).eq(column, date)
  return error ? null : count ?? 0
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

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: envPresent('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: envPresent('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: envPresent('SUPABASE_SERVICE_ROLE_KEY'),
    ANTHROPIC_API_KEY: envPresent('ANTHROPIC_API_KEY'),
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      ok: false,
      source: 'none',
      env,
      message: 'Missing Supabase environment variables.',
      callTables: [],
      meterTables: [],
      vectorTables: [],
      dateRows: [],
      watchProcesses: [
        { name: 'Call data watch', command: 'npm run call:watch', runsInVercel: false },
        { name: 'Meter data watch', command: 'npm run meter:watch', runsInVercel: false },
      ],
    }, { status: 200 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const [callTables, meterTables, vectorTables] = await Promise.all([
    Promise.all([
      tableStatus(supabase, 'callcard_mbti', 'Callcards', 'call_date'),
      tableStatus(supabase, 'driver_daily_logs', 'Driver call logs', 'service_date'),
      tableStatus(supabase, 'matching_scores', 'Matching Top 10', 'match_date', 'optional'),
    ]),
    Promise.all([
      tableStatus(supabase, 'meter_hourly_logs', 'Meter hourly', 'log_date'),
      tableStatus(supabase, 'meter_driver_logs', 'Meter drivers', 'log_date'),
      tableStatus(supabase, 'meter_daily_logs', 'Meter daily', 'service_date', 'optional'),
    ]),
    Promise.all([
      tableStatus(supabase, 'driver_mbti', 'Driver 22D vectors', 'updated_at'),
      tableStatus(supabase, 'callcard_profile', 'Callcard profiles', 'created_at', 'optional'),
    ]),
  ])

  const callcards = callTables.find((row) => row.table === 'callcard_mbti')
  const dateRows: DateRow[] = await Promise.all(recentDates(callcards?.maxDate).map(async (date) => ({
    date,
    callcards: await countByDate(supabase, 'callcard_mbti', 'call_date', date),
    driverLogs: await countByDate(supabase, 'driver_daily_logs', 'service_date', date),
    matches: await countByDate(supabase, 'matching_scores', 'match_date', date),
  })))

  const allTables = [...callTables, ...meterTables, ...vectorTables]
  const hasCoreError = allTables.some((row) => row.importance === 'core' && row.status === 'error')
  const hasOptionalWarning = allTables.some((row) => row.importance === 'optional' && row.status === 'error')

  return NextResponse.json({
    ok: !hasCoreError,
    source: source(),
    env,
    message: hasCoreError
      ? 'Core ingest table check failed.'
      : hasOptionalWarning
        ? 'Core data is ready. Some optional tables need review.'
        : 'Supabase status check is normal.',
    callTables,
    meterTables,
    vectorTables,
    dateRows,
    watchProcesses: [
      { name: 'Call data watch', command: 'npm run call:watch', runsInVercel: false },
      { name: 'Meter data watch', command: 'npm run meter:watch', runsInVercel: false },
    ],
  })
}
