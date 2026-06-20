'use client'

import { useMemo, useState } from 'react'
import type { DataSourceId, MatrixCell } from '@/lib/adapters/ingestion'
import { AppShell } from '../shell/AppShell'
import { QueryStateBoundary } from '../shell/QueryStateBoundary'
import { DataCatalogTable } from './DataCatalogTable'
import { DataInspector } from './DataInspector'
import { DataOpsSummaryBar } from './DataOpsSummaryBar'
import { IngestionMatrix } from './IngestionMatrix'
import { SourceRail } from './SourceRail'
import { useDataOpsStatus } from './useDataOpsStatus'
import styles from './dataOps.module.css'

export function DataOpsWorkspace() {
  const { model, queryStatus, errorMessage, retry } = useDataOpsStatus()
  const [selectedSourceId, setSelectedSourceId] = useState<DataSourceId>('all')
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null)

  const visibleRows = useMemo(() => {
    if (!model) return []
    return selectedSourceId === 'all'
      ? model.rows
      : model.rows.filter((row) => row.sourceId === selectedSourceId)
  }, [model, selectedSourceId])

  const visibleCells = useMemo(() => {
    if (!model) return []
    return selectedSourceId === 'all'
      ? model.cells
      : model.cells.filter((cell) => cell.sourceId === selectedSourceId)
  }, [model, selectedSourceId])

  const selectedCell = useMemo<MatrixCell | null>(() => {
    if (!model || !selectedCellId) return null
    return model.cells.find((cell) => cell.id === selectedCellId) ?? null
  }, [model, selectedCellId])

  return (
    <AppShell>
      <QueryStateBoundary status={queryStatus} message={errorMessage}>
        {model && (
          <div className={styles.layout}>
            <SourceRail
              sources={model.sources}
              selectedSourceId={selectedSourceId}
              onSelect={(sourceId) => {
                setSelectedSourceId(sourceId)
                setSelectedCellId(null)
              }}
            />
            <DataOpsSummaryBar model={model} onRefresh={retry} />
            <IngestionMatrix
              dates={model.dates}
              rows={visibleRows}
              cells={visibleCells}
              selectedCell={selectedCell}
              onSelect={setSelectedCellId}
            />
            <DataInspector cell={selectedCell} />
            <DataCatalogTable items={model.catalog} rows={model.rows} selectedSourceId={selectedSourceId} />
          </div>
        )}
      </QueryStateBoundary>
    </AppShell>
  )
}
