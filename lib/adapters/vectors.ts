import { createClient } from '@supabase/supabase-js'
import { callToVector, cosineSimilarity, VECTOR_DIMENSIONS, type VectorDimensionKey } from '@/lib/matching-vector'
import { DISPLAY_AXES } from '@/lib/matching-display-axis'

export type VectorEntityType = 'driver' | 'callcard'
export type VectorWorkbenchStatus = 'success' | 'empty' | 'partial' | 'error'

export type VectorFactorModel = {
  index: number
  key: VectorDimensionKey
  label: string
  group: string
  displayAxis: string
  description: string
  range: '0-1 normalized score'
  validCount: number
  nullCount: number
  min: number | null
  max: number | null
  average: number | null
  median: number | null
  bins: number[]
}

export type VectorEntityModel = {
  id: string
  label: string
  type: VectorEntityType
  aspId: number | null
  date: string | null
  vector: (number | null)[]
  validDimensions: number
  invalidReason: string | null
  meta: {
    dataDays?: number | null
    reliability?: number | null
    totalCalls?: number | null
    expectedDistance?: number | null
    expectedFare?: number | null
    statusGroup?: string | null
    originH3?: string | null
    destinationH3?: string | null
  }
}

export type VectorWorkbenchModel = {
  status: VectorWorkbenchStatus
  message: string
  source: 'service_role' | 'anon' | 'none'
  factors: VectorFactorModel[]
  entities: VectorEntityModel[]
  driverCount: number
  callcardCount: number
  rowLimit: number
  relationshipSampleLimit: number
  cosineAvailable: boolean
}

type DriverMbtiRow = Record<VectorDimensionKey, number | string | null> & {
  driver_id: string | null
  asp_id: number | string | null
  data_days?: number | string | null
  reliability?: number | string | null
  updated_at?: string | null
}

type CallcardRow = {
  callcard_id: string | null
  asp_id: number | string | null
  call_date: string | null
  hour_slot: number | string | null
  weekday: number | string | null
  expected_distance: number | string | null
  expected_fare: number | string | null
  is_paid: boolean | string | number | null
  eta_distance: number | string | null
  is_surge: boolean | string | number | null
  status_group?: string | null
  s_hexagon?: string | null
  d_hexagon?: string | null
}

const DRIVER_LIMIT = 120
const CALLCARD_LIMIT = 80
const RELATIONSHIP_SAMPLE_LIMIT = 120

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function boolValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') return ['true', '1', 'y', 'yes'].includes(value.trim().toLowerCase())
  return false
}

function normalizeVector(values: unknown[]): (number | null)[] {
  return values.map((value) => nullableNumber(value))
}

function vectorIssue(vector: (number | null)[]): string | null {
  if (vector.length !== VECTOR_DIMENSIONS.length) return `Expected ${VECTOR_DIMENSIONS.length}D vector, received ${vector.length}D.`
  if (vector.some((value) => value == null)) return 'Vector contains null or unavailable dimensions.'
  return null
}

function axisNameFor(key: VectorDimensionKey): string {
  return DISPLAY_AXES.find((axis) => axis.dimensionKeys.includes(key))?.name ?? '표시축 미지정'
}

function percentile(values: number[], q: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  return next == null ? sorted[base] : sorted[base] + rest * (next - sorted[base])
}

function bins(values: number[]): number[] {
  const result = Array.from({ length: 10 }, () => 0)
  for (const value of values) {
    const index = Math.max(0, Math.min(9, Math.floor(value * 10)))
    result[index] += 1
  }
  return result
}

function buildFactors(entities: VectorEntityModel[]): VectorFactorModel[] {
  return VECTOR_DIMENSIONS.map((dimension, index) => {
    const rawValues = entities.map((entity) => entity.vector[index])
    const values = rawValues.filter((value): value is number => value != null && Number.isFinite(value))
    const sum = values.reduce((acc, value) => acc + value, 0)
    return {
      index,
      key: dimension.key,
      label: dimension.label,
      group: dimension.group,
      displayAxis: axisNameFor(dimension.key),
      description: '정의 정보 없음',
      range: '0-1 normalized score',
      validCount: values.length,
      nullCount: rawValues.length - values.length,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      average: values.length ? sum / values.length : null,
      median: percentile(values, 0.5),
      bins: bins(values),
    }
  })
}

function driverEntity(row: DriverMbtiRow): VectorEntityModel | null {
  const id = String(row.driver_id ?? '').trim()
  if (!id) return null
  const vector = normalizeVector(VECTOR_DIMENSIONS.map((dimension) => row[dimension.key]))
  return {
    id: `driver:${id}`,
    label: id,
    type: 'driver',
    aspId: nullableNumber(row.asp_id),
    date: row.updated_at ?? null,
    vector,
    validDimensions: vector.filter((value) => value != null).length,
    invalidReason: vectorIssue(vector),
    meta: {
      dataDays: nullableNumber(row.data_days),
      reliability: nullableNumber(row.reliability),
    },
  }
}

function callcardEntity(row: CallcardRow): VectorEntityModel | null {
  const id = String(row.callcard_id ?? '').trim()
  if (!id) return null
  const input = {
    hour_slot: nullableNumber(row.hour_slot) ?? 0,
    weekday: nullableNumber(row.weekday) ?? 0,
    expected_distance: nullableNumber(row.expected_distance) ?? 0,
    expected_fare: nullableNumber(row.expected_fare) ?? 0,
    is_paid: boolValue(row.is_paid),
    eta_distance: nullableNumber(row.eta_distance),
    is_surge: boolValue(row.is_surge),
    s_hexagon: row.s_hexagon ?? null,
    d_hexagon: row.d_hexagon ?? null,
  }
  const vector = callToVector(input)
  return {
    id: `callcard:${id}`,
    label: id,
    type: 'callcard',
    aspId: nullableNumber(row.asp_id),
    date: row.call_date ?? null,
    vector,
    validDimensions: vector.length,
    invalidReason: vectorIssue(vector),
    meta: {
      expectedDistance: nullableNumber(row.expected_distance),
      expectedFare: nullableNumber(row.expected_fare),
      statusGroup: row.status_group ?? null,
      originH3: row.s_hexagon ?? null,
      destinationH3: row.d_hexagon ?? null,
    },
  }
}

function source() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'
}

function emptyModel(status: VectorWorkbenchStatus, message: string): VectorWorkbenchModel {
  return {
    status,
    message,
    source: 'none',
    factors: buildFactors([]),
    entities: [],
    driverCount: 0,
    callcardCount: 0,
    rowLimit: DRIVER_LIMIT + CALLCARD_LIMIT,
    relationshipSampleLimit: RELATIONSHIP_SAMPLE_LIMIT,
    cosineAvailable: false,
  }
}

export function calculateEntityCosine(a: VectorEntityModel | null | undefined, b: VectorEntityModel | null | undefined): number | null {
  if (!a || !b) return null
  if (a.invalidReason || b.invalidReason) return null
  if (a.vector.length !== VECTOR_DIMENSIONS.length || b.vector.length !== VECTOR_DIMENSIONS.length) return null
  if (a.vector.some((value) => value == null) || b.vector.some((value) => value == null)) return null
  return cosineSimilarity(a.vector as number[], b.vector as number[])
}

export async function getVectorWorkbenchModel(): Promise<VectorWorkbenchModel> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return emptyModel('error', 'Missing Supabase environment variables for vector workbench.')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const driverColumns = [
    'driver_id', 'asp_id', 'data_days', 'reliability', 'updated_at',
    ...VECTOR_DIMENSIONS.map((dimension) => dimension.key),
  ].join(',')
  const callcardColumns = [
    'callcard_id', 'asp_id', 'call_date', 'hour_slot', 'weekday', 'expected_distance', 'expected_fare',
    'is_paid', 'eta_distance', 'is_surge', 'status_group', 's_hexagon', 'd_hexagon',
  ].join(',')

  const [driversRes, callcardsRes] = await Promise.all([
    supabase.from('driver_mbti').select(driverColumns, { count: 'planned' }).order('data_days', { ascending: false }).limit(DRIVER_LIMIT),
    supabase.from('callcard_mbti').select(callcardColumns, { count: 'planned' }).order('call_date', { ascending: false }).limit(CALLCARD_LIMIT),
  ])

  if (driversRes.error && callcardsRes.error) {
    return emptyModel('error', `Vector source query failed: ${driversRes.error.message}; ${callcardsRes.error.message}`)
  }

  const driverEntities = (driversRes.data ?? []).map((row) => driverEntity(row as unknown as DriverMbtiRow)).filter(Boolean) as VectorEntityModel[]
  const callcardEntities = (callcardsRes.data ?? []).map((row) => callcardEntity(row as unknown as CallcardRow)).filter(Boolean) as VectorEntityModel[]
  const entities = [...callcardEntities, ...driverEntities]

  if (!entities.length) {
    return emptyModel('empty', 'No vector entities are available from driver_mbti or callcard_mbti.')
  }

  return {
    status: driversRes.error || callcardsRes.error ? 'partial' : 'success',
    message: driversRes.error
      ? `Driver vectors unavailable: ${driversRes.error.message}`
      : callcardsRes.error
        ? `Callcard vectors unavailable: ${callcardsRes.error.message}`
        : 'Vector entities loaded from Supabase tables.',
    source: source(),
    factors: buildFactors(entities),
    entities,
    driverCount: driversRes.count ?? driverEntities.length,
    callcardCount: callcardsRes.count ?? callcardEntities.length,
    rowLimit: DRIVER_LIMIT + CALLCARD_LIMIT,
    relationshipSampleLimit: RELATIONSHIP_SAMPLE_LIMIT,
    cosineAvailable: entities.filter((entity) => !entity.invalidReason).length >= 2,
  }
}

