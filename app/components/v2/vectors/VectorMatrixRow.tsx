'use client'

import type { VectorEntityModel, VectorFactorModel } from '@/lib/adapters/vectors'
import type { VectorDimensionKey } from '@/lib/matching-vector'
import { entityTypeLabel } from './formatters'
import { VectorCell } from './VectorCell'
import styles from './vectorWorkbench.module.css'

export function VectorMatrixRow({
  entity,
  factors,
  selectedFactorKey,
  selected,
  onSelect,
}: {
  entity: VectorEntityModel
  factors: VectorFactorModel[]
  selectedFactorKey: VectorDimensionKey
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <tr className={styles.matrixRow} data-selected={selected}>
      <th scope="row" className={styles.entityCol}>
        <button type="button" onClick={() => onSelect(entity.id)} data-selected={selected}>
          <span>{entity.label}</span>
          <small>{entityTypeLabel(entity.type)} · {entity.aspId ?? '-'}</small>
        </button>
      </th>
      {factors.map((factor) => (
        <VectorCell key={factor.key} value={entity.vector[factor.index]} factor={factor} selected={selectedFactorKey === factor.key} />
      ))}
    </tr>
  )
}
