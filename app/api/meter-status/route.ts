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

  return NextResponse.json({ source, tables })
}
