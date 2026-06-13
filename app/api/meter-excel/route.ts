import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { logAgentRun } from '@/lib/agent-logger'

const BATCH = 500
const ASP_ID = 147 // 행복콜/천안

// "-" 또는 빈값 → null 변환
function toNum(val: unknown): number | null {
  if (val === '-' || val === '' || val === null || val === undefined) return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

// "42.78%" → 0.4278 변환
function toPct(val: unknown): number | null {
  if (val === '-' || val === '' || val === null || val === undefined) return null
  const str = String(val).replace('%', '')
  const n = parseFloat(str)
  return isNaN(n) ? null : n / 100
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const formData = await req.formData()
    const file = formData.get('meter_file') as File
    const aspId = Number(formData.get('asp_id') ?? ASP_ID)

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다 (meter_file)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // ── Sheet 1: Hourly Summary ──────────────────────────────
    const hourlySheet = workbook.Sheets['Hourly Summary']
    if (!hourlySheet) {
      return NextResponse.json({ error: 'Hourly Summary 시트를 찾을 수 없습니다' }, { status: 400 })
    }

    const hourlyRaw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(hourlySheet)

    const hourlyLogs = hourlyRaw.map((row) => ({
      asp_id:                    aspId,
      log_date:                  String(row['date']),
      hour:                      Number(row['hour']),
      driver_count:              toNum(row['number of drivers']),
      ride_count:                toNum(row['ride count']),
      ride_count_streethail:     toNum(row['ride_count_street']),
      ride_count_platform:       toNum(row['ride_count_platform']),
      total_earning:             toNum(row['total earning']),
      earning_streethail:        toNum(row['earning_streethail']),
      earning_platform:          toNum(row['earning_platform']),
      earning_per_active_driver: toNum(row['Earning per active driver']),
      earning_per_hour_avg:      toNum(row['earning per hour (average)']),
      earning_median:            toNum(row['median (work_min>10)']),
      earning_p75:               toNum(row['0.75 percentile (work_min>10)']),
      earning_p25:               toNum(row['0.25 percentile (work_min >10)']),
      travel_min:                toNum(row['travel min']),
      work_min:                  toNum(row['work min']),
      dist_km:                   toNum(row['dist_km']),
      ride_per_driver:           toNum(row['ride / driver']),
      travel_work_ratio:         toPct(row['travel / work']),
    }))

    // ── Sheet 2: Driver Summary ──────────────────────────────
    const driverSheet = workbook.Sheets['Driver Summary']
    if (!driverSheet) {
      return NextResponse.json({ error: 'Driver Summary 시트를 찾을 수 없습니다' }, { status: 400 })
    }

    const driverRaw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(driverSheet)

    const driverLogs = driverRaw.map((row) => ({
      asp_id:               aspId,
      log_date:             String(row['date']),
      driver_key:           String(row['driver_key']),
      start_hour:           toNum(row['start_hour']),
      work_hour:            toNum(row['work_hour']),
      travel_min:           toNum(row['travel_min']),
      travel_min_allocated: toNum(row['travel_min_allocated']),
      dist_km:              toNum(row['dist_km']),
      empty_km:             toNum(row['empty_km']),
      total_dist:           toNum(row['total_dist']),
      ride_count:           toNum(row['ride_count']),
      earning:              toNum(row['earning']),
      earning_allocated:    toNum(row['earning_allocated']),
      earning_streethail:   toNum(row['earning_streethail']),
      earning_platform:     toNum(row['earning_platform']),
      drive_rate:           toNum(row['drive_rate']),
      earning_per_hour:     toNum(row['earning_per_hour']),
      // 시간대별 수입 (0~23시)
      h00: toNum(row['0']),  h01: toNum(row['1']),  h02: toNum(row['2']),  h03: toNum(row['3']),
      h04: toNum(row['4']),  h05: toNum(row['5']),  h06: toNum(row['6']),  h07: toNum(row['7']),
      h08: toNum(row['8']),  h09: toNum(row['9']),  h10: toNum(row['10']), h11: toNum(row['11']),
      h12: toNum(row['12']), h13: toNum(row['13']), h14: toNum(row['14']), h15: toNum(row['15']),
      h16: toNum(row['16']), h17: toNum(row['17']), h18: toNum(row['18']), h19: toNum(row['19']),
      h20: toNum(row['20']), h21: toNum(row['21']), h22: toNum(row['22']), h23: toNum(row['23']),
      // 노선 수입 (0~9시만)
      h00_street: toNum(row['0_street']), h01_street: toNum(row['1_street']),
      h02_street: toNum(row['2_street']), h03_street: toNum(row['3_street']),
      h04_street: toNum(row['4_street']), h05_street: toNum(row['5_street']),
      h06_street: toNum(row['6_street']), h07_street: toNum(row['7_street']),
      h08_street: toNum(row['8_street']), h09_street: toNum(row['9_street']),
    }))

    // ── Upsert: meter_hourly_logs ────────────────────────────
    let hourlyInserted = 0
    for (let i = 0; i < hourlyLogs.length; i += BATCH) {
      const chunk = hourlyLogs.slice(i, i + BATCH)
      const { error } = await supabase
        .from('meter_hourly_logs')
        .upsert(chunk, { onConflict: 'asp_id,log_date,hour' })
      if (error) {
        return NextResponse.json(
          { error: 'meter_hourly_logs 저장 실패', detail: error.message, code: error.code, hint: error.hint },
          { status: 500 }
        )
      }
      hourlyInserted += chunk.length
    }

    // ── Upsert: meter_driver_logs ────────────────────────────
    let driverInserted = 0
    for (let i = 0; i < driverLogs.length; i += BATCH) {
      const chunk = driverLogs.slice(i, i + BATCH)
      const { error } = await supabase
        .from('meter_driver_logs')
        .upsert(chunk, { onConflict: 'asp_id,log_date,driver_key' })
      if (error) {
        return NextResponse.json(
          { error: 'meter_driver_logs 저장 실패', detail: error.message, code: error.code, hint: error.hint },
          { status: 500 }
        )
      }
      driverInserted += chunk.length
    }

    const elapsed = Date.now() - startTime

    await logAgentRun({
      run_date: new Date().toISOString().slice(0, 10),
      agent_name: 'meter-excel',
      input_rows: hourlyRaw.length + driverRaw.length,
      status: 'success',
      duration_ms: elapsed,
    })

    return NextResponse.json({
      success: true,
      asp_id: aspId,
      hourly_inserted: hourlyInserted,
      driver_inserted: driverInserted,
      elapsed_ms: elapsed,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logAgentRun({
      run_date: new Date().toISOString().slice(0, 10),
      agent_name: 'meter-excel',
      input_rows: 0,
      status: 'failed',
      duration_ms: Date.now() - startTime,
      error_msg: message,
    })
    return NextResponse.json({ error: '서버 오류', detail: message }, { status: 500 })
  }
}
