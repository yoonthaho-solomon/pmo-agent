import type { CSSProperties } from 'react'
import type { MatrixCell, MatrixRow } from '@/lib/adapters/ingestion'
import { Panel } from '../primitives/Panel'
import { IngestionCell } from './IngestionCell'
import { STATUS_META } from './statusMeta'
import styles from './dataOps.module.css'

export function IngestionMatrix({
  dates,
  rows,
  cells,
  selectedCell,
  onSelect,
}: {
  dates: string[]
  rows: MatrixRow[]
  cells: MatrixCell[]
  selectedCell: MatrixCell | null
  onSelect: (cellId: string) => void
}) {
  return (
    <Panel className={styles.matrixPanel}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.sectionKicker}>Ingestion matrix</div>
          <h1>Data connection map</h1>
          <p>Read-only view of which dates have call cards, driver logs, match results, and meter baseline tables.</p>
        </div>
        <div className={styles.legend}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span key={key} data-disabled={key === 'delayed'}><i style={{ background: meta.color }} />{meta.label}</span>
          ))}
        </div>
      </div>

      <div className={styles.matrix} style={{ '--date-count': dates.length || 1 } as CSSProperties}>
        <div className={styles.corner}>Dataset</div>
        {dates.map((date) => (
          <div key={date} className={styles.dateHead} data-related={selectedCell?.date === date}>{date.slice(5)}</div>
        ))}
        {rows.map((row) => (
          <div className={styles.rowGroup} key={row.id}>
            <div className={styles.rowHead} data-related={selectedCell?.rowId === row.id}>
              <strong>{row.title}</strong>
              <span>{row.table}</span>
            </div>
            {dates.map((date) => {
              const cell = cells.find((item) => item.rowId === row.id && item.date === date)
              if (!cell) {
                return <div key={`${row.id}-${date}`} className={styles.cellPlaceholder}>-</div>
              }
              return (
                <IngestionCell
                  key={cell.id}
                  cell={cell}
                  selected={selectedCell?.id === cell.id}
                  related={selectedCell?.rowId === cell.rowId || selectedCell?.date === cell.date}
                  onSelect={onSelect}
                />
              )
            })}
          </div>
        ))}
      </div>
    </Panel>
  )
}
