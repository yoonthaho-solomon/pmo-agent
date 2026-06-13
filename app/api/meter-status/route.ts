import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type MeterTableStatus = {
  table: string
  label: string
  count: number | null
  minDate: string | null
  maxDate: string | null
  error?: string
}

type MeterDateCount = {
  date: string
  hourly: number | null
  driver: number | null
}

async function tableStatus(
  supabase: SupabaseClient,
  table: string,
  label: string,
  dateColumn: string,
): Promise<MeterTableStatus> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) return { table, label, count: null, minDate: null, maxDate: null, error: error.message }

  const [minRes, maxRes] = await Promise.all([
    supabase.from(table).select(dateColumn).order(dateColumn, { ascending: true }).limit(1),
    supabase.from(table).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
  ])

  const minDate = (minRes.data?.[0] as Record<string, string> | undefined)?.[dateColumn] ?? null
  const maxDate = (maxRes.data?.[0] as Record<string, string> | undefined)?.[dateColumn] ?? null
  const rangeError = minRes.error?.message ?? maxRes.error?.message

  return { table, label, count: count ?? 0, minDate, maxDate, error: rangeError }
}

async function countByDate(supabase: SupabaseClient, table: string, column: string, date: string): Promise<number | null> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, date)
  return error ? null : count ?? 0
}

async function meterDateCounts(supabase: SupabaseClient, tables: MeterTableStatus[]): Promise<MeterDateCount[]> {
  const hourly = tables.find((item) => item.table === 'meter_hourly_logs')
  const driver = tables.find((item) => item.table === 'meter_driver_logs')
  const dates = Array.from(new Set(['2026-06-08', hourly?.maxDate, driver?.maxDate].filter(Boolean) as string[]))
  return Promise.all(dates.map(async (date) => ({
    date,
    hourly: await countByDate(supabase, 'meter_hourly_logs', 'log_date', date),
    driver: await countByDate(supabase, 'meter_driver_logs', 'log_date', date),
  })))
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const source = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const tables = await Promise.all([
    tableStatus(supabase, 'meter_daily_logs', '앱미터 일별', 'service_date'),
    tableStatus(supabase, 'meter_hourly_logs', '앱미터 시간대', 'log_date'),
    tableStatus(supabase, 'meter_driver_logs', '앱미터 기사별', 'log_date'),
  ])

  const dateCounts = await meterDateCounts(supabase, tables)

  return NextResponse.json({ source, tables, dateCounts })
}
