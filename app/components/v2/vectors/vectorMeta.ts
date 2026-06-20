import { DISPLAY_AXES } from '@/lib/matching-display-axis'
import { VECTOR_DIMENSIONS, type VectorDimensionKey } from '@/lib/matching-vector'

export const FACTOR_GROUPS = ['all', ...Array.from(new Set(VECTOR_DIMENSIONS.map((factor) => factor.group)))] as const

export const ENTITY_TYPE_LABEL = {
  all: 'All entities',
  driver: 'Driver vectors',
  callcard: 'Callcard vectors',
} as const

export function displayAxisForFactor(key: VectorDimensionKey) {
  return DISPLAY_AXES.find((axis) => axis.dimensionKeys.includes(key))?.name ?? '표시축 미지정'
}
