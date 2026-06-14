import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { logAgentRun } from '@/lib/agent-logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CallcardEtaRow {
  call_id?: string | number
  CALL_ID?: string | number
  asp_id?: string | number
  ASP_ID?: string | number
  request_datetime?: string | number
  s_area?: string
  d_area?: string
  passenger_hexagon_id?: string | number
  dest_hexagon_id?: string | number
  expected_distance?: string | number
  expected_fare_amt?: string | number
  call_fee?: string | number
  accept_eta?: string | number
  ACCEPTED_TAXI_ETA?: string | number
  service_info_name?: string
  driver_id?: string | number
  DRIVER_ID?: string | number
  vehicle_id?: string | number
  VEHICLE_ID?: string | number
  surge_price_A?: string | number
  [key: string]: unknown
}

interface RemappedRow {
  call_id?: string | number
  CALL_ID?: string | number
  passenger_hexagon_id?: string | number
  dest_hexagon_id?: string | number
  service_info_name?: string
  driver_id?: string | number
  DRIVER_ID?: string | number
  vehicle_id?: string | number
  VEHICLE_ID?: string | number
  surge_price_A?: string | number
  [key: string]: unknown
}

interface CallcardMbti {
  callcard_id: string
  asp_id: number
  call_date: string
  hour_slot: number
  weekday: number
  s_area: string | null
  s_hexagon: string
  d_area: string | null
  d_hexagon: string
  expected_distance: number
  expected_fare: number
  is_paid: boolean
  eta_distance: number | null
  product_type: string
  is_surge: boolean
  urgency_score: number
  driver_id: string | null
  vehicle_id: string | null
}

function parseSheet<T>(buffer: ArrayBuffer): T[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<T>(sheet)
}

function getCallcardId(row: CallcardEtaRow | RemappedRow): string {
  return String(row.call_id ?? row.CALL_ID ?? '').trim()
}

// JS getDay(): 0=Sun..6=Sat → 0=Mon..6=Sun
function jsWeekdayToMon0(jsDay: number): number {
  return (jsDay + 6) % 7
}

function parseDatetime(raw: string | number | undefined): Date | null {
  if (raw == null || raw === '') return null
  // Excel serial number
  if (typeof raw === 'number') {
    const date = XLSX.SSF.parse_date_code(raw)
    if (!date) return null
    return new Date(Date.UTC(date.y, date.m - 1, date.d, date.H, date.M, date.S))
  }
  const str = String(raw).trim()
  if (!str) return null
  const d = new Date(str.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

function buildVector(
  row: CallcardEtaRow,
  remapped: RemappedRow | undefined
): CallcardMbti | null {
  const callcardId = getCallcardId(row)
  if (!callcardId) return null

  const dt = parseDatetime(row.request_datetime)
  const hour_slot = dt ? dt.getHours() : 0
  const weekday = dt ? jsWeekdayToMon0(dt.getDay()) : 0
  const call_date = dt
    ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    : ''

  const sHex = String(row.passenger_hexagon_id ?? remapped?.passenger_hexagon_id ?? '').trim()
  const dHex = String(row.dest_hexagon_id ?? remapped?.dest_hexagon_id ?? '').trim()
  const productType = String(row.service_info_name ?? remapped?.service_info_name ?? '').trim()
  const surgeRaw = row.surge_price_A ?? remapped?.surge_price_A ?? 0

  const etaRaw = row.accept_eta ?? row.ACCEPTED_TAXI_ETA ?? null
  const etaVal = etaRaw != null ? Number(etaRaw) : null
  const driverId = String(row.driver_id ?? row.DRIVER_ID ?? '').trim() || null
  const vehicleId = String(row.vehicle_id ?? row.VEHICLE_ID ?? '').trim() || null

  return {
    callcard_id: callcardId,
    asp_id: Number(row.asp_id ?? row.ASP_ID ?? 0),
    call_date,
    hour_slot,
    weekday,
    s_area: String(row.s_area ?? '').trim() || null,
    s_hexagon: sHex,
    d_area: String(row.d_area ?? '').trim() || null,
    d_hexagon: dHex,
    expected_distance: Number(row.expected_distance ?? 0),
    expected_fare: Number(row.expected_fare_amt ?? 0),
    is_paid: Number(row.call_fee ?? 0) > 0,
    eta_distance: etaVal != null && etaVal > 0 ? etaVal : null,
    product_type: productType,
    is_surge: Number(surgeRaw) > 0,
    urgency_score: 0.0,
    driver_id: driverId,
    vehicle_id: vehicleId,
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

  const callcardFile = formData.get('callcard_eta') as File | null
  const remappedFile = formData.get('remapped') as File | null

  if (!callcardFile || !remappedFile) {
    return NextResponse.json(
      { error: 'callcard_eta, remapped 파일 모두 필요합니다.' },
      { status: 400 }
    )
  }

  const [callcardBuffer, remappedBuffer] = await Promise.all([
    callcardFile.arrayBuffer(),
    remappedFile.arrayBuffer(),
  ])

  let callcardRows: CallcardEtaRow[]
  let remappedRows: RemappedRow[]
  try {
    callcardRows = parseSheet<CallcardEtaRow>(callcardBuffer)
    remappedRows = parseSheet<RemappedRow>(remappedBuffer)
  } catch (err) {
    return NextResponse.json({ error: '엑셀 파싱 실패', detail: String(err) }, { status: 422 })
  }

  inputRows = callcardRows.length

  // remapped를 callcard_id로 인덱싱
  const remappedMap = new Map<string, RemappedRow>()
  for (const row of remappedRows) {
    const id = getCallcardId(row)
    if (id) remappedMap.set(id, row)
  }

  const vectors: CallcardMbti[] = []
  for (const row of callcardRows) {
    const callcardId = getCallcardId(row)
    const vec = buildVector(row, remappedMap.get(callcardId))
    if (vec) vectors.push(vec)
  }

  if (vectors.length === 0) {
    const sample = callcardRows[0] ?? null
    await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'callcard-mbti', input_rows: inputRows, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: '처리된 콜 없음' })
    return NextResponse.json(
      {
        error: '처리된 콜이 없습니다. callcard_id 컬럼명을 확인하세요.',
        debug: {
          callcard_total_rows: callcardRows.length,
          callcard_columns: sample ? Object.keys(sample) : [],
          callcard_sample: sample,
          remapped_total_rows: remappedRows.length,
        },
      },
      { status: 422 }
    )
  }

  const BATCH = 500
  for (let i = 0; i < vectors.length; i += BATCH) {
    const chunk = vectors.slice(i, i + BATCH)
    const { error } = await supabase
      .from('callcard_mbti')
      .upsert(chunk, { onConflict: 'callcard_id' })

    if (error) {
      console.error('[callcard-mbti] upsert 실패', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        batch_index: i,
      })
      await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'callcard-mbti', input_rows: inputRows, status: 'failed', duration_ms: Date.now() - startedAt, error_msg: error.message })
      return NextResponse.json(
        { error: 'callcard_mbti upsert 실패', detail: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      )
    }
  }

  await logAgentRun({ run_date: new Date().toISOString().slice(0, 10), agent_name: 'callcard-mbti', input_rows: inputRows, status: 'success', duration_ms: Date.now() - startedAt })
  return NextResponse.json({
    message: 'callcard_mbti 계산 완료',
    callcard_count: vectors.length,
    total_rows_read: callcardRows.length,
    remapped_rows_read: remappedRows.length,
    source_identifiers: { driver_id: 'preserved', vehicle_id: 'preserved' },
  })
}
