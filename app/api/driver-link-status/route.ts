import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type MeterDriverSample = {
  driver_key: string | null
  log_date: string | null
  asp_id: number | null
}

type DriverDailySample = {
  driver_id: string | null
  service_date: string | null
  asp_id: number | null
}

async function fetchAll<T>(supabase: SupabaseClient, table: string, columns: string, limit = 10000): Promise<T[]> {
  const all: T[] = []
  const page = 1000
  for (let from = 0; from < limit; from += page) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + page - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < page) break
  }
  return all
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const source = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const [meterRows, driverRows] = await Promise.all([
      fetchAll<MeterDriverSample>(supabase, 'meter_driver_logs', 'driver_key,log_date,asp_id'),
      fetchAll<DriverDailySample>(supabase, 'driver_daily_logs', 'driver_id,service_date,asp_id'),
    ])

    const meterKeys = Array.from(new Set(meterRows.map((row) => row.driver_key).filter(Boolean) as string[]))
    const driverIds = Array.from(new Set(driverRows.map((row) => row.driver_id).filter(Boolean) as string[]))
    const driverIdSet = new Set(driverIds)
    const directMatches = meterKeys.filter((key) => driverIdSet.has(key))
    const meterDates = Array.from(new Set(meterRows.map((row) => row.log_date).filter(Boolean) as string[])).sort()
    const driverDates = new Set(driverRows.map((row) => row.service_date).filter(Boolean) as string[])
    const overlappingDates = meterDates.filter((date) => driverDates.has(date))

    return NextResponse.json({
      source,
      meterDriverRows: meterRows.length,
      meterDistinctDriverKeys: meterKeys.length,
      driverDailyRows: driverRows.length,
      driverDistinctIds: driverIds.length,
      directMatchCount: directMatches.length,
      directMatchRate: meterKeys.length ? directMatches.length / meterKeys.length : 0,
      meterDateRange: { min: meterDates[0] ?? null, max: meterDates[meterDates.length - 1] ?? null },
      overlappingDates,
      samples: {
        meterDriverKeys: meterKeys.slice(0, 5),
        driverIds: driverIds.slice(0, 5),
        directMatches: directMatches.slice(0, 5),
      },
      conclusion: directMatches.length > 0
        ? 'driver_key와 driver_id의 직접 매칭 후보가 있습니다.'
        : '현재 저장 테이블만으로는 driver_key와 driver_id가 직접 연결되지 않습니다. 별도 매핑 키 또는 매핑 테이블이 필요합니다.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ source, error: message }, { status: 500 })
  }
}

