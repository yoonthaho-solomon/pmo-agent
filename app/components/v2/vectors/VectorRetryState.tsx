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
  const titleText = title === 'Error' ? '벡터 데이터를 불러오지 못했습니다' : '일부 데이터만 연결되었습니다'

  return (
    <section className={styles.retryState} aria-live="polite">
      <div>
        <strong>{titleText}</strong>
        <span>{isPending ? '다시 불러오는 중입니다.' : message}</span>
      </div>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
      >
        {isPending ? '불러오는 중' : '다시 시도'}
      </button>
    </section>
  )
}
