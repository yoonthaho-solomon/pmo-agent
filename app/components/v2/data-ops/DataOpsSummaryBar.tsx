import type { IngestionViewModel } from '@/lib/adapters/ingestion'
import { Button } from '../primitives/Button'
import { Panel } from '../primitives/Panel'
import { numberLabel } from './formatters'
import styles from './dataOps.module.css'

export function DataOpsSummaryBar({ model, onRefresh }: { model: IngestionViewModel; onRefresh: () => void }) {
  return (
    <Panel className={styles.summary}>
      <div>
        <span>적재 기간</span>
        <strong>{model.period}</strong>
      </div>
      <div>
        <span>데이터 확인일</span>
        <strong>{numberLabel(model.kpis.presentDays)}</strong>
      </div>
      <div>
        <span>누락일</span>
        <strong>{numberLabel(model.kpis.missingDays)}</strong>
      </div>
      <div>
        <span>핵심 테이블</span>
        <strong>{model.kpis.coreTablesPresent}/{model.kpis.coreTablesTotal}</strong>
      </div>
      <Button onClick={onRefresh}>새로고침</Button>
    </Panel>
  )
}
