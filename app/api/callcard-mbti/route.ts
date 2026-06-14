import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { logAgentRun } from '@/lib/agent-logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type SourceRow = Record<string, unknown>

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
  status?: string | null
  status_group?: string | null
  passenger_id?: string | null
  payment_method?: string | null
  passenger_addr?: string | null
  dest_addr?: string | null
  passenger_lat?: number | null
  passenger_lng?: number | null
  dest_lat?: number | null
  dest_lng?: number | null
  request_datetime?: string | null
  alloc_datetime?: string | null
  cancel_datetime?: string | null
  pickup_datetime?: string | null
  drop_datetime?: string | null
  call_fee?: number | null
  driver_id: string | null
  vehicle_id: string | null
}

const SOURCE_FIELD_COLUMNS = [
  'status',
  'status_group',
  'passenger_id',
  'payment_method',
  'passenger_addr',
  'dest_addr',
  'passenger_lat',
  'passenger_lng',
  'dest_lat',
  'dest_lng',
  'request_datetime',
  'alloc_datetime',
  'cancel_datetime',
  'pickup_datetime',
  'drop_datetime',
  'call_fee',
] as const

type SourceFieldColumn = typeof SOURCE_FIELD_COLUMNS[number]

function parseSheet<T>(buffer: ArrayBuffer): T[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<T>(sheet)
}

function field(row: SourceRow | undefined, ...keys: string[]): unknown {
  if (!row) return undefined
  for (const key of keys) {
    if (row[key] != null) return row[key]
  }
  return undefined
}

function getCallcardId(row: SourceRow): string {
  return String(field(row, 'call_id', 'CALL_ID') ?? '').trim()
}

function sourceIdentifier(raw: unknown): string | null {
  if (raw == null) return null
  const value = String(raw).trim()
  if (!value) return null
  if (['NONE', 'NULL', 'N/A', 'NA', '-'].includes(value.toUpperCase())) return null
  return value
}

function nullableText(raw: unknown): string | null {
  if (raw == null) return null
  const value = String(raw).trim()
  return value ? value : null
}

function nullableNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

// JS getDay(): 0=Sun..6=Sat -> 0=Mon..6=Sun
function jsWeekdayToMon0(jsDay: number): number {
  return (jsDay + 6) % 7
}

function parseDatetime(raw: unknown): Date | null {
  if (raw == null || raw === '') return null
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

function datetimeIso(raw: unknown): string | null {
  const parsed = parseDatetime(raw)
  return parsed ? parsed.toISOString() : null
}

function normalizeStatus(row: SourceRow, remapped: SourceRow | undefined): string | null {
  const value = nullableText(field(row, 'status', 'STATUS') ?? field(remapped, 'status', 'STATUS'))
  return value ? value.toUpperCase() : null
}

function statusGroup(status: string | null): string | null {
  if (!status) return null
  if (['FINISHED', 'FINISH', 'DROP', 'ACCEPTED'].includes(status)) return 'accepted'
  if (status === 'EXPIRED') return 'expired'
  if (['CANCELED', 'D_CANCELED', 'SYS_CANCELED', 'CC_CANCELED'].includes(status)) return 'canceled'
  if (status === 'PICKUP') return 'pickup'
  return 'other'
}

function buildVector(row: SourceRow, remapped: SourceRow | undefined): CallcardMbti | null {
  const callcardId = getCallcardId(row)
  if (!callcardId) return null

  const requestDatetime = field(row, 'request_datetime', 'REQUEST_DATETIME')
  const dt = parseDatetime(requestDatetime)
  const hour_slot = dt ? dt.getHours() : 0
  const weekday = dt ? jsWeekdayToMon0(dt.getDay()) : 0
  const call_date = dt
    ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    : ''

  const sHex = String(field(row, 'passenger_hexagon_id', 'PASSENGER_HEXAGON_ID') ?? field(remapped, 'passenger_hexagon_id', 'PASSENGER_HEXAGON_ID') ?? '').trim()
  const dHex = String(field(row, 'dest_hexagon_id', 'DEST_HEXAGON_ID') ?? field(remapped, 'dest_hexagon_id', 'DEST_HEXAGON_ID') ?? '').trim()
  const productType = String(field(row, 'service_info_name', 'SERVICE_INFO_NAME') ?? field(remapped, 'service_info_name', 'SERVICE_INFO_NAME') ?? '').trim()
  const surgeRaw = field(row, 'surge_price_A', 'SURGE_PRICE_A', 'SURGE_PRICE') ?? field(remapped, 'surge_price_A', 'SURGE_PRICE_A', 'SURGE_PRICE') ?? 0
  const etaRaw = field(row, 'accept_eta', 'ACCEPTED_TAXI_ETA') ?? null
  const etaVal = etaRaw != null ? Number(etaRaw) : null
  const callFee = nullableNumber(field(row, 'call_fee', 'CALL_FEE'))
  const status = normalizeStatus(row, remapped)

  return {
    callcard_id: callcardId,
    asp_id: Number(field(row, 'asp_id', 'ASP_ID') ?? 0),
    call_date,
    hour_slot,
    weekday,
    s_area: nullableText(field(row, 's_area', 'S_AREA')),
    s_hexagon: sHex,
    d_area: nullableText(field(row, 'd_area', 'D_AREA')),
    d_hexagon: dHex,
    expected_distance: Number(field(row, 'expected_distance', 'EXPECTED_DISTANCE') ?? 0),
    expected_fare: Number(field(row, 'expected_fare_amt', 'EXPECTED_FARE_AMT') ?? 0),
    is_paid: Number(callFee ?? 0) > 0,
    eta_distance: etaVal != null && etaVal > 0 ? etaVal : null,
    product_type: productType,
    is_surge: Number(surgeRaw) > 0,
    urgency_score: 0.0,
    status,
    status_group: statusGroup(status),
    passenger_id: nullableText(field(row, 'passenger_id', 'PASSENGER_ID')),
    payment_method: nullableText(field(row, 'payment_method', 'PAYMENT_METHOD')),
    passenger_addr: nullableText(field(row, 'passenger_addr', 'PASSENGER_ADDR')),
    dest_addr: nullableText(field(row, 'dest_addr', 'DEST_ADDR')),
    passenger_lat: nullableNumber(field(row, 'dec_enc_passenger_latitude', 'DEC_ENC_PASSENGER_LATITUDE')),
    passenger_lng: nullableNumber(field(row, 'dec_enc_passenger_longitude', 'DEC_ENC_PASSENGER_LONGITUDE')),
    dest_lat: nullableNumber(field(row, 'dec_enc_dest_latitude', 'DEC_ENC_DEST_LATITUDE')),
    dest_lng: nullableNumber(field(row, 'dec_enc_dest_longitude', 'DEC_ENC_DEST_LONGITUDE')),
    request_datetime: datetimeIso(requestDatetime),
    alloc_datetime: datetimeIso(field(row, 'alloc_datetime', 'ALLOC_DATETIME')),
    cancel_datetime: datetimeIso(field(row, 'cancel_datetime', 'CANCEL_DATETIME')),
    pickup_datetime: datetimeIso(field(row, 'pickup_datetime', 'PICKUP_DATETIME')),
    drop_datetime: datetimeIso(field(row, 'drop_datetime', 'DROP_DATETIME')),
    call_fee: callFee,
    driver_id: sourceIdentifier(field(row, 'driver_id', 'DRIVER_ID')),
    vehicle_id: sourceIdentifier(field(row, 'vehicle_id', 'VEHICLE_ID')),
  }
}

async function availableSourceColumns(): Promise<Set<SourceFieldColumn>> {
  const checks = await Promise.all(
    SOURCE_FIELD_COLUMNS.map(async (column) => {
      const { error } = await supabase.from('callcard_mbti').select(column).limit(1)
      return error ? null : column
    })
  )
  return new Set(checks.filter(Boolean) as SourceFieldColumn[])
}

function stripUnavailableSourceColumns(row: CallcardMbti, available: Set<SourceFieldColumn>): CallcardMbti {
  const next = { ...row } as Record<string, unknown>
  for (const column of SOURCE_FIELD_COLUMNS) {
    if (!available.has(column)) delete next[column]
  }
  return next as unknown as CallcardMbti
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

  let callcardRows: SourceRow[]
  let remappedRows: SourceRow[]
  try {
    callcardRows = parseSheet<SourceRow>(callcardBuffer)
    remappedRows = parseSheet<SourceRow>(remappedBuffer)
  } catch (err) {
    return NextResponse.json({ error: '엑셀 파싱 실패', detail: String(err) }, { status: 422 })
  }

  inputRows = callcardRows.length

  const remappedMap = new Map<string, SourceRow>()
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

  const sourceColumns = await availableSourceColumns()
  const upsertVectors = vectors.map((row) => stripUnavailableSourceColumns(row, sourceColumns))

  const BATCH = 500
  for (let i = 0; i < upsertVectors.length; i += BATCH) {
    const chunk = upsertVectors.slice(i, i + BATCH)
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
    source_fields: {
      available_columns: Array.from(sourceColumns),
      mode: sourceColumns.size === SOURCE_FIELD_COLUMNS.length ? 'preserved' : 'schema_not_applied',
    },
  })
}
