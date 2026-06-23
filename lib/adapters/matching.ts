import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cellToLatLng } from 'h3-js'
import { adaptCallcardLocation } from '@/lib/callcard-location-adapter'
import { buildMatchingRouteLocation, normalizeH3Cell } from '@/lib/h3-dispatch'
import { V2_MATCH_WEIGHTS } from '@/lib/h3-match-score'
import {
  callToVector,
  driverToVector,
  VECTOR_DIMENSIONS,
  type DriverVectorRow,
  type VectorDimensionKey,
} from '@/lib/matching-vector'
import type { MatchingCallcardModel, MatchingDriverModel, MatchingFilterOptions, MatchingStudioModel, MatchingStudioStatus } from '@/lib/matching-studio-model'
import { calculateMatchingCandidate, rankMatchingCandidates, type MatchingCandidateModel } from '@/lib/matching-studio-model'

type DriverMbtiRow = Partial<Record<VectorDimensionKey, number | string | null>> & {
  driver_id?: string | null
  asp_id?: number | string | null
  data_days?: number | string | null
  reliability?: number | string | null
  pref_s_hexagons?: string[] | string | null
  pref_d_hexagons?: string[] | string | null
}

type CallcardRow = {
  callcard_id?: string | null
  asp_id?: number | string | null
  call_date?: string | null
  hour_slot?: number | string | null
  weekday?: number | string | null
  expected_distance?: number | string | null
  expected_fare?: number | string | null
  eta_distance?: number | string | null
  is_paid?: boolean | string | number | null
  is_surge?: boolean | string | number | null
  status_group?: string | null
  passenger_addr?: string | null
  dest_addr?: string | null
  passenger_lat?: number | string | null
  passenger_lng?: number | string | null
  dest_lat?: number | string | null
  dest_lng?: number | string | null
  s_hexagon?: string | null
  d_hexagon?: string | null
}

export type ScenarioPointInput = {
  placeId?: string
  lat: number
  lng: number
  label: string
}

export type ScenarioMatchingRequest = {
  callcardId: string
  origin: ScenarioPointInput
  destination: ScenarioPointInput
}

export type ScenarioMatchingResponse =
  | {
      ok: true
      mode: 'scenario'
      callcardId: string
      route: MatchingCallcardModel['route']
      candidates: MatchingCandidateModel[]
      formula: MatchingStudioModel['formula']
    }
  | {
      ok: false
      state: 'invalid_input' | 'not_found' | 'error'
      message: string
    }

const SLICE_LIMIT = 200
const CALLCARD_STATUS_GROUPS = ['accepted', 'expired', 'canceled']
const DRIVER_PAGE_SIZE = 1000
const TOP_CANDIDATE_LIMIT = 10

const CALLCARD_COLUMNS = [
  'callcard_id', 'asp_id', 'call_date', 'hour_slot', 'weekday', 'expected_distance', 'expected_fare',
  'eta_distance', 'is_paid', 'is_surge', 'status_group', 'passenger_addr', 'dest_addr',
  'passenger_lat', 'passenger_lng', 'dest_lat', 'dest_lng', 's_hexagon', 'd_hexagon',
].join(',')

const DRIVER_COLUMNS = [
  'driver_id', 'asp_id', 'data_days', 'reliability', 'pref_s_hexagons', 'pref_d_hexagons',
  ...VECTOR_DIMENSIONS.map((dimension) => dimension.key),
].join(',')

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function boolValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') return ['true', '1', 'y', 'yes', 'paid'].includes(value.trim().toLowerCase())
  return false
}

function cleanString(value: string | null | undefined): string | null {
  const next = value?.trim()
  return next ? next : null
}

function normalizePreferredCells(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map((cell) => cell.trim()).filter(Boolean)
  if (typeof value !== 'string') return []

  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed.map((cell) => String(cell).trim()).filter(Boolean)
  } catch {
    // Fall back to comma-separated text below.
  }

  return trimmed.split(',').map((cell) => cell.trim()).filter(Boolean)
}

function completeDriverVectorRow(row: DriverMbtiRow): { vectorRow: DriverVectorRow | null; missing: VectorDimensionKey[] } {
  const missing: VectorDimensionKey[] = []
  const vectorRow = {} as Record<VectorDimensionKey, number>

  for (const dimension of VECTOR_DIMENSIONS) {
    const value = nullableNumber(row[dimension.key])
    if (value == null) {
      missing.push(dimension.key)
    } else {
      vectorRow[dimension.key] = value
    }
  }

  return {
    vectorRow: missing.length ? null : vectorRow as DriverVectorRow,
    missing,
  }
}
function callcardModel(row: CallcardRow): MatchingCallcardModel | null {
  const id = cleanString(row.callcard_id)
  if (!id) return null

  const hourSlot = nullableNumber(row.hour_slot)
  const weekday = nullableNumber(row.weekday)
  const expectedDistance = nullableNumber(row.expected_distance)
  const expectedFare = nullableNumber(row.expected_fare)
  const etaDistance = nullableNumber(row.eta_distance)
  const isPaid = boolValue(row.is_paid)
  const isSurge = boolValue(row.is_surge)
  const adapted = adaptCallcardLocation(row)

  const vector = callToVector({
    hour_slot: hourSlot ?? 0,
    weekday: weekday ?? 0,
    expected_distance: expectedDistance ?? 0,
    expected_fare: expectedFare ?? 0,
    is_paid: isPaid,
    is_surge: isSurge,
    eta_distance: etaDistance,
    s_hexagon: adapted.route.pickup.h3Res7,
    d_hexagon: adapted.route.destination.h3Res7,
  })

  return {
    id,
    aspId: nullableNumber(row.asp_id),
    callDate: row.call_date ?? null,
    hourSlot,
    weekday,
    expectedDistance,
    expectedFare,
    etaDistance,
    isPaid,
    isSurge,
    statusGroup: cleanString(row.status_group),
    passengerAddress: cleanString(row.passenger_addr),
    destinationAddress: cleanString(row.dest_addr),
    route: adapted.route,
    diagnostics: adapted.diagnostics,
    vector,
    vectorAvailable: vector.length === VECTOR_DIMENSIONS.length,
  }
}
function scenarioCallcardModel(row: CallcardRow, request: ScenarioMatchingRequest): MatchingCallcardModel | null {
  const base = callcardModel(row)
  if (!base) return null

  const scenarioRoute = buildMatchingRouteLocation(
    {
      lat: request.origin.lat,
      lng: request.origin.lng,
      h3Res7: null,
      roadAddress: request.origin.label,
    },
    {
      lat: request.destination.lat,
      lng: request.destination.lng,
      h3Res7: null,
      roadAddress: request.destination.label,
    },
  )

  return {
    ...base,
    passengerAddress: request.origin.label,
    destinationAddress: request.destination.label,
    route: scenarioRoute,
    diagnostics: {
      pickupH3Source: scenarioRoute.pickup.h3Res7 ? 'COORDINATE' : 'NONE',
      destinationH3Source: scenarioRoute.destination.h3Res7 ? 'COORDINATE' : 'NONE',
      pickupH3Mismatch: false,
      destinationH3Mismatch: false,
      pickupCoordinateValid: scenarioRoute.pickup.h3Res7 != null,
      destinationCoordinateValid: scenarioRoute.destination.h3Res7 != null,
    },
  }
}

function driverModel(row: DriverMbtiRow): MatchingDriverModel | null {
  const id = cleanString(row.driver_id)
  if (!id) return null

  const vectorCheck = completeDriverVectorRow(row)
  const vector = vectorCheck.vectorRow ? driverToVector(vectorCheck.vectorRow) : []

  return {
    id,
    aspId: nullableNumber(row.asp_id),
    dataDays: nullableNumber(row.data_days),
    reliability: nullableNumber(row.reliability),
    prefOriginH3: normalizePreferredCells(row.pref_s_hexagons),
    prefDestinationH3: normalizePreferredCells(row.pref_d_hexagons),
    vector,
    vectorAvailable: vector.length === VECTOR_DIMENSIONS.length && vectorCheck.missing.length === 0,
    missingDimensions: vectorCheck.missing,
  }
}

function source() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'
}

function emptyModel(status: MatchingStudioStatus, message: string): MatchingStudioModel {
  return {
    status,
    message,
    source: 'none',
    callcards: [],
    drivers: [],
    candidatesByCallcard: {},
    filterOptions: { asps: [], dates: [], hours: Array.from({ length: 24 }, (_, i) => i), statuses: CALLCARD_STATUS_GROUPS },
    driverCount: 0,
    callcardCount: 0,
    limits: {
      callcards: SLICE_LIMIT,
      drivers: DRIVER_PAGE_SIZE,
      topCandidates: TOP_CANDIDATE_LIMIT,
    },
    formula: {
      similarityWeight: V2_MATCH_WEIGHTS.similarity,
      spatialWeight: V2_MATCH_WEIGHTS.spatial,
      originSpatialWeight: V2_MATCH_WEIGHTS.originWithinSpatial,
      destinationSpatialWeight: V2_MATCH_WEIGHTS.destinationWithinSpatial,
    },
  }
}

function withH3Center(candidate: MatchingCandidateModel): MatchingCandidateModel {
  if (!candidate.displayH3.cell) return candidate

  try {
    const [lat, lng] = cellToLatLng(candidate.displayH3.cell)
    return {
      ...candidate,
      displayH3: {
        ...candidate.displayH3,
        lat,
        lng,
      },
    }
  } catch {
    return candidate
  }
}

async function fetchDriversByAsp(
  supabase: SupabaseClient,
  driverColumns: string,
  aspId: number | null,
): Promise<{ data: MatchingDriverModel[]; count: number; error: string | null }> {
  const drivers: MatchingDriverModel[] = []
  let from = 0
  let totalCount = 0

  while (true) {
    let query = supabase
      .from('driver_mbti')
      .select(driverColumns, { count: from === 0 ? 'planned' : undefined })
      .order('driver_id', { ascending: true })
      .range(from, from + DRIVER_PAGE_SIZE - 1)

    if (aspId != null) query = query.eq('asp_id', aspId)

    const response = await query
    if (response.error) {
      return { data: drivers, count: totalCount || drivers.length, error: response.error.message }
    }

    if (from === 0) totalCount = response.count ?? 0

    const rows = (response.data ?? [])
      .map((row) => driverModel(row as unknown as DriverMbtiRow))
      .filter((row): row is MatchingDriverModel => row != null)
    drivers.push(...rows)

    if ((response.data ?? []).length < DRIVER_PAGE_SIZE) break
    from += DRIVER_PAGE_SIZE
  }

  return { data: drivers, count: totalCount || drivers.length, error: null }
}

// Driver vectors for an ASP only change when the pipeline refreshes, but every on-demand
// callcard match needs the full ASP cohort. Cache each cohort briefly so repeat matches
// within the same ASP skip the multi-page Supabase fetch entirely.
const DRIVER_CACHE_TTL_MS = 5 * 60 * 1000
type DriverGroup = { data: MatchingDriverModel[]; count: number; error: string | null }
const driverGroupCache = new Map<number | null, { value: DriverGroup; expires: number }>()

async function fetchDriversByAspCached(
  supabase: SupabaseClient,
  driverColumns: string,
  aspId: number | null,
): Promise<DriverGroup> {
  const hit = driverGroupCache.get(aspId)
  if (hit && hit.expires > Date.now()) return hit.value

  const result = await fetchDriversByAsp(supabase, driverColumns, aspId)
  if (!result.error) driverGroupCache.set(aspId, { value: result, expires: Date.now() + DRIVER_CACHE_TTL_MS })
  return result
}

type DriverPrefCache = Map<MatchingDriverModel, { origin: string[]; destination: string[] }>

// Driver preferred H3 cells are reused across every callcard in their ASP, so normalize
// them exactly once instead of re-validating each cell on every callcard × driver pair.
function buildDriverPrefCache(drivers: MatchingDriverModel[]): DriverPrefCache {
  const cache: DriverPrefCache = new Map()
  for (const driver of drivers) {
    if (cache.has(driver)) continue
    cache.set(driver, {
      origin: driver.prefOriginH3.map((cell) => normalizeH3Cell(cell)).filter((cell): cell is string => cell != null),
      destination: driver.prefDestinationH3.map((cell) => normalizeH3Cell(cell)).filter((cell): cell is string => cell != null),
    })
  }
  return cache
}

function buildCandidatesForCallcard(
  callcard: MatchingCallcardModel,
  drivers: MatchingDriverModel[],
  prefCache?: DriverPrefCache,
): MatchingCandidateModel[] {
  return rankMatchingCandidates(
    drivers
      .map((driver) => calculateMatchingCandidate(callcard, driver, prefCache?.get(driver)))
      .filter((candidate): candidate is MatchingCandidateModel => candidate != null)
      .map(withH3Center),
  ).slice(0, TOP_CANDIDATE_LIMIT)
}

async function fetchCallcardSlice(
  supabase: SupabaseClient,
  aspId: number | null,
  date: string | null,
  hour: number | null,
  status: string | null,
): Promise<{ callcards: MatchingCallcardModel[]; error: string | null }> {
  let query = supabase
    .from('callcard_mbti')
    .select(CALLCARD_COLUMNS)
    .order('call_date', { ascending: false })
    .order('hour_slot', { ascending: true })
    .order('callcard_id', { ascending: true })
    .limit(SLICE_LIMIT)

  if (aspId != null) query = query.eq('asp_id', aspId)
  if (date) query = query.eq('call_date', date)
  if (hour != null) query = query.eq('hour_slot', hour)
  if (status) query = query.eq('status_group', status)

  const response = await query
  if (response.error) return { callcards: [], error: response.error.message }

  const callcards = (response.data ?? [])
    .map((row) => callcardModel(row as unknown as CallcardRow))
    .filter((row): row is MatchingCallcardModel => row != null)
  return { callcards, error: null }
}

// PostgREST has no DISTINCT and caps rows at 1000, and ordering clusters identical values, so a
// naive `select asp_id`/`select call_date` only ever returns one value. ASPs are low-cardinality,
// so walk them with keyset paging; dates are daily-contiguous, so derive them from min..max.
async function fetchDistinctAsps(supabase: SupabaseClient): Promise<number[]> {
  const asps: number[] = []
  let last: number | null = null

  for (let guard = 0; guard < 100; guard++) {
    let query = supabase.from('callcard_mbti').select('asp_id').not('asp_id', 'is', null).order('asp_id', { ascending: true }).limit(1)
    if (last != null) query = query.gt('asp_id', last)

    const response = await query
    const value = nullableNumber((response.data?.[0] as { asp_id?: unknown } | undefined)?.asp_id)
    if (value == null) break
    asps.push(value)
    last = value
  }

  return asps
}

function enumerateDatesDesc(minDate: string | null, maxDate: string | null): string[] {
  if (!minDate || !maxDate) return maxDate ? [maxDate] : minDate ? [minDate] : []

  const start = new Date(`${minDate}T00:00:00Z`)
  const end = new Date(`${maxDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [maxDate]

  const dates: string[] = []
  for (const cursor = new Date(end); cursor >= start && dates.length <= 400; cursor.setUTCDate(cursor.getUTCDate() - 1)) {
    dates.push(cursor.toISOString().slice(0, 10))
  }
  return dates
}

async function fetchFilterOptions(supabase: SupabaseClient): Promise<MatchingFilterOptions> {
  const [asps, minRes, maxRes] = await Promise.all([
    fetchDistinctAsps(supabase),
    supabase.from('callcard_mbti').select('call_date').not('call_date', 'is', null).order('call_date', { ascending: true }).limit(1),
    supabase.from('callcard_mbti').select('call_date').not('call_date', 'is', null).order('call_date', { ascending: false }).limit(1),
  ])

  const minDate = cleanString((minRes.data?.[0] as { call_date?: string | null } | undefined)?.call_date)
  const maxDate = cleanString((maxRes.data?.[0] as { call_date?: string | null } | undefined)?.call_date)
  return {
    asps,
    dates: enumerateDatesDesc(minDate, maxDate),
    hours: Array.from({ length: 24 }, (_, i) => i),
    statuses: CALLCARD_STATUS_GROUPS,
  }
}

// The driver cohort for a callcard's ASP is the expensive part; cache it so on-demand
// matches stay snappy. No matching score changes — this only reuses already-computed inputs.
function buildOriginalCandidates(callcard: MatchingCallcardModel, drivers: MatchingDriverModel[]): MatchingCandidateModel[] {
  return buildCandidatesForCallcard(callcard, drivers, buildDriverPrefCache(drivers))
}

export type CallcardSliceResponse =
  | { ok: true; callcards: MatchingCallcardModel[] }
  | { ok: false; message: string }

export async function getCallcardSlice(aspId: number | null, date: string | null, hour: number | null, status: string | null): Promise<CallcardSliceResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return { ok: false, message: '서버 설정이 필요합니다.' }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { callcards, error } = await fetchCallcardSlice(supabase, aspId, date, hour, status)
  if (error) return { ok: false, message: '콜카드 목록을 불러오지 못했습니다.' }
  return { ok: true, callcards }
}

export type OriginalMatchingResponse =
  | { ok: true; callcardId: string; candidates: MatchingCandidateModel[] }
  | { ok: false; state: 'invalid_input' | 'not_found' | 'error'; message: string }

export async function calculateOriginalMatching(callcardId: string): Promise<OriginalMatchingResponse> {
  if (!isValidScenarioCallcardId(callcardId)) {
    return { ok: false, state: 'invalid_input', message: '유효한 콜카드 ID가 필요합니다.' }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return { ok: false, state: 'error', message: '매칭 서버 설정이 필요합니다.' }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const callcardRes = await supabase
    .from('callcard_mbti')
    .select(CALLCARD_COLUMNS)
    .eq('callcard_id', callcardId)
    .limit(1)
    .maybeSingle()

  if (callcardRes.error) return { ok: false, state: 'error', message: '콜카드 조회에 실패했습니다.' }
  if (!callcardRes.data) return { ok: false, state: 'not_found', message: '선택한 콜카드를 찾을 수 없습니다.' }

  const callcard = callcardModel(callcardRes.data as unknown as CallcardRow)
  if (!callcard) return { ok: false, state: 'error', message: '콜카드 데이터를 해석할 수 없습니다.' }

  const driverGroup = await fetchDriversByAspCached(supabase, DRIVER_COLUMNS, callcard.aspId)
  if (driverGroup.error) return { ok: false, state: 'error', message: '기사 벡터 조회에 실패했습니다.' }

  return { ok: true, callcardId: callcard.id, candidates: buildOriginalCandidates(callcard, driverGroup.data) }
}

// The bootstrap build only fetches the default slice + first callcard's cohort now, so it is
// far cheaper than the old precompute-all. A short TTL still keeps repeat loads instant.
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000
let modelCache: { value: MatchingStudioModel; expires: number } | null = null

export async function getMatchingStudioModel(): Promise<MatchingStudioModel> {
  if (modelCache && modelCache.expires > Date.now()) return modelCache.value

  const model = await buildMatchingStudioModel()
  if (model.status === 'success' || model.status === 'partial') {
    modelCache = { value: model, expires: Date.now() + MODEL_CACHE_TTL_MS }
  }
  return model
}

// Bootstrap: load the filter options + the default callcard slice (newest date), then compute
// Top 10 for only the first callcard. Every other callcard is matched lazily on demand, so we
// no longer fetch all driver cohorts or rank all 80 callcards up front.
async function buildMatchingStudioModel(): Promise<MatchingStudioModel> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return emptyModel('error', 'Matching Studio requires Supabase environment variables.')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const [filterOptions, totalRes, slice] = await Promise.all([
    fetchFilterOptions(supabase),
    supabase.from('callcard_mbti').select('callcard_id', { count: 'estimated', head: true }),
    fetchCallcardSlice(supabase, null, null, null, null),
  ])

  if (slice.error) {
    return emptyModel('error', 'Matching Studio could not load callcard rows.')
  }

  const callcards = slice.callcards
  const totalCount = totalRes.count ?? callcards.length

  if (!callcards.length) {
    return {
      ...emptyModel('empty', 'Matching Studio needs at least one callcard.'),
      filterOptions,
      callcardCount: totalCount,
      source: source(),
    }
  }

  // Eagerly match only the first (default-selected) callcard so the initial view is populated.
  const firstCallcard = callcards[0]
  const driverGroup = await fetchDriversByAspCached(supabase, DRIVER_COLUMNS, firstCallcard.aspId)
  const driverError = driverGroup.error
  const firstCandidates = driverError ? [] : buildOriginalCandidates(firstCallcard, driverGroup.data)
  const candidatesByCallcard = firstCandidates.length ? { [firstCallcard.id]: firstCandidates } : {}
  const drivers = firstCandidates.map((candidate) => candidate.driver)

  return {
    status: driverError ? 'partial' : 'success',
    message: driverError
        ? 'Driver vectors were unavailable. Callcard rows loaded, but matching cannot be fully evaluated.'
        : 'Matching Studio loaded callcards and driver vectors from Supabase.',
    source: source(),
    callcards,
    drivers,
    candidatesByCallcard,
    filterOptions,
    driverCount: driverGroup.count,
    callcardCount: totalCount,
    limits: {
      callcards: SLICE_LIMIT,
      drivers: DRIVER_PAGE_SIZE,
      topCandidates: TOP_CANDIDATE_LIMIT,
    },
    formula: {
      similarityWeight: V2_MATCH_WEIGHTS.similarity,
      spatialWeight: V2_MATCH_WEIGHTS.spatial,
      originSpatialWeight: V2_MATCH_WEIGHTS.originWithinSpatial,
      destinationSpatialWeight: V2_MATCH_WEIGHTS.destinationWithinSpatial,
    },
  }
}

function formula() {
  return {
    similarityWeight: V2_MATCH_WEIGHTS.similarity,
    spatialWeight: V2_MATCH_WEIGHTS.spatial,
    originSpatialWeight: V2_MATCH_WEIGHTS.originWithinSpatial,
    destinationSpatialWeight: V2_MATCH_WEIGHTS.destinationWithinSpatial,
  }
}

function isValidScenarioPoint(point: ScenarioPointInput | null | undefined): point is ScenarioPointInput {
  const label = point?.label?.trim() ?? ''
  const placeId = point?.placeId?.trim() ?? ''
  return Boolean(
    point &&
    label.length > 0 &&
    label.length <= 240 &&
    placeId.length <= 256 &&
    typeof point.lat === 'number' &&
    Number.isFinite(point.lat) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lng) &&
    point.lng >= -180 &&
    point.lng <= 180,
  )
}

function isValidScenarioCallcardId(value: string | null | undefined): value is string {
  const normalized = value?.trim() ?? ''
  return normalized.length > 0 && normalized.length <= 128
}

export async function calculateScenarioMatching(request: ScenarioMatchingRequest): Promise<ScenarioMatchingResponse> {
  if (!isValidScenarioCallcardId(request.callcardId) || !isValidScenarioPoint(request.origin) || !isValidScenarioPoint(request.destination)) {
    return { ok: false, state: 'invalid_input', message: '콜카드와 확정된 출발지·도착지가 필요합니다.' }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, state: 'error', message: '시나리오 매칭 서버 설정이 필요합니다.' }
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const callcardRes = await supabase
    .from('callcard_mbti')
    .select(CALLCARD_COLUMNS)
    .eq('callcard_id', request.callcardId)
    .limit(1)
    .maybeSingle()

  if (callcardRes.error) {
    return { ok: false, state: 'error', message: '콜카드 조회에 실패했습니다.' }
  }
  if (!callcardRes.data) {
    return { ok: false, state: 'not_found', message: '선택한 콜카드를 찾을 수 없습니다.' }
  }

  const callcard = scenarioCallcardModel(callcardRes.data as unknown as CallcardRow, request)
  if (!callcard || !callcard.route.pickup.h3Res7 || !callcard.route.destination.h3Res7) {
    return { ok: false, state: 'invalid_input', message: '출발지와 도착지를 H3로 변환할 수 없습니다.' }
  }

  const driverGroup = await fetchDriversByAspCached(supabase, DRIVER_COLUMNS, callcard.aspId)
  if (driverGroup.error) {
    return { ok: false, state: 'error', message: '기사 벡터 조회에 실패했습니다.' }
  }

  return {
    ok: true,
    mode: 'scenario',
    callcardId: callcard.id,
    route: callcard.route,
    candidates: buildOriginalCandidates(callcard, driverGroup.data),
    formula: formula(),
  }
}
