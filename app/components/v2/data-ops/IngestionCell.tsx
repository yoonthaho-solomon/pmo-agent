'use client'

import type { CSSProperties } from 'react'
import type { MatrixCell } from '@/lib/adapters/ingestion'
import { numberLabel } from './formatters'
import { IngestionTooltip } from './IngestionTooltip'
import { STATUS_META, statusLabel } from './statusMeta'
import styles from './dataOps.module.css'

export function IngestionCell({
  cell,
  selected,
  related,
  onSelect,
}: {
  cell: MatrixCell
  selected: boolean
  related: boolean
  onSelect: (cellId: string) => void
}) {
  const meta = STATUS_META[cell.status]
  return (
    <button
      className={styles.cell}
      data-selected={selected}
      data-related={related}
      data-status={cell.status}
      onClick={() => onSelect(cell.id)}
      type="button"
      style={{ '--cell-color': meta.color } as CSSProperties}
      aria-label={`${cell.date} ${cell.table} ${statusLabel(cell.status)} ${numberLabel(cell.count)}건`}
    >
      <span>{numberLabel(cell.count)}</span>
      <small>{statusLabel(cell.status)}</small>
      <IngestionTooltip cell={cell} />
    </button>
  )
}
