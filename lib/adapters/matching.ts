import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cellToLatLng } from 'h3-js'
import { adaptCallcardLocation } from '@/lib/callcard-location-adapter'
import { V2_MATCH_WEIGHTS } from '@/lib/h3-match-score'
import {
  callToVector,
  driverToVector,
  VECTOR_DIMENSIONS,
  type DriverVectorRow,
  type VectorDimensionKey,
} from '@/lib/matching-vector'
import type { MatchingCallcardModel, MatchingDriverModel, MatchingStudioModel, MatchingStudioStatus } from '@/lib/matching-studio-model'
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

const CALLCARD_LIMIT = 80
const DRIVER_PAGE_SIZE = 1000
const TOP_CANDIDATE_LIMIT = 10

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
    driverCount: 0,
    callcardCount: 0,
    limits: {
      callcards: CALLCARD_LIMIT,
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

function buildCandidatesForCallcard(
  callcard: MatchingCallcardModel,
  drivers: MatchingDriverModel[],
): MatchingCandidateModel[] {
  return rankMatchingCandidates(
    drivers
      .map((driver) => calculateMatchingCandidate(callcard, driver))
      .filter((candidate): candidate is MatchingCandidateModel => candidate != null)
      .map(withH3Center),
  ).slice(0, TOP_CANDIDATE_LIMIT)
}

export async function getMatchingStudioModel(): Promise<MatchingStudioModel> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return emptyModel('error', 'Matching Studio requires Supabase environment variables.')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const callcardColumns = [
    'callcard_id', 'asp_id', 'call_date', 'hour_slot', 'weekday', 'expected_distance', 'expected_fare',
    'eta_distance', 'is_paid', 'is_surge', 'status_group', 'passenger_addr', 'dest_addr',
    'passenger_lat', 'passenger_lng', 'dest_lat', 'dest_lng', 's_hexagon', 'd_hexagon',
  ].join(',')
  const driverColumns = [
    'driver_id', 'asp_id', 'data_days', 'reliability', 'pref_s_hexagons', 'pref_d_hexagons',
    ...VECTOR_DIMENSIONS.map((dimension) => dimension.key),
  ].join(',')

  const callcardsRes = await supabase
    .from('callcard_mbti')
    .select(callcardColumns, { count: 'planned' })
    .order('call_date', { ascending: false })
    .limit(CALLCARD_LIMIT)

  if (callcardsRes.error) {
    return emptyModel('error', 'Matching Studio could not load callcard rows.')
  }

  const callcards = (callcardsRes.data ?? [])
    .map((row) => callcardModel(row as unknown as CallcardRow))
    .filter((row): row is MatchingCallcardModel => row != null)

  if (!callcards.length) {
    return {
      ...emptyModel('empty', 'Matching Studio needs at least one callcard.'),
      callcards,
      callcardCount: callcardsRes.count ?? callcards.length,
      source: source(),
    }
  }

  const aspIds = [...new Set(callcards.map((callcard) => callcard.aspId).filter((aspId): aspId is number => aspId != null))]
  const driverGroups = await Promise.all(aspIds.length ? aspIds.map((aspId) => fetchDriversByAsp(supabase, driverColumns, aspId)) : [fetchDriversByAsp(supabase, driverColumns, null)])
  const driverError = driverGroups.find((group) => group.error)?.error ?? null
  const driversByAsp = new Map<number | null, MatchingDriverModel[]>()
  let driverCount = 0

  for (const [index, group] of driverGroups.entries()) {
    const aspId = aspIds.length ? aspIds[index] : null
    driversByAsp.set(aspId, group.data)
    driverCount += group.count
  }

  const candidatesByCallcard = Object.fromEntries(callcards.map((callcard) => {
    const sameAspDrivers = driversByAsp.get(callcard.aspId) ?? driversByAsp.get(null) ?? []
    return [callcard.id, buildCandidatesForCallcard(callcard, sameAspDrivers)]
  }))
  const topCandidateDrivers = new Map<string, MatchingDriverModel>()
  for (const candidates of Object.values(candidatesByCallcard)) {
    for (const candidate of candidates) topCandidateDrivers.set(candidate.driver.id, candidate.driver)
  }
  const drivers = [...topCandidateDrivers.values()]

  if (!drivers.length) {
    return {
      ...emptyModel(driverError ? 'partial' : 'empty', driverError ? 'Driver vectors were unavailable. Callcards loaded, but candidate ranking could not be completed.' : 'Matching Studio needs driver vectors for the selected callcard region.'),
      callcards,
      candidatesByCallcard,
      callcardCount: callcardsRes.count ?? callcards.length,
      driverCount,
      source: source(),
    }
  }

  return {
    status: driverError ? 'partial' : 'success',
    message: driverError
        ? 'Driver vectors were unavailable. Callcard rows loaded, but matching cannot be fully evaluated.'
        : 'Matching Studio loaded callcards and driver vectors from Supabase.',
    source: source(),
    callcards,
    drivers,
    candidatesByCallcard,
    driverCount,
    callcardCount: callcardsRes.count ?? callcards.length,
    limits: {
      callcards: CALLCARD_LIMIT,
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
