import type { ReactNode } from 'react'
import styles from '../styles/primitives.module.css'

const toneColor = {
  neutral: 'var(--km-v2-text-secondary)',
  cyan: 'var(--km-v2-cyan)',
  green: 'var(--km-v2-green)',
  amber: 'var(--km-v2-amber)',
  red: 'var(--km-v2-red)',
  violet: 'var(--km-v2-violet)',
} as const

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: keyof typeof toneColor
}) {
  return (
    <span className={styles.badge} style={{ color: toneColor[tone] }}>
      {children}
    </span>
  )
}
