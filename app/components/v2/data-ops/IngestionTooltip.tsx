import type { MatrixCell } from '@/lib/adapters/ingestion'
import { numberLabel } from './formatters'
import { statusLabel } from './statusMeta'
import styles from './dataOps.module.css'

export function IngestionTooltip({ cell }: { cell: MatrixCell }) {
  return (
    <span className={styles.tooltip} role="tooltip">
      <strong>{cell.date}</strong>
      <span>{cell.table}</span>
      <span>{statusLabel(cell.status)} · {numberLabel(cell.count)} rows</span>
      <small>{cell.reason}</small>
    </span>
  )
}
