'use client'

import type { CSSProperties } from 'react'
import type { VectorFactorModel } from '@/lib/adapters/vectors'
import { numberValue } from './formatters'
import styles from './vectorWorkbench.module.css'

export function VectorCell({
  value,
  factor,
  selected,
  entityLabel,
  onSelect,
}: {
  value: number | null | undefined
  factor: VectorFactorModel
  selected: boolean
  entityLabel: string
  onSelect: () => void
}) {
  const intensity = value == null ? 0 : Math.max(0, Math.min(1, value))
  const label = value == null ? '값 없음' : numberValue(value, 3)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect()
  }
  return (
    <td
      className={styles.vectorCell}
      role="gridcell"
      data-selected={selected}
      data-empty={value == null}
      data-tooltip={`${factor.label} · ${factor.key} · ${label}`}
      style={{ '--value': intensity } as CSSProperties}
      tabIndex={0}
      aria-label={`${entityLabel} ${factor.label} ${label}`}
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <span>{numberValue(value, 2)}</span>
      <small>{value == null ? 'missing' : factor.group}</small>
    </td>
  )
}
