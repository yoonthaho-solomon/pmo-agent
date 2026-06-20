'use client'

import { useEffect, useMemo, useState } from 'react'
import { adaptIngestionSummary, type SystemStatusResponse } from '@/lib/adapters/ingestion'
import type { V2QueryStatus } from '../shell/QueryStateBoundary'

export function useDataOpsStatus() {
  const [rawStatus, setRawStatus] = useState<SystemStatusResponse | null>(null)
  const [queryStatus, setQueryStatus] = useState<V2QueryStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      setQueryStatus('loading')
      setErrorMessage(undefined)
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch('/api/system-status', { cache: 'no-store', signal: controller.signal })
        const json = await response.json() as SystemStatusResponse
        if (cancelled) return

        setRawStatus(json)
        if (!response.ok || json.error) {
          setQueryStatus('error')
          setErrorMessage(json.error ?? `Status API failed with ${response.status}`)
        } else if (json.ok === false) {
          setQueryStatus(json.source === 'none' ? 'error' : 'partial')
          setErrorMessage(json.message)
        } else if (!json.callTables?.length && !json.meterTables?.length && !json.vectorTables?.length) {
          setQueryStatus('empty')
        } else {
          setQueryStatus('success')
        }
      } catch (error) {
        if (cancelled) return
        setRawStatus(null)
        setQueryStatus('error')
        setErrorMessage(error instanceof Error && error.name === 'AbortError'
          ? 'Status API timed out.'
          : 'Could not load ingestion status.')
      } finally {
        window.clearTimeout(timer)
      }
    }

    loadStatus()
    return () => {
      cancelled = true
    }
  }, [retryKey])

  const model = useMemo(() => rawStatus ? adaptIngestionSummary(rawStatus) : null, [rawStatus])

  return {
    model,
    rawStatus,
    queryStatus,
    errorMessage,
    retry: () => setRetryKey((key) => key + 1),
  }
}
