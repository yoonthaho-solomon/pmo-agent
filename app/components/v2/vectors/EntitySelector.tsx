'use client'

import type { VectorEntityModel } from '@/lib/adapters/vectors'
import { entityTypeLabel } from './formatters'
import styles from './vectorWorkbench.module.css'

export function EntitySelector({
  id,
  label,
  value,
  entities,
  disabledEntityId,
  onChange,
}: {
  id: string
  label: string
  value: string | null
  entities: VectorEntityModel[]
  disabledEntityId?: string | null
  onChange: (value: string) => void
}) {
  return (
    <label className={styles.entitySelector} htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>선택</option>
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id} disabled={entity.id === disabledEntityId}>
            {entity.label} · {entityTypeLabel(entity.type)}
          </option>
        ))}
      </select>
    </label>
  )
}
