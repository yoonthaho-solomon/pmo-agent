'use client'

import type { VectorEntityModel, VectorFactorModel } from '@/lib/adapters/vectors'
import type { VectorDimensionKey } from '@/lib/matching-vector'
import { VectorMatrixRow } from './VectorMatrixRow'
import { VectorMatrixToolbar } from './VectorMatrixToolbar'
import type { EntityFilter, SortMode } from './useVectorWorkbench'
import styles from './vectorWorkbench.module.css'

export function VectorMatrix({
  factors,
  visibleEntities,
  totalEntities,
  selectedFactorKey,
  selectedEntityId,
  query,
  entityFilter,
  sortMode,
  canLoadMore,
  rowLimit,
  onQuery,
  onEntityFilter,
  onSort,
  onSelectFactor,
  onSelectEntity,
  onLoadMore,
}: {
  factors: VectorFactorModel[]
  visibleEntities: VectorEntityModel[]
  totalEntities: number
  selectedFactorKey: VectorDimensionKey
  selectedEntityId: string | null
  query: string
  entityFilter: EntityFilter
  sortMode: SortMode
  canLoadMore: boolean
  rowLimit: number
  onQuery: (value: string) => void
  onEntityFilter: (value: EntityFilter) => void
  onSort: (value: SortMode) => void
  onSelectFactor: (key: VectorDimensionKey) => void
  onSelectEntity: (id: string) => void
  onLoadMore: () => void
}) {
  return (
    <section className={styles.matrixPanel} aria-label="Vector matrix">
      <div className={styles.sectionHeader}>
        <div>
          <p>VECTOR MATRIX</p>
          <h1>엔티티 × 22D 팩터</h1>
        </div>
        <span>{visibleEntities.length}/{totalEntities} rows · limit {rowLimit}</span>
      </div>
      <VectorMatrixToolbar
        query={query}
        entityFilter={entityFilter}
        sortMode={sortMode}
        onQuery={onQuery}
        onEntityFilter={onEntityFilter}
        onSort={onSort}
      />
      <div className={styles.matrixScroll}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th className={styles.entityCol}>Entity</th>
              {factors.map((factor) => (
                <th key={factor.key} data-selected={selectedFactorKey === factor.key}>
                  <button type="button" onClick={() => onSelectFactor(factor.key)} title={`${factor.label} · ${factor.key}`}>
                    <span>{factor.label}</span>
                    <small>{factor.group}</small>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleEntities.map((entity) => (
              <VectorMatrixRow
                key={entity.id}
                entity={entity}
                factors={factors}
                selectedFactorKey={selectedFactorKey}
                selected={selectedEntityId === entity.id}
                onSelect={onSelectEntity}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.matrixFooter}>
        <span>Null은 대시로 표시하며 0과 구분합니다. 색상은 값 강도 보조표현입니다.</span>
        {canLoadMore && <button type="button" onClick={onLoadMore}>Load more rows</button>}
      </div>
    </section>
  )
}

