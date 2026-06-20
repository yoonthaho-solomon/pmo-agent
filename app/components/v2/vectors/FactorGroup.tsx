'use client'

import type { VectorFactorModel } from '@/lib/adapters/vectors'
import type { VectorDimensionKey } from '@/lib/matching-vector'
import styles from './vectorWorkbench.module.css'

export function FactorGroup({
  title,
  factors,
  selectedKey,
  onSelect,
}: {
  title: string
  factors: VectorFactorModel[]
  selectedKey: VectorDimensionKey
  onSelect: (key: VectorDimensionKey) => void
}) {
  if (!factors.length) return null
  return (
    <section className={styles.factorGroup} aria-label={`${title} factor group`}>
      <div className={styles.factorGroupTitle}>{title}<span>{factors.length}</span></div>
      <div className={styles.factorListInner}>
        {factors.map((factor) => (
          <button
            key={factor.key}
            type="button"
            className={styles.factorItem}
            data-selected={selectedKey === factor.key}
            onClick={() => onSelect(factor.key)}
          >
            <span>{factor.label}</span>
            <small>{factor.key}</small>
            <b>{factor.validCount}</b>
          </button>
        ))}
      </div>
    </section>
  )
}
