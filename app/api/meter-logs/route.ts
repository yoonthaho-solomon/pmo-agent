import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { logAgentRun } from '@/lib/agent-logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ASP_ID = 147000000000

// 파일명에서 날짜 추출: 통계_천안_20260608_20260608.xlsx → 2026-06-08
function extractDateFromFilename(filename: string): string | null {
  const m = filename.match(/통계_천안_(\d{4})(\d{2})(\d{2})_/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

interface SheetRow {
  driver_key?: string | number
  start_hour?: string | number
  work_hour?: string | number
  travel_min?: string | number
  dist_km?: string | number
  empty_km?: string | number
  ride_count?: string | number
  earning?: string | number
  earning_streethail?: string | number
  earning_platform?: string | number
  drive_rate?: string | number
  earning_per_hour?: string | number
  [key: string]: unknown
}

interface MeterLog {
  driver_key: string
  service_date: string
  asp_id: number
  start_hour: number | null
  work_hour: number | null
  travel_min: number | null
  dist_km: number | null
  empty_km: number | null
  ride_count: number | null
  earning: number | null
  earning_streethail: number | null
  earning_platform: number | null
  drive_rate: number | null
  earning_per_hour: number | null
  street_ratio: number | null
  platform_ratio: number | null
  hourly_rides: Record<string, number>
  hourly_platform: Record<string, number>
  driver_id: null
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '' || v === '-') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function r4(v: number | null): number | null {
  return v != null ? parseFloat(v.toFixed(4)) : null
}

function buildHourlyMap(row: SheetRow, suffix: string): Record<string, number> {
  const result: Record<string, number> = {}
  for (let h = 0; h < 24; h++) {
    const key = suffix ? `${h}_${suffix}` : String(h)
    const val = numOrNull(row[key])
    result[String(h)] = val ?? 0
  }
  return result
}

function buildRow(row: SheetRow, serviceDate: string): MeterLog | null {
  const driverKey = String(row.driver_key ?? '').trim()
  if (!driverKey) return null

  const earning = numOrNull(row.earning)
  const earningStreet = numOrNull(row.earning_streethail)
  const earningPlatform = numOrNull(row.earning_platform)

  const streetRatio = earning && earning > 0 && earningStreet != null
    ? r4(earningStreet / earning)
    : null
  const platformRatio = earning && earning > 0 && earningPlatform != null
    ? r4(earningPlatform / earning)
    : null

  return {
    driver_key: driverKey,
    service_date: serviceDate,
    asp_id: ASP_ID,
    start_hour: numOrNull(row.start_hour),
    work_hour: numOrNull(row.work_hour),
    travel_min: numOrNull(row.travel_min),
    dist_km: numOrNull(row.dist_km),
    empty_km: numOrNull(row.empty_km),
    ride_count: numOrNull(row.ride_count),
    earning,
    earning_streethail: earningStreet,
    earning_platform: earningPlatform,
    drive_rate: numOrNull(row.drive_rate),
    earning_per_hour: numOrNull(row.earning_per_hour),
    street_ratio: streetRatio,
    platform_ratio: platformRatio,
    hourly_rides: buildHourlyMap(row, ''),
    hourly_platform: buildHourlyMap(row, 'platform'),
    driver_id: null,
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let inputRows = 0
  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'multipart/form-data 파싱 실패' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'file 필드가 필요합니다.' }, { status: 400 })
  }

  const serviceDate = extractDateFromFilename(file.name)
  if (!serviceDate) {
    return NextResponse.json(
      { error: `파일명에서 날짜를 추출할 수 없습니다. 패턴: 통계_천안_YYYYMMDD_YYYYMMDD.xlsx (현재: ${file.name})` },
      { status: 400 }
    )
  }

  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    return NextResponse.json({ error: '파일 읽기 실패' }, { status: 422 })
  }

  let rows: SheetRow[]
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })

    const sheetName = workbook.SheetNames.find(
      (n) => n.trim() === 'Driver Summary'
    )
    if (!sheetName) {
      return NextResponse.json(
        {
          error: '"Driver Summary" 시트를 찾을 수 없습니다.',
          available_sheets: workbook.SheetNames,
        },
        { status: 422 }
      )
    }

    rows = XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName])
  } catch (err) {
    return NextResponse.json({ error: '엑셀 파싱 실패', detail: String(err) }, { status: 422 })
  }

  inputRows = rows.length

  const logs: MeterLog[] = []
  for (const row of rows) {
    const log = buildRow(row, serviceDate)
    if (log) logs.push(log)
  }

  if (logs.length === 0) {
    const sample = rows[0] ?? null
    await logAgentRun({
      run_date: new Date().toISOString().slice(0, 10),
      agent_name: 'meter-logs',
      input_rows: inputRows,
      status: 'failed',
      duration_ms: Date.now() - startedAt,
      error_msg: 'driver_key 있는 행 없음',
    })
    return NextResponse.json(
      {
        error: '처리된 행이 없습니다. driver_key 컬럼명을 확인하세요.',
        debug: {
          total_rows: inputRows,
          columns: sample ? Object.keys(sample) : [],
          sample,
        },
      },
      { status: 422 }
    )
  }

  const BATCH = 500
  for (let i = 0; i < logs.length; i += BATCH) {
    const chunk = logs.slice(i, i + BATCH)
    const { error } = await supabase
      .from('meter_daily_logs')
      .upsert(chunk, { onConflict: 'driver_key,service_date' })

    if (error) {
      console.error('[meter-logs] upsert 실패', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        batch_index: i,
      })
      await logAgentRun({
        run_date: new Date().toISOString().slice(0, 10),
        agent_name: 'meter-logs',
        input_rows: inputRows,
        status: 'failed',
        duration_ms: Date.now() - startedAt,
        error_msg: error.message,
      })
      return NextResponse.json(
        { error: 'meter_daily_logs upsert 실패', detail: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      )
    }
  }

  await logAgentRun({
    run_date: new Date().toISOString().slice(0, 10),
    agent_name: 'meter-logs',
    input_rows: inputRows,
    status: 'success',
    duration_ms: Date.now() - startedAt,
  })

  return NextResponse.json({
    message: '미터 로그 적재 완료',
    service_date: serviceDate,
    driver_count: logs.length,
    total_rows_read: inputRows,
  })
}
