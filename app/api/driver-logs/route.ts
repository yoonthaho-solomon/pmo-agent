import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { logAgentRun } from '@/lib/agent-logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CallcardRow {
  driver_id?: string | number
  asp_id?: string | number
  ASP_ID?: string | number
  service_date?: string | number
  status?: string
  STATUS?: string
  request_datetime?: string
  expected_distance?: string | number
  expected_fare_amt?: string | number
  call_fee?: string | number
  s_area?: string
  d_area?: string
  passenger_hexagon_id?: string | number
  dest_hexagon_id?: string | number
  service_info_name?: string
  surge_price_A?: string | number
  accept_eta?: string | number
  ACCEPTED_TAXI_ETA?: string | number
  [key: string]: unknown
}

interface RemappedRow {
  driver_id?: string | number
  asp_id?: string | number
  ASP_ID?: string | number
  status?: string
  STATUS?: string
  passenger_hexagon_id?: string | number
  dest_hexagon_id?: string | number
  service_info_name?: string
  surge_price_A?: string | number
  [key: string]: unknown
}

interface DriverLog {
  driver_id: string
  asp_id: number
  service_date: string
  weekday: number
  total_received: number
  total_accepted: number
  total_expired: number
  accept_rate: number
  accepted_hours: number[]
  accepted_s_areas: string[]
  accepted_d_areas: string[]
  accepted_s_hexagons: string[]
  accepted_d_hexagons: string[]
  rejected_s_hexagons: string[]
  rejected_d_hexagons: string[]
  avg_distance: number | null
  avg_fare: number | null
  paid_accepted: number
  free_accepted: number
  low_fare_cnt: number
  mid_fare_cnt: number
  high_fare_cnt: number
  product_normal_cnt: number
  product_night_cnt: number
  product_surge_cnt: number
  short_cnt: number
  medium_cnt: number
  long_cnt: number
  avg_accept_eta: number | null
}


function parseSheet<T>(buffer: ArrayBuffer): T[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<T>(sheet)
}

function getWeekday(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay() // 0=일, 1=월, ..., 6=토
}

function getHour(datetimeStr: string): number | null {
  if (!datetimeStr) return null
  const timePart = String(datetimeStr).split(' ')[1]
  if (!timePart) return null
  const h = parseInt(timePart.split(':')[0], 10)
  return isNaN(h) ? null : h
}

function normalizeStatus(row: CallcardRow | RemappedRow): string {
  return String(row.status ?? row.STATUS ?? '').trim().toUpperCase()
}

function getCallcardAspId(row: CallcardRow): number {
  return Number(row.asp_id ?? row.ASP_ID ?? 0)
}

function getRemappedAspId(row: RemappedRow): number {
  return Number(row.ASP_ID ?? row.asp_id ?? 0)
}

const ACCEPTED_STATUSES = new Set(['FINISHED', 'FINISH', 'DROP', 'ACCEPTED'])
const EXPIRED_STATUSES = new Set(['EXPIRED'])

function isAccepted(status: string): boolean {
  return ACCEPTED_STATUSES.has(status)
}

function isExpired(status: string): boolean {
  return EXPIRED_STATUSES.has(status)
}

function getProductType(
  row: CallcardRow | RemappedRow
): 'surge' | 'night' | 'normal' {
  if (Number(row.surge_price_A ?? 0) > 0) return 'surge'
  const name = String(row.service_info_name ?? '').trim()
  if (name.includes('달밤')) return 'night'
  return 'normal'
}

function aggregateDriverLogs(
  callcardRows: CallcardRow[],
  remappedRows: RemappedRow[],
  serviceDate: string
): DriverLog[] {
  const weekday = getWeekday(serviceDate)

  type Key = string
  const map = new Map<Key, {
    driver_id: string
    asp_id: number
    total_received: number
    total_accepted: number
    total_expired: number
    accepted_hours: number[]
    accepted_s_areas: string[]
    accepted_d_areas: string[]
    accepted_s_hexagons: string[]
    accepted_d_hexagons: string[]
    rejected_s_hexagons: string[]
    rejected_d_hexagons: string[]
    dist_sum: number
    dist_cnt: number
    fare_sum: number
    fare_cnt: number
    paid_accepted: number
    free_accepted: number
    low_fare_cnt: number
    mid_fare_cnt: number
    high_fare_cnt: number
    product_normal_cnt: number
    product_night_cnt: number
    product_surge_cnt: number
    short_cnt: number
    medium_cnt: number
    long_cnt: number
    eta_sum: number
    eta_cnt: number
  }>()

  // callcard_eta: driver_id + asp_id 기준 집계
  for (const row of callcardRows) {
    const driverId = String(row.driver_id ?? '').trim()
    if (!driverId || driverId.toUpperCase() === 'NONE') continue

    const aspId = getCallcardAspId(row)
    if (!aspId || isNaN(aspId)) continue

    const key: Key = `${driverId}__${aspId}`
    if (!map.has(key)) {
      map.set(key, {
        driver_id: driverId,
        asp_id: aspId,
        total_received: 0,
        total_accepted: 0,
        total_expired: 0,
        accepted_hours: [],
        accepted_s_areas: [],
        accepted_d_areas: [],
        accepted_s_hexagons: [],
        accepted_d_hexagons: [],
        rejected_s_hexagons: [],
        rejected_d_hexagons: [],
        dist_sum: 0,
        dist_cnt: 0,
        fare_sum: 0,
        fare_cnt: 0,
        paid_accepted: 0,
        free_accepted: 0,
        low_fare_cnt: 0,
        mid_fare_cnt: 0,
        high_fare_cnt: 0,
        product_normal_cnt: 0,
        product_night_cnt: 0,
        product_surge_cnt: 0,
        short_cnt: 0,
        medium_cnt: 0,
        long_cnt: 0,
        eta_sum: 0,
        eta_cnt: 0,
      })
    }

    const agg = map.get(key)!
    const status = normalizeStatus(row)
    agg.total_received++

    const sHex = String(row.passenger_hexagon_id ?? '').trim()
    const dHex = String(row.dest_hexagon_id ?? '').trim()

    if (isExpired(status)) {
      agg.total_expired++
      if (sHex) agg.rejected_s_hexagons.push(sHex)
      if (dHex) agg.rejected_d_hexagons.push(dHex)
    }

    if (isAccepted(status)) {
      agg.total_accepted++

      const hour = getHour(String(row.request_datetime ?? ''))
      if (hour !== null) agg.accepted_hours.push(hour)

      const sArea = String(row.s_area ?? '').trim()
      if (sArea) agg.accepted_s_areas.push(sArea)

      const dArea = String(row.d_area ?? '').trim()
      if (dArea) agg.accepted_d_areas.push(dArea)

      if (sHex) agg.accepted_s_hexagons.push(sHex)
      if (dHex) agg.accepted_d_hexagons.push(dHex)

      const dist = Number(row.expected_distance ?? 0)
      if (dist > 0) {
        agg.dist_sum += dist
        agg.dist_cnt++
      }

      const fare = Number(row.expected_fare_amt ?? 0)
      if (fare > 0) {
        agg.fare_sum += fare
        agg.fare_cnt++
        if (fare <= 10000) agg.low_fare_cnt++
        else if (fare <= 20000) agg.mid_fare_cnt++
        else agg.high_fare_cnt++
      }

      const callFee = Number(row.call_fee ?? 0)
      if (callFee > 0) agg.paid_accepted++
      else agg.free_accepted++

      const product = getProductType(row)
      if (product === 'surge') agg.product_surge_cnt++
      else if (product === 'night') agg.product_night_cnt++
      else agg.product_normal_cnt++

      if (dist > 0) {
        if (dist <= 3000) agg.short_cnt++
        else if (dist <= 8000) agg.medium_cnt++
        else agg.long_cnt++
      }

      const eta = Number(row.accept_eta ?? row.ACCEPTED_TAXI_ETA ?? 0)
      if (eta > 0) {
        agg.eta_sum += eta
        agg.eta_cnt++
      }
    }
  }

  // remapped: driver_id가 있을 경우 추가 집계 (surge_price_A, hexagon 등 보완)
  for (const row of remappedRows) {
    const driverId = String(row.driver_id ?? '').trim()
    if (!driverId || driverId.toUpperCase() === 'NONE') continue

    const aspId = getRemappedAspId(row)
    if (!aspId || isNaN(aspId)) continue

    const key: Key = `${driverId}__${aspId}`
    const agg = map.get(key)
    if (!agg) continue

    const status = normalizeStatus(row)
    const sHex = String(row.passenger_hexagon_id ?? '').trim()
    const dHex = String(row.dest_hexagon_id ?? '').trim()

    // callcard에 hexagon 없을 경우 remapped로 보완 (중복 방지: callcard만 있을 때는 이미 처리됨)
    // 여기서는 remapped 전용 데이터만 추가
    if (isExpired(status)) {
      if (sHex && !agg.rejected_s_hexagons.includes(sHex)) {
        agg.rejected_s_hexagons.push(sHex)
      }
      if (dHex && !agg.rejected_d_hexagons.includes(dHex)) {
        agg.rejected_d_hexagons.push(dHex)
      }
    }

    if (isAccepted(status)) {
      if (sHex && !agg.accepted_s_hexagons.includes(sHex)) {
        agg.accepted_s_hexagons.push(sHex)
      }
      if (dHex && !agg.accepted_d_hexagons.includes(dHex)) {
        agg.accepted_d_hexagons.push(dHex)
      }
    }
  }

  const results: DriverLog[] = []
  for (const agg of map.values()) {
    const accept_rate =
      agg.total_received > 0
        ? parseFloat((agg.total_accepted / agg.total_received).toFixed(4))
        : 0

    results.push({
      driver_id: agg.driver_id,
      asp_id: agg.asp_id,
      service_date: serviceDate,
      weekday,
      total_received: agg.total_received,
      total_accepted: agg.total_accepted,
      total_expired: agg.total_expired,
      accept_rate,
      accepted_hours: agg.accepted_hours,
      accepted_s_areas: agg.accepted_s_areas,
      accepted_d_areas: agg.accepted_d_areas,
      accepted_s_hexagons: agg.accepted_s_hexagons,
      accepted_d_hexagons: agg.accepted_d_hexagons,
      rejected_s_hexagons: agg.rejected_s_hexagons,
      rejected_d_hexagons: agg.rejected_d_hexagons,
      avg_distance:
        agg.dist_cnt > 0
          ? parseFloat((agg.dist_sum / agg.dist_cnt).toFixed(1))
          : null,
      avg_fare:
        agg.fare_cnt > 0
          ? parseFloat((agg.fare_sum / agg.fare_cnt).toFixed(1))
          : null,
      paid_accepted: agg.paid_accepted,
      free_accepted: agg.free_accepted,
      low_fare_cnt: agg.low_fare_cnt,
      mid_fare_cnt: agg.mid_fare_cnt,
      high_fare_cnt: agg.high_fare_cnt,
      product_normal_cnt: agg.product_normal_cnt,
      product_night_cnt: agg.product_night_cnt,
      product_surge_cnt: agg.product_surge_cnt,
      short_cnt: agg.short_cnt,
      medium_cnt: agg.medium_cnt,
      long_cnt: agg.long_cnt,
      avg_accept_eta:
        agg.eta_cnt > 0
          ? parseFloat((agg.eta_sum / agg.eta_cnt).toFixed(1))
          : null,
    })
  }

  return results
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

  const callcardFile = formData.get('callcard_eta') as File | null
  const remappedFile = formData.get('remapped') as File | null

  if (!callcardFile || !remappedFile) {
    return NextResponse.json(
      { error: 'callcard_eta, remapped 파일 모두 필요합니다.' },
      { status: 400 }
    )
  }

  const dateMatch = callcardFile.name.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!dateMatch) {
    return NextResponse.json(
      { error: '파일명에서 날짜를 추출할 수 없습니다. 파일명 패턴: YYYYMMDD_*.xlsx' },
      { status: 400 }
    )
  }
  const serviceDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`

  const [callcardBuffer, remappedBuffer] = await Promise.all([
    callcardFile.arrayBuffer(),
    remappedFile.arrayBuffer(),
  ])

  let callcardRows: CallcardRow[]
  let remappedRows: RemappedRow[]
  try {
    callcardRows = parseSheet<CallcardRow>(callcardBuffer)
    remappedRows = parseSheet<RemappedRow>(remappedBuffer)
  } catch (err) {
    return NextResponse.json(
      { error: '엑셀 파싱 실패', detail: String(err) },
      { status: 422 }
    )
  }

  inputRows = callcardRows.length
  const logs = aggregateDriverLogs(callcardRows, remappedRows, serviceDate)

  if (logs.length === 0) {
    const sample = callcardRows[0] ?? null
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'driver-logs', input_rows: inputRows, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: '집계 결과 없음' })
    return NextResponse.json(
      {
        error: '집계 결과가 없습니다. 컬럼명을 확인하세요.',
        debug: {
          callcard_total_rows: callcardRows.length,
          callcard_columns: sample ? Object.keys(sample) : [],
          callcard_sample: sample,
          remapped_total_rows: remappedRows.length,
          remapped_columns: remappedRows.length > 0 ? Object.keys(remappedRows[0]) : [],
        },
      },
      { status: 422 }
    )
  }

  const BATCH = 500
  for (let i = 0; i < logs.length; i += BATCH) {
    const chunk = logs.slice(i, i + BATCH)

    const { error } = await supabase
      .from('driver_daily_logs')
      .upsert(chunk, { onConflict: 'driver_id,service_date' })

    if (error) {
      console.error('[driver-logs] Supabase upsert 실패', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        batch_index: i,
        batch_size: chunk.length,
      })
      await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'driver-logs', input_rows: inputRows, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: error.message })
      return NextResponse.json(
        {
          error: 'Supabase 저장 실패',
          detail: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      )
    }
  }

  await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'driver-logs', input_rows: inputRows, status: 'success', duration_ms: Date.now() - startedAt })
  return NextResponse.json({
    message: '기사 로그 집계 완료',
    service_date: serviceDate,
    driver_count: logs.length,
    total_rows_processed: callcardRows.length,
  })
}
