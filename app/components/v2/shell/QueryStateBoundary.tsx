import type { ReactNode } from 'react'
import { EmptyState, ErrorState, LoadingState, PartialState } from '../primitives/QueryStates'

export type V2QueryStatus = 'idle' | 'loading' | 'success' | 'empty' | 'partial' | 'error'

export function QueryStateBoundary({
  status,
  message,
  children,
}: {
  status: V2QueryStatus
  message?: string
  children: ReactNode
}) {
  if (status === 'loading' || status === 'idle') return <LoadingState message={message} />
  if (status === 'empty') return <EmptyState message={message} />
  if (status === 'partial') return <PartialState message={message} />
  if (status === 'error') return <ErrorState message={message} />
  return <>{children}</>
}
