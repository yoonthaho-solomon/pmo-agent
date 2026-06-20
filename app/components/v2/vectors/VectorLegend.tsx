'use client'

import styles from './vectorWorkbench.module.css'

export function VectorLegend() {
  return (
    <div className={styles.legend} aria-label="Vector value legend">
      <span><i data-level="low" />0.00</span>
      <span><i data-level="mid" />0.50</span>
      <span><i data-level="high" />1.00</span>
      <span><i data-level="none" />값 없음</span>
    </div>
  )
}
