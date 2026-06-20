'use client'

import type { CSSProperties } from 'react'
import type { DataSourceId, SourceCard } from '@/lib/adapters/ingestion'
import { Panel } from '../primitives/Panel'
import { STATUS_META } from './statusMeta'
import styles from './dataOps.module.css'

export function SourceRail({
  sources,
  selectedSourceId,
  onSelect,
}: {
  sources: SourceCard[]
  selectedSourceId: DataSourceId
  onSelect: (sourceId: DataSourceId) => void
}) {
  return (
    <Panel className={styles.sourceRail}>
      <div className={styles.sectionKicker}>Data sources</div>
      <h2 className={styles.railTitle}>Readiness filter</h2>
      <div className={styles.sourceList}>
        {sources.map((source) => (
          <button
            key={source.id}
            className={styles.sourceButton}
            data-selected={selectedSourceId === source.id}
            onClick={() => onSelect(source.id)}
            type="button"
          >
            <span className={styles.sourceTop}>
              <span>{source.title}</span>
              <span className={styles.statusDot} style={{ '--status-color': STATUS_META[source.status].color } as CSSProperties} />
            </span>
            <strong>{source.countLabel}</strong>
            <span>{source.dateRange}</span>
            <small>{source.description}</small>
          </button>
        ))}
      </div>
    </Panel>
  )
}
