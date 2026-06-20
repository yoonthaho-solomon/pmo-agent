import type { IngestionViewModel } from '@/lib/adapters/ingestion'
import { Button } from '../primitives/Button'
import { Panel } from '../primitives/Panel'
import { numberLabel } from './formatters'
import styles from './dataOps.module.css'

export function DataOpsSummaryBar({ model, onRefresh }: { model: IngestionViewModel; onRefresh: () => void }) {
  return (
    <Panel className={styles.summary}>
      <div>
        <span>Loaded period</span>
        <strong>{model.period}</strong>
      </div>
      <div>
        <span>Data present days</span>
        <strong>{numberLabel(model.kpis.presentDays)}</strong>
      </div>
      <div>
        <span>Missing days</span>
        <strong>{numberLabel(model.kpis.missingDays)}</strong>
      </div>
      <div>
        <span>Core tables present</span>
        <strong>{model.kpis.coreTablesPresent}/{model.kpis.coreTablesTotal}</strong>
      </div>
      <Button onClick={onRefresh}>Refresh</Button>
    </Panel>
  )
}
