import { createClient } from '@supabase/supabase-js'
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
const DRIVER_LIMIT = 1000
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
    driverCount: 0,
    callcardCount: 0,
    limits: {
      callcards: CALLCARD_LIMIT,
      drivers: DRIVER_LIMIT,
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

  const [callcardsRes, driversRes] = await Promise.all([
    supabase.from('callcard_mbti').select(callcardColumns, { count: 'planned' }).order('call_date', { ascending: false }).limit(CALLCARD_LIMIT),
    supabase.from('driver_mbti').select(driverColumns, { count: 'planned' }).order('data_days', { ascending: false }).limit(DRIVER_LIMIT),
  ])

  if (callcardsRes.error && driversRes.error) {
    return emptyModel('error', `Matching data query failed: ${callcardsRes.error.message}; ${driversRes.error.message}`)
  }

  const callcards = (callcardsRes.data ?? [])
    .map((row) => callcardModel(row as unknown as CallcardRow))
    .filter((row): row is MatchingCallcardModel => row != null)
  const drivers = (driversRes.data ?? [])
    .map((row) => driverModel(row as unknown as DriverMbtiRow))
    .filter((row): row is MatchingDriverModel => row != null)

  if (!callcards.length || !drivers.length) {
    return {
      ...emptyModel('empty', 'Matching Studio needs at least one callcard and one driver vector.'),
      callcards,
      drivers,
      callcardCount: callcardsRes.count ?? callcards.length,
      driverCount: driversRes.count ?? drivers.length,
      source: source(),
    }
  }

  return {
    status: callcardsRes.error || driversRes.error ? 'partial' : 'success',
    message: callcardsRes.error
      ? 'Callcard rows were unavailable. Driver vectors loaded, but matching cannot be fully evaluated.'
      : driversRes.error
        ? 'Driver vectors were unavailable. Callcard rows loaded, but matching cannot be fully evaluated.'
        : 'Matching Studio loaded callcards and driver vectors from Supabase.',
    source: source(),
    callcards,
    drivers,
    driverCount: driversRes.count ?? drivers.length,
    callcardCount: callcardsRes.count ?? callcards.length,
    limits: {
      callcards: CALLCARD_LIMIT,
      drivers: DRIVER_LIMIT,
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
