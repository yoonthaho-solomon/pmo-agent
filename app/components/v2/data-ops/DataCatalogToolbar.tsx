'use client'

import type { CatalogItem } from '@/lib/adapters/ingestion'
import styles from './dataOps.module.css'

export type CatalogFilters = {
  search: string
  category: string
  status: string
  availableOnly: boolean
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
        aria-label="Catalog search"
        placeholder="Search fields, tables, products"
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
      />
      <select
        aria-label="Catalog category"
        value={filters.category}
        onChange={(event) => onChange({ ...filters, category: event.target.value })}
      >
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
      <select
        aria-label="Catalog status"
        value={filters.status}
        onChange={(event) => onChange({ ...filters, status: event.target.value })}
      >
        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <label>
        <input
          type="checkbox"
          checked={filters.availableOnly}
          onChange={(event) => onChange({ ...filters, availableOnly: event.target.checked })}
        />
        Available only
      </label>
    </div>
  )
}
