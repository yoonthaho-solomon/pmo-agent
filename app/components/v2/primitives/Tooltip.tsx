import type { ReactNode } from 'react'
import styles from '../styles/primitives.module.css'

export function Tooltip({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <span className={styles.tooltipWrap}>
      {children}
      <span className={styles.tooltip} role="tooltip">{label}</span>
    </span>
  )
}
