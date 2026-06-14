import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

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

type MappingImportRow = {
  driver_id: string
  vehicle_id: string
  vehicle_no: string | null
  driver_key: string | null
}

const NULL_VALUES = new Set(['', 'none', 'null', 'n/a', 'na', '-'])
const DRIVER_ID_ALIASES = ['driver_id', 'driverid', '기사id', '기사_id', '드라이버id']
const VEHICLE_ID_ALIASES = ['vehicle_id', 'vehicleid', '차량id', '차량_id']
const VEHICLE_NO_ALIASES = ['vehicle_no', 'vehicle_number', 'vehicle_num', 'car_no', 'car_number', 'plate_no', 'plate', '차량번호', '차량 번호', '차번']
const DRIVER_KEY_ALIASES = ['driver_key', 'driverkey', 'appmeter_driver_key', 'meter_driver_key', '앱미터기사키', '앱미터 기사키', '기사키']

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

function normalizeCell(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return NULL_VALUES.has(text.toLowerCase()) ? null : text
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s_-]/g, '')
}

function pickValue(row: Record<string, unknown>, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader))
  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeHeader(key))) return normalizeCell(value)
  }
  return null
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell)
      if (row.some((item) => item.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  row.push(cell)
  if (row.some((item) => item.trim())) rows.push(row)
  const headers = rows.shift()?.map((item) => item.trim()) ?? []
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])))
}

function normalizeImportRows(rawRows: Record<string, unknown>[]) {
  const rows: MappingImportRow[] = []
  const rejected: { row: number; reason: string }[] = []
  for (const [index, row] of rawRows.entries()) {
    const driverId = pickValue(row, DRIVER_ID_ALIASES)
    const vehicleId = pickValue(row, VEHICLE_ID_ALIASES)
    const vehicleNo = pickValue(row, VEHICLE_NO_ALIASES)
    const driverKey = pickValue(row, DRIVER_KEY_ALIASES)
    if (!driverId || !vehicleId) {
      rejected.push({ row: index + 2, reason: 'driver_id 또는 vehicle_id 누락' })
      continue
    }
    if (!vehicleNo && !driverKey) {
      rejected.push({ row: index + 2, reason: 'vehicle_no 또는 driver_key 누락' })
      continue
    }
    rows.push({ driver_id: driverId, vehicle_id: vehicleId, vehicle_no: vehicleNo, driver_key: driverKey })
  }
  return { rows, rejected }
}

function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
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
      .order('callcard_id', { ascending: true })
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
      .order('driver_id', { ascending: true })
      .order('vehicle_id', { ascending: true })
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

function createSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const source = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'
  if (!supabaseUrl || !supabaseKey) return { source, error: 'Supabase 환경변수가 설정되지 않았습니다.' }
  return { source, supabase: createClient(supabaseUrl, supabaseKey) }
}

export async function GET(request: NextRequest) {
  const client = createSupabase()
  if ('error' in client) return NextResponse.json({ error: client.error }, { status: 500 })
  const { supabase, source } = client
  const detail = request.nextUrl.searchParams.get('detail') === '1'

  try {
    const { count, error } = await supabase.from('driver_vehicle_map').select('driver_id,vehicle_id', { count: 'exact', head: true })
    if (error) throw error
    if (!detail) {
      const [vehicleNoRes, driverKeyRes] = await Promise.all([
        supabase.from('driver_vehicle_map').select('vehicle_no', { count: 'exact', head: true }).not('vehicle_no', 'is', null),
        supabase.from('driver_vehicle_map').select('driver_key', { count: 'exact', head: true }).not('driver_key', 'is', null),
      ])
      if (vehicleNoRes.error) throw vehicleNoRes.error
      if (driverKeyRes.error) throw driverKeyRes.error
      return NextResponse.json({ source, count: count ?? 0, vehicle_no_rows: vehicleNoRes.count ?? 0, driver_key_rows: driverKeyRes.count ?? 0 })
    }

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
  const client = createSupabase()
  if ('error' in client) return NextResponse.json({ error: client.error }, { status: 500 })
  const { supabase, source } = client

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

export async function PATCH(request: NextRequest) {
  const client = createSupabase()
  if ('error' in client) return NextResponse.json({ error: client.error }, { status: 500 })
  const { supabase, source } = client

  try {
    const contentType = request.headers.get('content-type') ?? ''
    let rawRows: Record<string, unknown>[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!(file instanceof File)) return NextResponse.json({ source, error: 'file 필드가 필요합니다.' }, { status: 400 })
      const name = file.name.toLowerCase()
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        rawRows = parseWorkbook(await file.arrayBuffer())
      } else {
        rawRows = parseCsv(await file.text())
      }
    } else {
      const body = await request.json() as { rows?: Record<string, unknown>[] }
      rawRows = body.rows ?? []
    }

    const { rows, rejected } = normalizeImportRows(rawRows)
    if (rows.length === 0) {
      return NextResponse.json({ source, parsed_rows: rawRows.length, updated_rows: 0, rejected_rows: rejected.length, rejected_sample: rejected.slice(0, 10), error: '업데이트할 유효 행이 없습니다.' }, { status: 400 })
    }

    const existing = new Map<string, DriverVehicleMapRow>()
    for (const row of await fetchAllDriverVehicleMap(supabase)) existing.set(mapKey(row.driver_id, row.vehicle_id), row)

    let updatedRows = 0
    let missingRows = 0
    const missingSample: MappingImportRow[] = []
    for (const row of rows) {
      const current = existing.get(mapKey(row.driver_id, row.vehicle_id))
      if (!current) {
        missingRows += 1
        if (missingSample.length < 10) missingSample.push(row)
        continue
      }
      const payload = {
        vehicle_no: row.vehicle_no ?? current.vehicle_no,
        driver_key: row.driver_key ?? current.driver_key,
        source: current.source.includes('mapping_import') ? current.source : `${current.source}+mapping_import`,
        confidence: Math.max(current.confidence ?? 0.7, row.vehicle_no && row.driver_key ? 0.95 : 0.85),
      }
      const { error } = await supabase
        .from('driver_vehicle_map')
        .update(payload)
        .eq('driver_id', row.driver_id)
        .eq('vehicle_id', row.vehicle_id)
      if (error) throw error
      updatedRows += 1
    }

    return NextResponse.json({
      source,
      parsed_rows: rawRows.length,
      accepted_rows: rows.length,
      updated_rows: updatedRows,
      missing_rows: missingRows,
      rejected_rows: rejected.length,
      missing_sample: missingSample,
      rejected_sample: rejected.slice(0, 10),
      message: 'driver_vehicle_map 보강 완료',
    })
  } catch (err) {
    return NextResponse.json({ source, error: errorPayload(err) }, { status: 500 })
  }
}

