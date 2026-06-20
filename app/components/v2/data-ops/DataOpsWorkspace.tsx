'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { adaptIngestionSummary, type DataSourceId, type IngestionStatus, type MatrixCell, type SystemStatusResponse } from '@/lib/adapters/ingestion'
import { AppShell } from '../shell/AppShell'
import { QueryStateBoundary, type V2QueryStatus } from '../shell/QueryStateBoundary'
import { Button } from '../primitives/Button'
import { Panel } from '../primitives/Panel'
import styles from './dataOps.module.css'

const STATUS_META: Record<IngestionStatus, { label: string; color: string }> = {
  healthy: { label: 'Ready', color: 'var(--km-v2-green)' },
  partial: { label: 'Partial', color: 'var(--km-v2-amber)' },
  missing: { label: 'Missing', color: 'var(--km-v2-red)' },
  pending: { label: 'Checking', color: 'rgba(145, 183, 207, 0.72)' },
}

function numberLabel(value: number | null | undefined) {
  return value == null ? '-' : value.toLocaleString('ko-KR')
}

function statusLabel(status: IngestionStatus) {
  return STATUS_META[status].label
}

export function DataOpsWorkspace() {
  const [rawStatus, setRawStatus] = useState<SystemStatusResponse | null>(null)
  const [queryStatus, setQueryStatus] = useState<V2QueryStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [selectedSourceId, setSelectedSourceId] = useState<DataSourceId>('all')
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      setQueryStatus('loading')
      setErrorMessage(undefined)
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch('/api/system-status', { cache: 'no-store', signal: controller.signal })
        const json = await response.json() as SystemStatusResponse
        if (cancelled) return

        setRawStatus(json)
        if (!response.ok || json.error) {
          setQueryStatus('error')
          setErrorMessage(json.error ?? `Status API failed with ${response.status}`)
        } else if (!json.callTables?.length && !json.meterTables?.length && !json.vectorTables?.length) {
          setQueryStatus('empty')
        } else if (json.ok === false) {
          setQueryStatus('partial')
          setErrorMessage(json.message)
        } else {
          setQueryStatus('success')
        }
      } catch (error) {
        if (cancelled) return
        setRawStatus(null)
        setQueryStatus('error')
        setErrorMessage(error instanceof Error && error.name === 'AbortError'
          ? 'Status API timed out.'
          : 'Could not load ingestion status.')
      } finally {
        window.clearTimeout(timer)
      }
    }

    loadStatus()
    return () => {
      cancelled = true
    }
  }, [retryKey])

  const model = useMemo(() => rawStatus ? adaptIngestionSummary(rawStatus) : null, [rawStatus])
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
  const visibleCatalog = useMemo(() => {
    if (!model) return []
    if (selectedSourceId === 'all') return model.catalog
    return model.catalog.filter((item) => item.tables.some((table) => {
      const source = model.rows.find((row) => row.table === table)?.sourceId
      return source === selectedSourceId
    }))
  }, [model, selectedSourceId])

  return (
    <AppShell>
      <QueryStateBoundary status={queryStatus} message={errorMessage}>
        {model && (
          <div className={styles.layout}>
            <Panel className={styles.sourceRail}>
              <div className={styles.sectionKicker}>Data sources</div>
              <h2 className={styles.railTitle}>Readiness filter</h2>
              <div className={styles.sourceList}>
                {model.sources.map((source) => (
                  <button
                    key={source.id}
                    className={styles.sourceButton}
                    data-selected={selectedSourceId === source.id}
                    onClick={() => {
                      setSelectedSourceId(source.id)
                      setSelectedCellId(null)
                    }}
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

            <Panel className={styles.summary}>
              <div>
                <span>Loaded period</span>
                <strong>{model.period}</strong>
              </div>
              <div>
                <span>Ready days</span>
                <strong>{numberLabel(model.kpis.loadedDays)}</strong>
              </div>
              <div>
                <span>Missing days</span>
                <strong>{numberLabel(model.kpis.missingDays)}</strong>
              </div>
              <div>
                <span>Core tables</span>
                <strong>{model.kpis.coreTablesReady}/{model.kpis.coreTablesTotal}</strong>
              </div>
              <Button onClick={() => setRetryKey((key) => key + 1)}>Refresh</Button>
            </Panel>

            <Panel className={styles.matrixPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.sectionKicker}>Ingestion matrix</div>
                  <h1>Daily data connection map</h1>
                  <p>Read-only view of which dates have call cards, driver logs, match results, and meter baseline tables.</p>
                </div>
                <div className={styles.legend}>
                  {Object.entries(STATUS_META).map(([key, meta]) => (
                    <span key={key}><i style={{ background: meta.color }} />{meta.label}</span>
                  ))}
                </div>
              </div>

              <div className={styles.matrix} style={{ '--date-count': model.dates.length || 1 } as CSSProperties}>
                <div className={styles.corner}>Dataset</div>
                {model.dates.map((date) => <div key={date} className={styles.dateHead}>{date.slice(5)}</div>)}
                {visibleRows.map((row) => (
                  <div className={styles.rowGroup} key={row.id}>
                    <div className={styles.rowHead}>
                      <strong>{row.title}</strong>
                      <span>{row.table}</span>
                    </div>
                    {model.dates.map((date) => {
                      const cell = visibleCells.find((item) => item.rowId === row.id && item.date === date)
                      const meta = cell ? STATUS_META[cell.status] : STATUS_META.pending
                      return (
                        <button
                          key={`${row.id}-${date}`}
                          className={styles.cell}
                          data-selected={selectedCellId === cell?.id}
                          onClick={() => cell && setSelectedCellId(cell.id)}
                          type="button"
                          style={{ '--cell-color': meta.color } as CSSProperties}
                        >
                          <span>{cell ? numberLabel(cell.count) : '-'}</span>
                          <small>{cell ? statusLabel(cell.status) : 'Checking'}</small>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className={styles.inspector}>
              <div className={styles.sectionKicker}>Inspector</div>
              <h2>{selectedCell ? selectedCell.date : 'Select a cell'}</h2>
              {selectedCell ? (
                <div className={styles.inspectorBody}>
                  <dl>
                    <div><dt>Dataset</dt><dd>{selectedCell.table}</dd></div>
                    <div><dt>Status</dt><dd>{statusLabel(selectedCell.status)}</dd></div>
                    <div><dt>Rows</dt><dd>{numberLabel(selectedCell.count)}</dd></div>
                    <div><dt>Reason</dt><dd>{selectedCell.reason}</dd></div>
                  </dl>
                </div>
              ) : (
                <p className={styles.emptyText}>Click a date cell to inspect the source table, count, and status reason.</p>
              )}
            </Panel>

            <Panel className={styles.catalog}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.sectionKicker}>Data catalog</div>
                  <h2>What this project can extract from loaded data</h2>
                </div>
              </div>
              <div className={styles.catalogGrid}>
                {visibleCatalog.map((item) => (
                  <article key={item.id} className={styles.catalogCard} data-status={item.status}>
                    <div>
                      <span>{item.group}</span>
                      <strong>{item.title}</strong>
                    </div>
                    <p>{item.description}</p>
                    <small>{item.fields.join(' · ')}</small>
                    <b>{item.availability == null ? '-' : `${item.availability}%`}</b>
                  </article>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </QueryStateBoundary>
    </AppShell>
  )
}
