import type { ReactNode } from 'react'
import styles from '../styles/primitives.module.css'

export function Panel({
  children,
  floating = false,
  className = '',
}: {
  children: ReactNode
  floating?: boolean
  className?: string
}) {
  return <section className={`${floating ? styles.floatingPanel : styles.panel} ${className}`}>{children}</section>
}
