import type { VectorDimensionKey } from '@/lib/matching-vector'

export const AXIS_LABELS: Array<{
  label: string
  keys: VectorDimensionKey[]
}> = [
  { label: '픽업 접근성', keys: ['score_near'] },
  { label: '시간대 적합도', keys: ['score_dawn', 'score_morning', 'score_daytime', 'score_night'] },
  { label: '요일 적합도', keys: ['score_mon', 'score_tue', 'score_wed', 'score_thu', 'score_fri', 'score_sat', 'score_sun'] },
  { label: '운행거리 적합도', keys: ['score_short', 'score_medium', 'score_long'] },
  { label: '수익·상품 적합도', keys: ['score_low_fare', 'score_mid_fare', 'score_high_fare', 'score_paid', 'score_free', 'score_surge', 'score_normal'] },
]

export const H3_SOURCE_LABELS = {
  STORED: '저장 데이터',
  COORDINATE: '좌표 계산',
  NONE: '정보 없음',
} as const
