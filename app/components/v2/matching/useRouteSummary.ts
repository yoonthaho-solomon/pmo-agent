'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ScenarioPointInput } from '@/lib/adapters/matching'
import type { RouteApiResponse, RouteApiState, RouteSummary } from '@/lib/google-maps/route-types'

export function useRouteSummary(origin: ScenarioPointInput | null, destination: ScenarioPointInput | null) {
  const hasRouteInput = origin != null && destination != null
  const [state, setState] = useState<RouteApiState>('idle')
  const [route, setRoute] = useState<RouteSummary | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const requestKey = useMemo(() => {
    if (!origin || !destination) return ''
    return `${origin.placeId ?? ''}:${origin.lat}:${origin.lng}:${destination.placeId ?? ''}:${destination.lat}:${destination.lng}:${nonce}`
  }, [destination, nonce, origin])

  useEffect(() => {
    if (!origin || !destination) return

    const controller = new AbortController()
    window.setTimeout(() => {
      setState('loading')
      setMessage(null)
    }, 0)

    fetch('/api/maps/routes', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    })
      .then(async (response) => {
        const result = await response.json() as RouteApiResponse
        if (!result.ok) {
          setRoute(null)
          setState(result.state)
          setMessage(result.message)
          return
        }

        setRoute(result.route)
        setState('success')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setRoute(null)
        setState('error')
        setMessage('경로 계산에 실패했습니다.')
      })

    return () => controller.abort()
  }, [destination, origin, requestKey])

  return {
    state: hasRouteInput ? state : 'idle',
    route: hasRouteInput ? route : null,
    message: hasRouteInput ? message : null,
    retry: () => setNonce((value) => value + 1),
  }
}


