import styles from '../styles/primitives.module.css'
import { WorkspaceTabs } from './WorkspaceTabs'

export function GlobalHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>
            <div className={styles.brandMark} aria-hidden />
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>KONAMOBILITY</span>
              <span className={styles.brandV2}>V2</span>
            </div>
          </div>
          <WorkspaceTabs />
        </div>

        <div className={styles.headerRight}>
          <div className={styles.statusCluster} role="status" aria-label="Supabase 연결 상태">
            <span className={styles.statusDot} aria-hidden />
            연결됨
          </div>
          <div className={styles.previewBadge}>V2 Preview</div>
        </div>
      </div>
    </header>
  )
}
