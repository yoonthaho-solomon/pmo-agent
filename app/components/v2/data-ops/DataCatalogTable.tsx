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

function categoryLabel(value: string) {
  if (value === 'call') return '호출'
  if (value === 'driver') return '기사'
  if (value === 'matching') return '매칭'
  if (value === 'meter') return '앱미터'
  return value
}

function statusText(value: string, availability: number | null) {
  if (value === 'available') return availability == null ? '사용 가능' : `${availability}%`
  if (value === 'partial') return '부분 가능'
  return '미지원'
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
          <div className={styles.sectionKicker}>DATA CATALOG</div>
          <h2>적재 데이터로 만들 수 있는 매칭 팩터</h2>
        </div>
      </div>
      <DataCatalogToolbar items={sourceFiltered} filters={filters} onChange={setFilters} />
      <div className={styles.catalogTableWrap}>
        <table className={styles.catalogTable}>
          <thead>
            <tr>
              <th>구분</th>
              <th>활용 항목</th>
              <th>필드</th>
              <th>테이블</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id}>
                <td>{categoryLabel(item.group)}</td>
                <td>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </td>
                <td>{item.fields.join(', ')}</td>
                <td>{item.tables.join(', ')}</td>
                <td><b data-status={item.status}>{statusText(item.status, item.availability)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleItems.length === 0 && <div className={styles.emptyText}>조건에 맞는 데이터 항목이 없습니다.</div>}
      </div>
    </Panel>
  )
}
