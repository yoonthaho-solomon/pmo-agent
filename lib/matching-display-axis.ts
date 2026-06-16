import { VECTOR_DIMENSIONS, type VectorDimensionKey } from './matching-vector'

export type DisplayAxisKey =
  | 'pickup_accessibility'
  | 'time_fit'
  | 'weekday_fit'
  | 'distance_fit'
  | 'revenue_product_fit'
export type DisplayAxisDefinition = {
  key: DisplayAxisKey
  name: string
  dimensionKeys: readonly VectorDimensionKey[]
  indexes: readonly number[]
}

export type DisplayAxisFactor = {
  index: number
  key: VectorDimensionKey
  label: string
  group: string
  value: number | null
  score: number | null
}

export type DisplayAxisBundle = {
  axis: number[]
  sub: number[][]
}

export const EXPECTED_DISPLAY_VECTOR_LENGTH = VECTOR_DIMENSIONS.length

function indexesFor(keys: readonly VectorDimensionKey[]): number[] {
  return keys.map((key) => {
    const index = VECTOR_DIMENSIONS.findIndex((dimension) => dimension.key === key)
    if (index < 0) throw new Error(`Unknown vector dimension key: ${key}`)
    return index
  })
}

export const DISPLAY_AXES: readonly DisplayAxisDefinition[] = [
  {
    key: 'pickup_accessibility',
    name: '픽업 접근성',
    dimensionKeys: ['score_near'],
    indexes: indexesFor(['score_near']),
  },
  {
    key: 'time_fit',
    name: '시간대 적합도',
    dimensionKeys: ['score_dawn', 'score_morning', 'score_daytime', 'score_night'],
    indexes: indexesFor(['score_dawn', 'score_morning', 'score_daytime', 'score_night']),
  },
  {
    key: 'weekday_fit',
    name: '요일 적합도',
    dimensionKeys: ['score_mon', 'score_tue', 'score_wed', 'score_thu', 'score_fri', 'score_sat', 'score_sun'],
    indexes: indexesFor(['score_mon', 'score_tue', 'score_wed', 'score_thu', 'score_fri', 'score_sat', 'score_sun']),
  },
  {
    key: 'distance_fit',
    name: '운행거리 적합도',
    dimensionKeys: ['score_short', 'score_medium', 'score_long'],
    indexes: indexesFor(['score_short', 'score_medium', 'score_long']),
  },
  {
    key: 'revenue_product_fit',
    name: '수익·상품 적합도',
    dimensionKeys: ['score_low_fare', 'score_mid_fare', 'score_high_fare', 'score_paid', 'score_free', 'score_surge', 'score_normal'],
    indexes: indexesFor(['score_low_fare', 'score_mid_fare', 'score_high_fare', 'score_paid', 'score_free', 'score_surge', 'score_normal']),
  },
] as const
export function normalizeDisplayAxisValue(value: number | null | undefined): number | null {
  if (value == null) return null
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, value * 100))
}

export function averagePresent(values: readonly (number | null | undefined)[]): number {
  const present = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (present.length === 0) return 0
  return present.reduce((sum, value) => sum + value, 0) / present.length
}

export function isDisplayVectorLengthValid(vector: readonly unknown[]): boolean {
  return vector.length === EXPECTED_DISPLAY_VECTOR_LENGTH
}

export function vectorToDisplayAxisBundle(vector: readonly (number | null | undefined)[]): DisplayAxisBundle {
  const sub = DISPLAY_AXES.map((axis) =>
    axis.indexes.map((index) => normalizeDisplayAxisValue(vector[index]))
  )
  return {
    axis: sub.map((values) => averagePresent(values)),
    sub: sub.map((values) => values.map((value) => value ?? 0)),
  }
}

export function getDisplayAxisFactors(
  vector: readonly (number | null | undefined)[],
  axisIndex: number,
): DisplayAxisFactor[] {
  const axis = DISPLAY_AXES[axisIndex]
  if (!axis) return []

  return axis.indexes.map((index) => {
    const dimension = VECTOR_DIMENSIONS[index]
    const value = vector[index]
    return {
      index,
      key: dimension.key,
      label: dimension.label,
      group: dimension.group,
      value: value == null || !Number.isFinite(value) ? null : value,
      score: normalizeDisplayAxisValue(value),
    }
  })
}
