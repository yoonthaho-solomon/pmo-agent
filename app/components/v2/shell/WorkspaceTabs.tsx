'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from '../styles/primitives.module.css'

export const v2Workspaces = [
  { id: 'data-ops', label: '데이터 운영', href: '/data-ops' },
  { id: 'vector-workbench', label: '벡터 워크벤치', href: '/vector-workbench' },
  { id: 'matching-studio', label: '매칭 스튜디오', href: '/matching-studio' },
  { id: 'dispatch-logic', label: '배차 로직', href: '/dispatch-logic' },
] as const

export function WorkspaceTabs() {
  const pathname = usePathname()

  return (
    <nav className={styles.tabs} aria-label="KONAMOBILITY V2 작업공간">
      {v2Workspaces.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`${styles.tab} ${active ? styles.tabActive : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
