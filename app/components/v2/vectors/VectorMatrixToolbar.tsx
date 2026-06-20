'use client'

import type { EntityFilter, SortMode } from './useVectorWorkbench'
import styles from './vectorWorkbench.module.css'

export function VectorMatrixToolbar({
  query,
  entityFilter,
  sortMode,
  onQuery,
  onEntityFilter,
  onSort,
}: {
  query: string
  entityFilter: EntityFilter
  sortMode: SortMode
  onQuery: (value: string) => void
  onEntityFilter: (value: EntityFilter) => void
  onSort: (value: SortMode) => void
}) {
  return (
    <div className={styles.matrixToolbar}>
      <label>
        <span>엔티티 검색</span>
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="driver, callcard, ASP" />
      </label>
      <label>
        <span>유형</span>
        <select value={entityFilter} onChange={(event) => onEntityFilter(event.target.value as EntityFilter)}>
          <option value="all">전체</option>
          <option value="callcard">콜카드</option>
          <option value="driver">기사</option>
        </select>
      </label>
      <label>
        <span>정렬</span>
        <select value={sortMode} onChange={(event) => onSort(event.target.value as SortMode)}>
          <option value="selected_factor_desc">선택 팩터 높은 순</option>
          <option value="selected_factor_asc">선택 팩터 낮은 순</option>
          <option value="type">유형</option>
          <option value="label">ID</option>
        </select>
      </label>
    </div>
  )
}
