import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type DispatchEventInput = {
  dispatch_id?: string
  callcard_id?: string | null
  asp_id?: number
  driver_id?: string | null
  vehicle_id?: string | null
  event_type?: string
  event_status?: string | null
  rank_in_dispatch?: number | null
  radius_step_km?: number | null
  distance_km?: number | null
  eta_seconds?: number | null
  vector_cosine?: number | null
  final_score?: number | null
  call_risk_score?: number | null
  score_components?: Record<string, unknown> | null
  status_snapshot?: Record<string, unknown> | null
  candidate_snapshot?: Record<string, unknown> | unknown[] | null
  event_payload?: Record<string, unknown> | null
  event_at?: string | null
}

const EVENT_TYPES = new Set([
  'candidate_generated', 'callcard_sent', 'accepted', 'rejected', 'no_response', 'expired',
  'passenger_canceled', 'driver_canceled', 'pickup', 'drop', 'failed',
])

const EVENT_STATUSES = new Set(['pending', 'sent', 'accepted', 'rejected', 'expired', 'canceled', 'completed', 'failed'])

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

function createSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const source = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'
  if (!supabaseUrl || !supabaseKey) return { source, error: 'Supabase 환경변수가 설정되지 않았습니다.' }
  return { source, supabase: createClient(supabaseUrl, supabaseKey) }
}

function isTableMissing(err: unknown): boolean {
  const payload = errorPayload(err)
  return payload.code === '42P01' || payload.code === 'PGRST205'
}

function validateEvent(input: DispatchEventInput): { row?: Record<string, unknown>; error?: string } {
  if (!input.dispatch_id || typeof input.dispatch_id !== 'string') return { error: 'dispatch_id는 필수 문자열입니다.' }
  if (!input.asp_id || !Number.isFinite(input.asp_id)) return { error: 'asp_id는 필수 숫자입니다.' }
  if (!input.event_type || !EVENT_TYPES.has(input.event_type)) return { error: 'event_type이 지원 범위가 아닙니다.' }
  if (input.event_status != null && !EVENT_STATUSES.has(input.event_status)) return { error: 'event_status가 지원 범위가 아닙니다.' }
  if (input.rank_in_dispatch != null && (!Number.isFinite(input.rank_in_dispatch) || input.rank_in_dispatch <= 0)) return { error: 'rank_in_dispatch는 1 이상이어야 합니다.' }

  return {
    row: {
      dispatch_id: input.dispatch_id,
      callcard_id: input.callcard_id ?? null,
      asp_id: input.asp_id,
      driver_id: input.driver_id ?? null,
      vehicle_id: input.vehicle_id ?? null,
      event_type: input.event_type,
      event_status: input.event_status ?? null,
      rank_in_dispatch: input.rank_in_dispatch ?? null,
      radius_step_km: input.radius_step_km ?? null,
      distance_km: input.distance_km ?? null,
      eta_seconds: input.eta_seconds ?? null,
      vector_cosine: input.vector_cosine ?? null,
      final_score: input.final_score ?? null,
      call_risk_score: input.call_risk_score ?? null,
      score_components: input.score_components ?? null,
      status_snapshot: input.status_snapshot ?? null,
      candidate_snapshot: input.candidate_snapshot ?? null,
      event_payload: input.event_payload ?? null,
      event_at: input.event_at ?? new Date().toISOString(),
    },
  }
}

export async function GET(request: NextRequest) {
  const client = createSupabase()
  if ('error' in client) return NextResponse.json({ source: client.source, error: client.error }, { status: 500 })
  const { source, supabase } = client
  const params = request.nextUrl.searchParams
  const dispatchId = params.get('dispatch_id')
  const callcardId = params.get('callcard_id')
  const aspId = params.get('asp_id')
  const limit = Math.min(Math.max(Number(params.get('limit') ?? 50), 1), 200)

  try {
    let query = supabase.from('dispatch_events').select('*').order('event_at', { ascending: false }).limit(limit)
    if (dispatchId) query = query.eq('dispatch_id', dispatchId)
    if (callcardId) query = query.eq('callcard_id', callcardId)
    if (aspId) query = query.eq('asp_id', Number(aspId))
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ source, events: data ?? [], limit })
  } catch (err) {
    if (isTableMissing(err)) {
      return NextResponse.json({
        source,
        status: 'schema_missing',
        error: 'dispatch_events 테이블이 아직 적용되지 않았습니다.',
        next_step: 'supabase/migrations/20260615_dispatch_events.sql 적용 후 다시 호출하세요.',
        detail: errorPayload(err),
      }, { status: 501 })
    }
    return NextResponse.json({ source, error: errorPayload(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const client = createSupabase()
  if ('error' in client) return NextResponse.json({ source: client.source, error: client.error }, { status: 500 })
  const { source, supabase } = client

  let body: DispatchEventInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ source, error: 'body JSON 파싱 실패' }, { status: 400 })
  }

  const validated = validateEvent(body)
  if (!validated.row) return NextResponse.json({ source, error: validated.error }, { status: 400 })

  try {
    const { data, error } = await supabase.from('dispatch_events').insert(validated.row).select('*').single()
    if (error) throw error
    return NextResponse.json({ source, status: 'stored', event: data })
  } catch (err) {
    if (isTableMissing(err)) {
      return NextResponse.json({
        source,
        status: 'schema_missing',
        error: 'dispatch_events 테이블이 아직 적용되지 않았습니다.',
        next_step: 'supabase/migrations/20260615_dispatch_events.sql 적용 후 다시 호출하세요.',
        detail: errorPayload(err),
      }, { status: 501 })
    }
    return NextResponse.json({ source, error: errorPayload(err) }, { status: 500 })
  }
}
