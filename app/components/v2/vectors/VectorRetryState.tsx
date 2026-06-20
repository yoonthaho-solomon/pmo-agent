'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import styles from './vectorWorkbench.module.css'

export function VectorRetryState({
  title,
  message,
}: {
  title: 'Error' | 'Partial'
  message: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <section className={styles.retryState} aria-live="polite">
      <div>
        <strong>{title}</strong>
        <span>{isPending ? '다시 불러오는 중입니다.' : message}</span>
      </div>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
      >
        {isPending ? 'Loading' : 'Retry'}
      </button>
    </section>
  )
}
