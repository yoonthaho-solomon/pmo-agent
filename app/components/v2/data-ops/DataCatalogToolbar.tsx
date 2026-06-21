'use client'

import type { CatalogItem } from '@/lib/adapters/ingestion'
import styles from './dataOps.module.css'

export type CatalogFilters = {
  search: string
  category: string
  status: string
  availableOnly: boolean
}

function labelFor(value: string) {
  if (value === 'all') return '전체'
  if (value === 'call') return '호출'
  if (value === 'driver') return '기사'
  if (value === 'matching') return '매칭'
  if (value === 'meter') return '앱미터'
  if (value === 'available') return '사용 가능'
  if (value === 'partial') return '부분 가능'
  if (value === 'unavailable') return '미지원'
  return value
}

export function DataCatalogToolbar({
  items,
  filters,
  onChange,
}: {
  items: CatalogItem[]
  filters: CatalogFilters
  onChange: (filters: CatalogFilters) => void
}) {
  const categories = ['all', ...Array.from(new Set(items.map((item) => item.group)))]
  const statuses = ['all', 'available', 'partial', 'unavailable']

  return (
    <div className={styles.catalogToolbar}>
      <input
        aria-label="데이터 항목 검색"
        placeholder="필드, 테이블, 활용 항목 검색"
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
      />
      <select
        aria-label="데이터 구분"
        value={filters.category}
        onChange={(event) => onChange({ ...filters, category: event.target.value })}
      >
        {categories.map((category) => <option key={category} value={category}>{labelFor(category)}</option>)}
      </select>
      <select
        aria-label="활용 상태"
        value={filters.status}
        onChange={(event) => onChange({ ...filters, status: event.target.value })}
      >
        {statuses.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}
      </select>
      <label>
        <input
          type="checkbox"
          checked={filters.availableOnly}
          onChange={(event) => onChange({ ...filters, availableOnly: event.target.checked })}
        />
        사용 가능만
      </label>
    </div>
  )
}
