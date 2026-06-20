'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GoogleMapsGlobal, GooglePlaceSessionToken } from '@/lib/google-maps/client-loader'
import { createPlaceSessionToken, fetchPlaceSuggestions, resolvePlace, type PlaceSuggestion, type ResolvedPlace } from '@/lib/google-maps/places-client'

export type PlacesState = 'idle' | 'searching' | 'success' | 'empty' | 'error'

export function usePlaceAutocomplete(google: GoogleMapsGlobal | null, center: { lat: number; lng: number } | null) {
  const [query, setQueryState] = useState('')
  const [state, setState] = useState<PlacesState>('idle')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedPlace, setSelectedPlace] = useState<ResolvedPlace | null>(null)
  const sessionTokenRef = useRef<GooglePlaceSessionToken | null>(null)
  const requestIdRef = useRef(0)
  const lastRequestRef = useRef('')

  const canSearch = useMemo(() => query.trim().length >= 2 && google != null, [google, query])

  useEffect(() => {
    if (!google) return
    sessionTokenRef.current = createPlaceSessionToken(google)
  }, [google])

  useEffect(() => {
    if (!google || query.trim().length < 2) return

    const normalized = query.trim()
    const timer = window.setTimeout(async () => {
      if (lastRequestRef.current === normalized) return
      lastRequestRef.current = normalized
      const requestId = ++requestIdRef.current
      setState('searching')

      try {
        const next = await fetchPlaceSuggestions({
          google,
          input: normalized,
          center,
          sessionToken: sessionTokenRef.current,
        })
        if (requestId !== requestIdRef.current) return
        setSuggestions(next)
        setActiveIndex(0)
        setState(next.length ? 'success' : 'empty')
      } catch {
        if (requestId !== requestIdRef.current) return
        setSuggestions([])
        setState('error')
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [center, google, query])

  async function selectSuggestion(suggestion: PlaceSuggestion): Promise<ResolvedPlace | null> {
    try {
      const place = await resolvePlace(suggestion)
      setSelectedPlace(place)
      setQueryState(place.address ?? place.name)
      setSuggestions([])
      setState('idle')
      sessionTokenRef.current = google ? createPlaceSessionToken(google) : null
      lastRequestRef.current = ''
      return place
    } catch {
      setState('error')
      return null
    }
  }

  function clear() {
    setQueryState('')
    setSelectedPlace(null)
    setSuggestions([])
    setState('idle')
    setActiveIndex(0)
    sessionTokenRef.current = google ? createPlaceSessionToken(google) : null
    lastRequestRef.current = ''
  }

  function setQuery(next: string) {
    setQueryState(next)
    setSelectedPlace(null)
    if (next.trim().length < 2) {
      setSuggestions([])
      setState('idle')
      setActiveIndex(0)
      lastRequestRef.current = ''
    }
  }

  return {
    query,
    setQuery,
    canSearch,
    state,
    suggestions,
    activeIndex,
    setActiveIndex,
    selectedPlace,
    selectSuggestion,
    clear,
  }
}
