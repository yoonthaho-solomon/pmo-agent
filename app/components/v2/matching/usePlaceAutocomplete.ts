'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GoogleMapsGlobal, GooglePlaceSessionToken } from '@/lib/google-maps/client-loader'
import { createPlaceSessionToken, fetchPlaceSuggestions, resolvePlace, type PlaceSuggestion, type ResolvedPlace } from '@/lib/google-maps/places-client'

export type PlacesState = 'idle' | 'searching' | 'success' | 'empty' | 'error'

export function usePlaceAutocomplete(
  google: GoogleMapsGlobal | null,
  center: { lat: number; lng: number } | null,
  query: string,
  setQuery: (next: string) => void,
) {
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
    const normalized = query.trim()
    if (!google || normalized.length < 2) {
      requestIdRef.current += 1
      lastRequestRef.current = ''
      const resetTimer = window.setTimeout(() => {
        setSuggestions([])
        setState('idle')
        setActiveIndex(0)
      }, 0)
      return () => window.clearTimeout(resetTimer)
    }

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
        if (requestId !== requestIdRef.current || normalized !== query.trim()) return
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
      const label = place.address ?? place.name
      setSelectedPlace(place)
      setQuery(label)
      setSuggestions([])
      setState('idle')
      setActiveIndex(0)
      sessionTokenRef.current = google ? createPlaceSessionToken(google) : null
      lastRequestRef.current = ''
      requestIdRef.current += 1
      return place
    } catch {
      setState('error')
      return null
    }
  }

  function clear() {
    requestIdRef.current += 1
    setQuery('')
    setSelectedPlace(null)
    setSuggestions([])
    setState('idle')
    setActiveIndex(0)
    sessionTokenRef.current = google ? createPlaceSessionToken(google) : null
    lastRequestRef.current = ''
  }

  function close() {
    requestIdRef.current += 1
    setSuggestions([])
    setState('idle')
    setActiveIndex(0)
    lastRequestRef.current = ''
  }

  function updateQuery(next: string) {
    setQuery(next)
    setSelectedPlace(null)
    if (next.trim().length < 2) {
      requestIdRef.current += 1
      setSuggestions([])
      setState('idle')
      setActiveIndex(0)
      lastRequestRef.current = ''
    }
  }

  return {
    query,
    setQuery: updateQuery,
    canSearch,
    state,
    suggestions,
    activeIndex,
    setActiveIndex,
    selectedPlace,
    selectSuggestion,
    clear,
    close,
  }
}
