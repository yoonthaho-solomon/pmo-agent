'use client'

import { useEffect, useState } from 'react'
import { loadGoogleMaps, type GoogleMapsGlobal } from '@/lib/google-maps/client-loader'

export type GoogleMapsApiState = 'loading' | 'ready' | 'missing_config' | 'load_error'

export function useGoogleMapsApi() {
  const configMissing = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || !process.env.NEXT_PUBLIC_GOOGLE_MAP_ID
  const [google, setGoogle] = useState<GoogleMapsGlobal | null>(null)
  const [state, setState] = useState<GoogleMapsApiState>(configMissing ? 'missing_config' : 'loading')

  useEffect(() => {
    if (configMissing) return

    let cancelled = false
    loadGoogleMaps()
      .then((next) => {
        if (cancelled) return
        setGoogle(next)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('load_error')
      })

    return () => {
      cancelled = true
    }
  }, [configMissing])

  return { google, state }
}
