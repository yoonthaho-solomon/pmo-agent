import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { callToVector, cosineSimilarity, driverToVector, type CallVectorInput, type DriverVectorRow } from '@/lib/matching-vector'

type DispatchRequest = Partial<CallVectorInput> & {
  dispatch_id?: string
  callcard_id?: string
  asp_id?: number
  request_datetime?: string
  passenger_lat?: number
  passenger_lng?: number
  dest_lat?: number | null
  dest_lng?: number | null
  max_candidates?: number
  radius_steps_km?: number[]
  simulation_mode?: boolean
  record_events?: boolean
  call_risk_score?: number | null
}

type NormalizedDispatchCall = CallVectorInput & {
  dispatch_id: string
  callcard_id?: string
  asp_id: number
  passenger_lat: number
  passenger_lng: number
  dest_lat?: number | null
  dest_lng?: number | null
  max_candidates: number
  radius_steps_km: number[]
  simulation_mode: boolean
  record_events: boolean
  call_risk_score: number | null
}

type DriverStateRow = {
  driver_id: string
  asp_id: number
  vehicle_id: string | null
  vehicle_no: string | null
  lat: number
  lng: number
  location_updated_at: string
  online_status: boolean
  empty_status: boolean
  can_receive_call: boolean
  current_trip_status: string | null
  last_call_id: string | null
  source: string | null
}

type DriverRow = DriverVectorRow & {
  driver_id: string
  asp_id: number
  pref_s_hexagons: string[] | null
  pref_d_hexagons: string[] | null
  data_days?: number | null
  reliability?: number | null
}

const DRIVER_STATE_COLS = [
  'driver_id', 'asp_id', 'vehicle_id', 'vehicle_no', 'lat', 'lng', 'location_updated_at',
  'online_status', 'empty_status', 'can_receive_call', 'current_trip_status', 'last_call_id', 'source',
].join(',')

const DRIVER_COLS = [
  'driver_id', 'asp_id',
  'score_dawn', 'score_morning', 'score_daytime', 'score_night',
  'score_mon', 'score_tue', 'score_wed', 'score_thu', 'score_fri', 'score_sat', 'score_sun',
  'score_short', 'score_medium', 'score_long',
  'score_low_fare', 'score_mid_fare', 'score_high_fare',
  'score_paid', 'score_free',
  'score_surge', 'score_normal',
  'score_near',
  'pref_s_hexagons', 'pref_d_hexagons', 'data_days', 'reliability',
].join(',')

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

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function createDispatchId(): string {
  const random = globalThis.crypto?.randomUUID?.()
  return random ? `dispatch_${random}` : `dispatch_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function deriveTimeFields(input: DispatchRequest): { hour_slot: number; weekday: number } | null {
  if (isFiniteNumber(input.hour_slot) && input.hour_slot >= 0 && input.hour_slot <= 23 && isFiniteNumber(input.weekday) && input.weekday >= 0 && input.weekday <= 6) {
    return { hour_slot: input.hour_slot, weekday: input.weekday }
  }
  if (!input.request_datetime) return null
  const date = new Date(input.request_datetime)
  if (Number.isNaN(date.getTime())) return null
  const hour = date.getHours()
  const weekday = (date.getDay() + 6) % 7
  return { hour_slot: hour, weekday }
}

function normalizeRequest(input: DispatchRequest): { call?: NormalizedDispatchCall; error?: string } {
  if (!isFiniteNumber(input.asp_id)) return { error: 'asp_id는 필수 숫자입니다.' }
  if (!isFiniteNumber(input.passenger_lat) || !isFiniteNumber(input.passenger_lng)) return { error: 'passenger_lat/passenger_lng는 필수 숫자입니다.' }
  if (input.passenger_lat < -90 || input.passenger_lat > 90 || input.passenger_lng < -180 || input.passenger_lng > 180) return { error: 'passenger_lat/passenger_lng 범위가 올바르지 않습니다.' }
  const time = deriveTimeFields(input)
  if (!time) return { error: 'hour_slot/weekday 또는 request_datetime이 필요합니다.' }

  const radiusSteps = (input.radius_steps_km && input.radius_steps_km.length > 0 ? input.radius_steps_km : [3, 6, 9])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(0, 5)
  if (radiusSteps.length === 0) return { error: 'radius_steps_km에는 0보다 큰 숫자가 필요합니다.' }

  return {
    call: {
      dispatch_id: typeof input.dispatch_id === 'string' && input.dispatch_id.length > 0 ? input.dispatch_id : createDispatchId(),
      callcard_id: input.callcard_id,
      asp_id: input.asp_id,
      passenger_lat: input.passenger_lat,
      passenger_lng: input.passenger_lng,
      dest_lat: input.dest_lat ?? null,
      dest_lng: input.dest_lng ?? null,
      hour_slot: time.hour_slot,
      weekday: time.weekday,
      expected_distance: Number(input.expected_distance ?? 0),
      expected_fare: Number(input.expected_fare ?? 0),
      is_paid: Boolean(input.is_paid),
      is_surge: Boolean(input.is_surge),
      eta_distance: input.eta_distance ?? null,
      s_hexagon: input.s_hexagon ?? null,
      d_hexagon: input.d_hexagon ?? null,
      max_candidates: Math.min(Math.max(Number(input.max_candidates ?? 10), 1), 50),
      radius_steps_km: radiusSteps,
      simulation_mode: Boolean(input.simulation_mode),
      record_events: Boolean(input.record_events),
      call_risk_score: isFiniteNumber(input.call_risk_score) ? input.call_risk_score : null,
    },
  }
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const earthKm = 6371
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function estimateEtaSeconds(distanceKm: number): number {
  const assumedKmh = 24
  return Math.max(30, Math.round((distanceKm / assumedKmh) * 3600))
}

function etaScore(etaSeconds: number): number {
  return Math.max(0, 1 - etaSeconds / 1800)
}

function hashNumber(input: string, salt = 0): number {
  let h = 2166136261 + salt
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}

function seededUnit(input: string, salt = 0): number {
  return (hashNumber(input, salt) % 10000) / 10000
}

function offsetCoordinate(lat: number, lng: number, distanceKm: number, bearingRad: number): { lat: number; lng: number } {
  const northKm = Math.cos(bearingRad) * distanceKm
  const eastKm = Math.sin(bearingRad) * distanceKm
  return {
    lat: lat + northKm / 111,
    lng: lng + eastKm / (111 * Math.cos(lat * Math.PI / 180)),
  }
}

function buildSimulationStates(call: NormalizedDispatchCall, drivers: DriverRow[]): DriverStateRow[] {
  const now = new Date().toISOString()
  return drivers.slice(0, 5000).map((driver) => {
    const unit = seededUnit(driver.driver_id, 17)
    const distanceKm = 0.4 + unit * 8.6
    const bearing = seededUnit(driver.driver_id, 29) * Math.PI * 2
    const point = offsetCoordinate(call.passenger_lat, call.passenger_lng, distanceKm, bearing)
    const online = seededUnit(driver.driver_id, 41) >= 0.08
    const empty = seededUnit(driver.driver_id, 43) >= 0.18
    const canReceive = seededUnit(driver.driver_id, 47) >= 0.12
    return {
      driver_id: driver.driver_id,
      asp_id: call.asp_id,
      vehicle_id: null,
      vehicle_no: null,
      lat: point.lat,
      lng: point.lng,
      location_updated_at: now,
      online_status: online,
      empty_status: empty,
      can_receive_call: canReceive,
      current_trip_status: online ? (empty ? 'idle' : 'on_trip') : 'offline',
      last_call_id: null,
      source: 'simulation_mode',
    }
  }).filter((state) => state.online_status && state.empty_status && state.can_receive_call)
}

async function fetchRealtimeStates(supabase: SupabaseClient, aspId: number): Promise<{ rows?: DriverStateRow[]; schemaMissing?: boolean; error?: unknown }> {
  const freshSince = new Date(Date.now() - 90 * 1000).toISOString()
  const { data, error } = await supabase
    .from('driver_realtime_state')
    .select(DRIVER_STATE_COLS)
    .eq('asp_id', aspId)
    .eq('online_status', true)
    .eq('empty_status', true)
    .eq('can_receive_call', true)
    .gte('location_updated_at', freshSince)
    .limit(5000)

  if (error) {
    const payload = errorPayload(error)
    if (payload.code === '42P01' || payload.code === 'PGRST205') return { schemaMissing: true, error: payload }
    return { error: payload }
  }
  return { rows: (data ?? []) as unknown as DriverStateRow[] }
}

async function fetchDriversByAsp(supabase: SupabaseClient, aspId: number): Promise<DriverRow[]> {
  const all: DriverRow[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('driver_mbti')
      .select(DRIVER_COLS)
      .eq('asp_id', aspId)
      .order('driver_id', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as unknown as DriverRow[]))
    if (data.length < page) break
  }
  return all
}

async function fetchDriversByIds(supabase: SupabaseClient, aspId: number, driverIds: string[]): Promise<DriverRow[]> {
  if (driverIds.length === 0) return []
  const { data, error } = await supabase
    .from('driver_mbti')
    .select(DRIVER_COLS)
    .eq('asp_id', aspId)
    .in('driver_id', driverIds)
  if (error) throw error
  return (data ?? []) as unknown as DriverRow[]
}

function isTableMissing(err: unknown): boolean {
  const payload = errorPayload(err)
  return payload.code === '42P01' || payload.code === 'PGRST205'
}

async function recordCandidateGeneratedEvent(
  supabase: SupabaseClient,
  call: NormalizedDispatchCall,
  radiusStepUsed: number,
  ranked: Array<{
    rank: number
    driver_id: string
    vehicle_id: string | null
    distance_km: number
    eta_seconds: number
    vector_cosine: number
    final_score: number
    score_components: Record<string, unknown>
    status_snapshot: Record<string, unknown>
  }>,
) {
  const topCandidate = ranked[0]
  const row = {
    dispatch_id: call.dispatch_id,
    callcard_id: call.callcard_id ?? null,
    asp_id: call.asp_id,
    driver_id: topCandidate?.driver_id ?? null,
    vehicle_id: topCandidate?.vehicle_id ?? null,
    event_type: 'candidate_generated',
    event_status: 'pending',
    rank_in_dispatch: topCandidate?.rank ?? null,
    radius_step_km: radiusStepUsed,
    distance_km: topCandidate?.distance_km ?? null,
    eta_seconds: topCandidate?.eta_seconds ?? null,
    vector_cosine: topCandidate?.vector_cosine ?? null,
    final_score: topCandidate?.final_score ?? null,
    call_risk_score: call.call_risk_score,
    score_components: topCandidate?.score_components ?? null,
    status_snapshot: topCandidate?.status_snapshot ?? null,
    candidate_snapshot: ranked,
    event_payload: {
      simulation_mode: call.simulation_mode,
      radius_steps_km: call.radius_steps_km,
      candidate_count: ranked.length,
      score_formula_version: 'dispatch_v0_cosine_only_explainable_components',
    },
  }

  const { data, error } = await supabase.from('dispatch_events').insert(row).select('id, event_at').single()
  if (error) {
    if (isTableMissing(error)) return { status: 'schema_missing', detail: errorPayload(error) }
    return { status: 'error', detail: errorPayload(error) }
  }
  return { status: 'stored', event_id: data?.id ?? null, event_at: data?.event_at ?? null }
}

export async function POST(request: NextRequest) {
  const client = createSupabase()
  if ('error' in client) return NextResponse.json({ source: client.source, error: client.error }, { status: 500 })
  const { source, supabase } = client

  let body: DispatchRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ source, error: 'body JSON 파싱 실패' }, { status: 400 })
  }

  const normalized = normalizeRequest(body)
  if (!normalized.call) return NextResponse.json({ source, error: normalized.error }, { status: 400 })
  const call = normalized.call

  let states: DriverStateRow[] = []
  let simulationDrivers: DriverRow[] | null = null

  if (call.simulation_mode) {
    try {
      simulationDrivers = await fetchDriversByAsp(supabase, call.asp_id)
      states = buildSimulationStates(call, simulationDrivers)
    } catch (err) {
      return NextResponse.json({ source, error: 'simulation driver_mbti 조회 실패', detail: errorPayload(err) }, { status: 500 })
    }
  } else {
    const stateResult = await fetchRealtimeStates(supabase, call.asp_id)
    if (stateResult.schemaMissing) {
      return NextResponse.json({
        source,
        status: 'schema_missing',
        error: 'driver_realtime_state 테이블이 아직 적용되지 않았습니다.',
        next_step: 'supabase/migrations/20260615_driver_realtime_state.sql 적용 후 다시 호출하세요.',
        simulation_hint: 'DB 적용 전 화면 검증은 request body에 simulation_mode: true를 명시해 호출하세요.',
        detail: stateResult.error,
      }, { status: 501 })
    }
    if (stateResult.error) return NextResponse.json({ source, error: stateResult.error }, { status: 500 })
    states = stateResult.rows ?? []
  }
  const statesWithDistance = states.map((state) => ({
    state,
    distance_km: haversineKm(call.passenger_lat, call.passenger_lng, state.lat, state.lng),
  }))

  let radiusStepUsed = call.radius_steps_km[call.radius_steps_km.length - 1]
  let nearby = statesWithDistance
  for (const radius of call.radius_steps_km) {
    const candidates = statesWithDistance.filter((item) => item.distance_km <= radius)
    if (candidates.length > 0) {
      radiusStepUsed = radius
      nearby = candidates
      break
    }
  }

  const driverIds = nearby.map((item) => item.state.driver_id)
  let drivers: DriverRow[]
  try {
    if (simulationDrivers) {
      const idSet = new Set(driverIds)
      drivers = simulationDrivers.filter((driver) => idSet.has(driver.driver_id))
    } else {
      drivers = await fetchDriversByIds(supabase, call.asp_id, driverIds)
    }
  } catch (err) {
    return NextResponse.json({ source, error: 'driver_mbti 조회 실패', detail: errorPayload(err) }, { status: 500 })
  }
  const driverMap = new Map(drivers.map((driver) => [driver.driver_id, driver]))
  const callVector = callToVector(call)

  const ranked = nearby
    .map((item) => {
      const driver = driverMap.get(item.state.driver_id)
      if (!driver) return null
      const etaSeconds = estimateEtaSeconds(item.distance_km)
      const vectorCosine = cosineSimilarity(callVector, driverToVector(driver))
      const eta = etaScore(etaSeconds)
      const reliability = Number(driver.reliability ?? 0)
      const finalScore = vectorCosine
      return {
        rank: 0,
        driver_id: driver.driver_id,
        vehicle_id: item.state.vehicle_id,
        vehicle_no: item.state.vehicle_no,
        distance_km: round(item.distance_km, 3),
        eta_seconds: etaSeconds,
        vector_cosine: round(vectorCosine),
        eta_score: round(eta),
        acceptance_probability: null,
        driver_reliability: round(reliability),
        call_risk_score: null,
        final_score: round(finalScore),
        score_components: {
          cosine: round(vectorCosine),
          eta: round(eta),
          acceptance: null,
          reliability: round(reliability),
          destination_value: null,
          dispatch_balance: null,
        },
        status_snapshot: {
          online_status: item.state.online_status,
          empty_status: item.state.empty_status,
          can_receive_call: item.state.can_receive_call,
          location_updated_at: item.state.location_updated_at,
          current_trip_status: item.state.current_trip_status,
          source: item.state.source,
        },
      }
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .sort((a, b) => b.final_score - a.final_score || a.distance_km - b.distance_km)
    .slice(0, call.max_candidates)
    .map((item, index) => ({ ...item, rank: index + 1 }))

  const eventLog = call.record_events
    ? await recordCandidateGeneratedEvent(supabase, call, radiusStepUsed, ranked)
    : { status: 'disabled' }

  return NextResponse.json({
    source,
    status: call.simulation_mode ? 'simulated' : 'ok',
    dispatch_id: call.dispatch_id,
    simulation_mode: call.simulation_mode,
    record_events: call.record_events,
    event_log: eventLog,
    callcard_id: call.callcard_id ?? null,
    asp_id: call.asp_id,
    radius_step_used_km: radiusStepUsed,
    radius_steps_km: call.radius_steps_km,
    candidate_counts: {
      realtime_state_rows: states.length,
      nearby: nearby.length,
      profile_joined: drivers.length,
      ranked: ranked.length,
    },
    call_vector: callVector,
    call_risk_score: call.call_risk_score,
    score_formula_version: 'dispatch_v0_cosine_only_explainable_components',
    notes: [
      '기본 호출은 배차 발송/저장을 하지 않습니다. record_events=true일 때만 후보 생성 이벤트 저장을 시도합니다.',
      call.simulation_mode ? 'simulation_mode=true: driver_mbti에서 결정론적 가상 위치/상태를 생성한 결과입니다. 운영 배차에 사용하지 마세요.' : 'driver_realtime_state 실데이터 기준 결과입니다.',
      'final_score는 초기 버전에서 22D vector_cosine만 사용합니다.',
      'ETA, 신뢰도, 수락확률, 콜 위험도는 구성요소로 분리 노출합니다.',
    ],
    recommended_drivers: ranked,
  })
}
