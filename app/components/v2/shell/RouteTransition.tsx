import type { ReactNode } from 'react'
import styles from '../styles/primitives.module.css'

export function RouteTransition({ children }: { children: ReactNode }) {
  return <div className={styles.routeTransition}>{children}</div>
}
