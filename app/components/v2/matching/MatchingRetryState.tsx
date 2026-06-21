'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '../primitives/Button'
import styles from './matchingStudio.module.css'

export function MatchingRetryState({ title, message }: { title: string; message: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div className={styles.retryState} role="status">
      <strong>{title}</strong>
      <span>{message}</span>
      <Button
        variant="primary"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {isPending ? '다시 불러오는 중' : '다시 시도'}
      </Button>
    </div>
  )
}
