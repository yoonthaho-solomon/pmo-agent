'use client'

import type { VectorFactorModel } from '@/lib/adapters/vectors'
import type { VectorDimensionKey } from '@/lib/matching-vector'
import { FACTOR_GROUPS } from './vectorMeta'
import { FactorGroup } from './FactorGroup'
import styles from './vectorWorkbench.module.css'

export function FactorLibrary({
  factors,
  selectedKey,
  query,
  group,
  onQuery,
  onGroup,
  onSelect,
}: {
  factors: VectorFactorModel[]
  selectedKey: VectorDimensionKey
  query: string
  group: string
  onQuery: (value: string) => void
  onGroup: (value: string) => void
  onSelect: (key: VectorDimensionKey) => void
}) {
  const grouped = new Map<string, VectorFactorModel[]>()
  for (const factor of factors) grouped.set(factor.group, [...(grouped.get(factor.group) ?? []), factor])

  return (
    <aside className={styles.library} aria-label="Factor library">
      <div className={styles.panelTitle}>팩터 라이브러리</div>
      <label className={styles.searchLabel}>
        <span>팩터 검색</span>
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="score, 시간, 요금" />
      </label>
      <label className={styles.searchLabel}>
        <span>그룹 필터</span>
        <select value={group} onChange={(event) => onGroup(event.target.value)}>
          {FACTOR_GROUPS.map((item) => <option key={item} value={item}>{item === 'all' ? '전체 팩터' : item}</option>)}
        </select>
      </label>
      <div className={styles.factorList}>
        {Array.from(grouped.entries()).map(([name, groupFactors]) => (
          <FactorGroup key={name} title={name} factors={groupFactors} selectedKey={selectedKey} onSelect={onSelect} />
        ))}
        {factors.length === 0 && <p className={styles.empty}>조건에 맞는 팩터가 없습니다.</p>}
      </div>
    </aside>
  )
}
