import type { MatrixCell } from '@/lib/adapters/ingestion'
import { Panel } from '../primitives/Panel'
import { numberLabel } from './formatters'
import { statusLabel } from './statusMeta'
import styles from './dataOps.module.css'

export function DataInspector({ cell }: { cell: MatrixCell | null }) {
  return (
    <Panel className={styles.inspector}>
      <div className={styles.sectionKicker}>Inspector</div>
      <h2>{cell ? cell.date : 'Select a cell'}</h2>
      {cell ? (
        <div className={styles.inspectorBody}>
          <dl>
            <div><dt>Dataset</dt><dd>{cell.table}</dd></div>
            <div><dt>Status</dt><dd>{statusLabel(cell.status)}</dd></div>
            <div><dt>Rows</dt><dd>{numberLabel(cell.count)}</dd></div>
            <div><dt>Reason</dt><dd>{cell.reason}</dd></div>
          </dl>
        </div>
      ) : (
        <p className={styles.emptyText}>Click a date cell to inspect the source table, count, and status reason.</p>
      )}
    </Panel>
  )
}
