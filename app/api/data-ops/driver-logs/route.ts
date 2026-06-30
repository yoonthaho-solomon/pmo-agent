import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// driver_daily_logs is the behavioral source aggregated into driver_mbti's 22D scores.
// It isn't part of get_data_ops_summary, so this lightweight route supplies its load stats.
export type DriverLogsStats = {
  total: number
  minDate: string | null
  maxDate: string | null
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json({ ok: false, message: 'Missing Supabase env' }, { status: 500 })
  }

  const supabase = createClient(url, key)

  const { count, error: countError } = await supabase
    .from('driver_daily_logs')
    .select('*', { count: 'exact', head: true })
  if (countError) {
    return NextResponse.json({ ok: false, message: countError.message }, { status: 502 })
  }

  const { data: minRow } = await supabase
    .from('driver_daily_logs')
    .select('service_date')
    .order('service_date', { ascending: true })
    .limit(1)
  const { data: maxRow } = await supabase
    .from('driver_daily_logs')
    .select('service_date')
    .order('service_date', { ascending: false })
    .limit(1)

  const data: DriverLogsStats = {
    total: count ?? 0,
    minDate: minRow?.[0]?.service_date ?? null,
    maxDate: maxRow?.[0]?.service_date ?? null,
  }

  return NextResponse.json({ ok: true, data })
}
