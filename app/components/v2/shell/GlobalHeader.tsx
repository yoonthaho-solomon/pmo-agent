import styles from '../styles/primitives.module.css'
import { Badge } from '../primitives/Badge'
import { WorkspaceTabs } from './WorkspaceTabs'

export function GlobalHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brand} aria-label="KONAMOBILITY">
          <span className={styles.brandMark}>K</span>
          <span className={styles.brandText}>
            <span className={styles.brandTitle}>KONAMOBILITY</span>
            <span className={styles.brandSubtitle}>AI Dispatch Workspace</span>
          </span>
        </div>
        <WorkspaceTabs />
        <div className={styles.headerRight}>
          <span className={styles.statusDot} aria-hidden />
          <span>연결됨</span>
          <Badge tone="cyan">V2 Preview</Badge>
        </div>
      </div>
    </header>
  )
}
