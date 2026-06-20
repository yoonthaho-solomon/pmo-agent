'use client'

import type { CSSProperties } from 'react'
import type { VectorFactorModel } from '@/lib/adapters/vectors'
import { numberValue } from './formatters'
import styles from './vectorWorkbench.module.css'

export function VectorCell({
  value,
  factor,
  selected,
}: {
  value: number | null | undefined
  factor: VectorFactorModel
  selected: boolean
}) {
  const intensity = value == null ? 0 : Math.max(0, Math.min(1, value))
  const label = value == null ? '값 없음' : numberValue(value, 3)
  return (
    <td
      className={styles.vectorCell}
      data-selected={selected}
      data-empty={value == null}
      data-tooltip={`${factor.label} · ${factor.key} · ${label}`}
      style={{ '--value': intensity } as CSSProperties}
      tabIndex={0}
      aria-label={`${factor.label} ${label}`}
    >
      <span>{numberValue(value, 2)}</span>
      <small>{value == null ? 'missing' : factor.group}</small>
    </td>
  )
}
