'use client'

import type { VectorEntityModel } from '@/lib/adapters/vectors'
import { entityTypeLabel } from './formatters'
import styles from './vectorWorkbench.module.css'

export function EntitySelector({
  id,
  label,
  value,
  entities,
  onChange,
}: {
  id: string
  label: string
  value: string | null
  entities: VectorEntityModel[]
  onChange: (value: string) => void
}) {
  return (
    <label className={styles.entitySelector} htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>선택</option>
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id}>{entity.label} · {entityTypeLabel(entity.type)}</option>
        ))}
      </select>
    </label>
  )
}
