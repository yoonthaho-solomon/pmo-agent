import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type CallcardIdentifierRow = {
  driver_id: string | null
  vehicle_id: string | null
  asp_id: number | null
  call_date: string | null
}

type DriverVehicleMapRow = {
  driver_id: string
  vehicle_id: string
  vehicle_no: string | null
  driver_key: string | null
  asp_id: number | null
  first_call_date: string | null
  last_call_date: string | null
  call_count: number
  source: string
  confidence: number
}

function errorPayload(err: unknown) {
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    return {
      message: typeof record.message === 'string' ? record.message : JSON.stringify(record),
      code: typeof record.code === 'string' ? record.code : undefined,
      hint: typeof record.hint === 'string' ? record.hint : undefined,
      details: typeof record.details === 'string' ? record.details : undefined,
    }
  }
  return { message: String(err) }
}

async function fetchAllCallcardIdentifiers(supabase: SupabaseClient, maxRows = 300000): Promise<CallcardIdentifierRow[]> {
  const all: CallcardIdentifierRow[] = []
  const page = 1000
  for (let from = 0; from < maxRows; from += page) {
    const { data, error } = await supabase
      .from('callcard_mbti')
      .select('driver_id,vehicle_id,asp_id,call_date')
      .not('driver_id', 'is', null)
      .not('vehicle_id', 'is', null)
      .range(from, from + page - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as CallcardIdentifierRow[]))
    if (data.length < page) break
  }
  return all
}

async function fetchAllDriverVehicleMap(supabase: SupabaseClient, maxRows = 50000): Promise<DriverVehicleMapRow[]> {
  const all: DriverVehicleMapRow[] = []
  const page = 1000
  for (let from = 0; from < maxRows; from += page) {
    const { data, error } = await supabase
      .from('driver_vehicle_map')
      .select('driver_id,vehicle_id,vehicle_no,driver_key,asp_id,first_call_date,last_call_date,call_count,source,confidence')
      .range(from, from + page - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as DriverVehicleMapRow[]))
    if (data.length < page) break
  }
  return all
}

function mapKey(driverId: string, vehicleId: string) {
  return `${driverId}::${vehicleId}`
}

function buildMapRows(rows: CallcardIdentifierRow[]): DriverVehicleMapRow[] {
  const grouped = new Map<string, DriverVehicleMapRow>()
  for (const row of rows) {
    const driverId = row.driver_id?.trim()
    const vehicleId = row.vehicle_id?.trim()
    if (!driverId || !vehicleId) continue
    const key = mapKey(driverId, vehicleId)
    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, {
        driver_id: driverId,
        vehicle_id: vehicleId,
        vehicle_no: null,
        driver_key: null,
        asp_id: null,
        first_call_date: row.call_date ?? null,
        last_call_date: row.call_date ?? null,
        call_count: 1,
        source: 'callcard_mbti',
        confidence: 0.7,
      })
      continue
    }
    current.call_count += 1
    if (row.call_date && (!current.first_call_date || row.call_date < current.first_call_date)) current.first_call_date = row.call_date
    if (row.call_date && (!current.last_call_date || row.call_date > current.last_call_date)) current.last_call_date = row.call_date
  }
  return Array.from(grouped.values())
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const source = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const detail = request.nextUrl.searchParams.get('detail') === '1'

  try {
    const { count, error } = await supabase.from('driver_vehicle_map').select('driver_id,vehicle_id', { count: 'exact', head: true })
    if (error) throw error
    if (!detail) return NextResponse.json({ source, count: count ?? 0 })

    const [identifiers, tableRows] = await Promise.all([
      fetchAllCallcardIdentifiers(supabase),
      fetchAllDriverVehicleMap(supabase),
    ])
    const expectedRows = buildMapRows(identifiers)
    const expectedKeys = new Set(expectedRows.map((row) => mapKey(row.driver_id, row.vehicle_id)))
    const tableKeys = new Set(tableRows.map((row) => mapKey(row.driver_id, row.vehicle_id)))
    const staleRows = tableRows.filter((row) => !expectedKeys.has(mapKey(row.driver_id, row.vehicle_id)))
    const missingRows = expectedRows.filter((row) => !tableKeys.has(mapKey(row.driver_id, row.vehicle_id)))

    return NextResponse.json({
      source,
      input_rows: identifiers.length,
      expected_map_rows: expectedRows.length,
      table_rows: tableRows.length,
      stale_rows: staleRows.length,
      missing_rows: missingRows.length,
      stale_sample: staleRows.slice(0, 10),
      missing_sample: missingRows.slice(0, 10),
      vehicle_no_rows: tableRows.filter((row) => row.vehicle_no).length,
      driver_key_rows: tableRows.filter((row) => row.driver_key).length,
    })
  } catch (err) {
    return NextResponse.json({ source, error: errorPayload(err) }, { status: 500 })
  }
}

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const source = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const identifiers = await fetchAllCallcardIdentifiers(supabase)
    const mapRows = buildMapRows(identifiers)
    const batch = 500
    for (let i = 0; i < mapRows.length; i += batch) {
      const chunk = mapRows.slice(i, i + batch)
      const { error } = await supabase.from('driver_vehicle_map').upsert(chunk, { onConflict: 'driver_id,vehicle_id' })
      if (error) throw error
    }

    const uniqueDrivers = new Set(mapRows.map((row) => row.driver_id)).size
    const uniqueVehicles = new Set(mapRows.map((row) => row.vehicle_id)).size

    return NextResponse.json({
      source,
      input_rows: identifiers.length,
      map_rows: mapRows.length,
      unique_drivers: uniqueDrivers,
      unique_vehicles: uniqueVehicles,
      message: 'driver_vehicle_map 생성 완료',
    })
  } catch (err) {
    return NextResponse.json({ source, error: errorPayload(err) }, { status: 500 })
  }
}
