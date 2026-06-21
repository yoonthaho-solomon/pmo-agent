import type { MatrixCell } from '@/lib/adapters/ingestion'
import { Panel } from '../primitives/Panel'
import { numberLabel } from './formatters'
import { statusLabel } from './statusMeta'
import styles from './dataOps.module.css'

export function DataInspector({ cell }: { cell: MatrixCell | null }) {
  return (
    <Panel className={styles.inspector}>
      <div className={styles.sectionKicker}>INSPECTOR</div>
      <h2>{cell ? cell.date : '날짜 셀을 선택하세요'}</h2>
      {cell ? (
        <div className={styles.inspectorBody}>
          <dl>
            <div><dt>데이터</dt><dd>{cell.table}</dd></div>
            <div><dt>상태</dt><dd>{statusLabel(cell.status)}</dd></div>
            <div><dt>건수</dt><dd>{numberLabel(cell.count)}</dd></div>
            <div><dt>판정 근거</dt><dd>{cell.reason}</dd></div>
          </dl>
        </div>
      ) : (
        <p className={styles.emptyText}>날짜 셀을 누르면 해당 테이블의 적재 건수와 상태 판정 근거를 확인할 수 있습니다.</p>
      )}
    </Panel>
  )
}
