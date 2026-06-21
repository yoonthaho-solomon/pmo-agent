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
          <div className={styles.sectionKicker}>INGESTION MATRIX</div>
          <h1>날짜별 적재 연결 상태</h1>
          <p>호출데이터, 기사 로그, 매칭 결과, 앱미터 기준 데이터가 어떤 날짜까지 연결됐는지 읽기 전용으로 확인합니다.</p>
        </div>
        <div className={styles.legend}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span key={key} data-disabled={key === 'delayed'}><i style={{ background: meta.color }} />{meta.label}</span>
          ))}
        </div>
      </div>

      <div className={styles.matrix} style={{ '--date-count': dates.length || 1 } as CSSProperties}>
        <div className={styles.corner}>데이터</div>
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
