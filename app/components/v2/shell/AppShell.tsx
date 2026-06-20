import type { ReactNode } from 'react'
import tokenStyles from '../styles/tokens.module.css'
import styles from '../styles/primitives.module.css'
import { GlobalHeader } from './GlobalHeader'
import { RouteTransition } from './RouteTransition'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={`${tokenStyles.root} ${styles.app}`}>
      <GlobalHeader />
      <main className={styles.body}>
        <RouteTransition>{children}</RouteTransition>
      </main>
    </div>
  )
}
