'use client'

import { useMemo, useState } from 'react'
import type { CatalogItem, DataSourceId, MatrixRow } from '@/lib/adapters/ingestion'
import { Panel } from '../primitives/Panel'
import { DataCatalogToolbar, type CatalogFilters } from './DataCatalogToolbar'
import styles from './dataOps.module.css'

const INITIAL_FILTERS: CatalogFilters = {
  search: '',
  category: 'all',
  status: 'all',
  availableOnly: false,
}

export function DataCatalogTable({
  items,
  rows,
  selectedSourceId,
}: {
  items: CatalogItem[]
  rows: MatrixRow[]
  selectedSourceId: DataSourceId
}) {
  const [filters, setFilters] = useState<CatalogFilters>(INITIAL_FILTERS)

  const sourceFiltered = useMemo(() => {
    if (selectedSourceId === 'all') return items
    return items.filter((item) => item.tables.some((table) => rows.find((row) => row.table === table)?.sourceId === selectedSourceId))
  }, [items, rows, selectedSourceId])

  const visibleItems = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return sourceFiltered.filter((item) => {
      if (filters.category !== 'all' && item.group !== filters.category) return false
      if (filters.status !== 'all' && item.status !== filters.status) return false
      if (filters.availableOnly && item.status !== 'available') return false
      if (!query) return true
      return [
        item.title,
        item.group,
        item.description,
        ...item.fields,
        ...item.tables,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [filters, sourceFiltered])

  return (
    <Panel className={styles.catalog}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.sectionKicker}>Data catalog</div>
          <h2>What this project can extract from loaded data</h2>
        </div>
      </div>
      <DataCatalogToolbar items={sourceFiltered} filters={filters} onChange={setFilters} />
      <div className={styles.catalogTableWrap}>
        <table className={styles.catalogTable}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Data product</th>
              <th>Fields</th>
              <th>Tables</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id}>
                <td>{item.group}</td>
                <td>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </td>
                <td>{item.fields.join(', ')}</td>
                <td>{item.tables.join(', ')}</td>
                <td><b data-status={item.status}>{item.availability == null ? '-' : `${item.availability}%`}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleItems.length === 0 && <div className={styles.emptyText}>No catalog items match this filter.</div>}
      </div>
    </Panel>
  )
}
