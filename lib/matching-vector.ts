export interface CallVectorInput {
  hour_slot: number
  weekday: number
  expected_distance: number
  expected_fare: number
  is_paid: boolean
  is_surge: boolean
  eta_distance?: number | null
  s_hexagon?: string | null
  d_hexagon?: string | null
}

export interface DriverVectorRow {
  score_dawn: number
  score_morning: number
  score_daytime: number
  score_night: number
  score_mon: number
  score_tue: number
  score_wed: number
  score_thu: number
  score_fri: number
  score_sat: number
  score_sun: number
  score_short: number
  score_medium: number
  score_long: number
  score_low_fare: number
  score_mid_fare: number
  score_high_fare: number
  score_paid: number
  score_free: number
  score_surge: number
  score_normal: number
  score_near: number
}

export const VECTOR_DIMENSIONS = [
  { key: 'score_dawn', label: '새벽', group: '시간대' },
  { key: 'score_morning', label: '오전', group: '시간대' },
  { key: 'score_daytime', label: '주간', group: '시간대' },
  { key: 'score_night', label: '야간', group: '시간대' },
  { key: 'score_mon', label: '월', group: '요일' },
  { key: 'score_tue', label: '화', group: '요일' },
  { key: 'score_wed', label: '수', group: '요일' },
  { key: 'score_thu', label: '목', group: '요일' },
  { key: 'score_fri', label: '금', group: '요일' },
  { key: 'score_sat', label: '토', group: '요일' },
  { key: 'score_sun', label: '일', group: '요일' },
  { key: 'score_short', label: '단거리', group: '거리' },
  { key: 'score_medium', label: '중거리', group: '거리' },
  { key: 'score_long', label: '장거리', group: '거리' },
  { key: 'score_low_fare', label: '저요금', group: '요금' },
  { key: 'score_mid_fare', label: '중요금', group: '요금' },
  { key: 'score_high_fare', label: '고요금', group: '요금' },
  { key: 'score_paid', label: '유료콜', group: '콜유형' },
  { key: 'score_free', label: '무료콜', group: '콜유형' },
  { key: 'score_surge', label: '탄력', group: '상품' },
  { key: 'score_normal', label: '일반', group: '상품' },
  { key: 'score_near', label: '근접성', group: 'ETA' },
] as const

export type VectorDimensionKey = typeof VECTOR_DIMENSIONS[number]['key']

export function etaToNear(eta: number | null | undefined): number {
  if (eta == null || eta <= 0) return 0
  if (eta <= 150) return 1
  if (eta >= 600) return 0
  return 1 - (eta - 150) / 450
}

export function callToVector(input: CallVectorInput): number[] {
  const h = input.hour_slot
  const wd = input.weekday
  const dist = input.expected_distance ?? 0
  const fare = input.expected_fare ?? 0

  return [
    h <= 5 ? 1 : 0,
    h >= 6 && h <= 11 ? 1 : 0,
    h >= 12 && h <= 17 ? 1 : 0,
    h >= 18 ? 1 : 0,
    wd === 0 ? 1 : 0,
    wd === 1 ? 1 : 0,
    wd === 2 ? 1 : 0,
    wd === 3 ? 1 : 0,
    wd === 4 ? 1 : 0,
    wd === 5 ? 1 : 0,
    wd === 6 ? 1 : 0,
    dist > 0 && dist <= 3000 ? 1 : 0,
    dist > 3000 && dist <= 8000 ? 1 : 0,
    dist > 8000 ? 1 : 0,
    fare > 0 && fare <= 10000 ? 1 : 0,
    fare > 10000 && fare <= 20000 ? 1 : 0,
    fare > 20000 ? 1 : 0,
    input.is_paid ? 1 : 0,
    input.is_paid ? 0 : 1,
    input.is_surge ? 1 : 0,
    input.is_surge ? 0 : 1,
    etaToNear(input.eta_distance ?? null),
  ]
}

export function driverToVector(row: DriverVectorRow): number[] {
  return VECTOR_DIMENSIONS.map((dim) => Number(row[dim.key] ?? 0))
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

// ETA-derived dimensions (group 'ETA', e.g. score_near) are excluded from the
// final matching cosine so ETA never contributes to the cosine 75% term. They
// remain in the 22D vector for storage and on-screen display only.
export const MATCHING_EXCLUDED_DIMENSION_KEYS: VectorDimensionKey[] = VECTOR_DIMENSIONS
  .filter((dim) => dim.group === 'ETA')
  .map((dim) => dim.key)

const MATCHING_EXCLUDED_INDICES: readonly number[] = VECTOR_DIMENSIONS
  .map((dim, index) => (dim.group === 'ETA' ? index : -1))
  .filter((index) => index >= 0)

// Returns the vector with ETA-derived dimensions removed, for the final
// matching score. The original 22D vector is left untouched for display.
export function matchingVectorSlice(vector: number[]): number[] {
  if (MATCHING_EXCLUDED_INDICES.length === 0) return vector
  return vector.filter((_, index) => !MATCHING_EXCLUDED_INDICES.includes(index))
}

// Cosine similarity for the final matching score. Cosine is magnitude-normalized,
// so dropping the ETA dimensions re-normalizes correctly over the remaining dims.
export function cosineSimilarityForMatching(a: number[], b: number[]): number {
  return cosineSimilarity(matchingVectorSlice(a), matchingVectorSlice(b))
}

export function scoreDriverForCall(call: CallVectorInput, driver: DriverVectorRow & { pref_s_hexagons?: string[] | null }): number {
  const cosine = cosineSimilarity(callToVector(call), driverToVector(driver))
  const startBonus = call.s_hexagon && driver.pref_s_hexagons?.includes(call.s_hexagon) ? 0.1 : 0
  return Math.min(cosine + startBonus, 1)
}
