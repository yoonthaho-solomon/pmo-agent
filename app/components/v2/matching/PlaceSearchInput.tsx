'use client'

import type { KeyboardEvent, ReactNode } from 'react'
import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GoogleMapsGlobal } from '@/lib/google-maps/client-loader'
import type { ScenarioPointInput } from '@/lib/adapters/matching'
import type { PlaceTextMatch } from '@/lib/google-maps/places-client'
import { PlaceIcon } from './PlaceIcon'
import { usePlaceAutocomplete } from './usePlaceAutocomplete'
import styles from './matchingStudio.module.css'

// Bold the part of the place name that matches what the user typed. Prefer Google's
// match offsets; fall back to a case-insensitive substring scan when they're absent.
function highlightMatches(text: string, matches: PlaceTextMatch[] | undefined, query: string): ReactNode {
  let ranges = matches ?? []
  const trimmed = query.trim()
  if (!ranges.length && trimmed) {
    const index = text.toLowerCase().indexOf(trimmed.toLowerCase())
    if (index >= 0) ranges = [{ start: index, end: index + trimmed.length }]
  }
  if (!ranges.length) return text

  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  let cursor = 0
  sorted.forEach((range, i) => {
    if (range.start < cursor) return
    if (range.start > cursor) parts.push(text.slice(cursor, range.start))
    parts.push(<mark key={i} className={styles.placeMatch}>{text.slice(range.start, range.end)}</mark>)
    cursor = range.end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export function PlaceSearchInput({
  google,
  label,
  placeholder,
  value,
  text,
  center,
  onTextChange,
  onSelect,
  onClear,
}: {
  google: GoogleMapsGlobal | null
  label: string
  placeholder: string
  value: ScenarioPointInput | null
  text: string
  center: { lat: number; lng: number } | null
  onTextChange: (text: string) => void
  onSelect: (point: ScenarioPointInput) => void
  onClear: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const autocomplete = usePlaceAutocomplete(google, center, text, onTextChange)

  useEffect(() => {
    if (!autocomplete.suggestions.length) { setDropdownRect(null); return }
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    // Always open downward (consistent for origin AND destination); clamp the height to the
    // space remaining below so a low field's list scrolls internally instead of running off-screen.
    // Width matches the input container so the list lines up with the panel.
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const maxHeight = Math.max(140, Math.min(280, spaceBelow))
    setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight })
    // Depend on the suggestions array (not just its length): consecutive searches often return
    // the same count (e.g. 천안 → 천안역, both 5), and keying on length alone skips the recompute.
  }, [autocomplete.suggestions])

  async function choose(index: number) {
    const suggestion = autocomplete.suggestions[index]
    if (!suggestion) return
    const place = await autocomplete.selectSuggestion(suggestion)
    if (!place) return
    onSelect({
      placeId: place.placeId,
      lat: place.lat,
      lng: place.lng,
      label: place.address ?? place.name,
    })
  }

  function clearAll() {
    autocomplete.clear()
    onClear()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      clearAll()
      return
    }
    if (!autocomplete.suggestions.length) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      autocomplete.setActiveIndex(Math.min(autocomplete.suggestions.length - 1, autocomplete.activeIndex + 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      autocomplete.setActiveIndex(Math.max(0, autocomplete.activeIndex - 1))
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      void choose(autocomplete.activeIndex)
    }
  }

  return (
    <div className={styles.placeSearch} ref={containerRef}>
      <span className={styles.placeSearchLabel}>{label}</span>
      {value ? (
        <div className={styles.selectedPlace}>
          <div className={styles.selectedPlaceText}>
            <b>{value.label}</b>
            <small>{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</small>
          </div>
          <button
            type="button"
            className={styles.selectedPlaceClear}
            onClick={clearAll}
            aria-label={`${label} 변경`}
            title="변경"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <input
            value={autocomplete.query}
            placeholder={placeholder}
            aria-label={label}
            onChange={(event) => autocomplete.setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          {text.trim() ? <div className={styles.placeStatus}>검색 결과에서 장소를 선택해야 계산할 수 있습니다.</div> : null}
          {autocomplete.state === 'searching' ? <div className={styles.placeStatus}>검색 중</div> : null}
          {autocomplete.state === 'empty' ? <div className={styles.placeStatus}>검색 결과 없음</div> : null}
          {autocomplete.state === 'error' ? <div className={styles.placeStatus}>장소 검색 오류</div> : null}
        </>
      )}
      {autocomplete.suggestions.length && dropdownRect && typeof document !== 'undefined'
        ? createPortal(
          (
            <div
              className={styles.placeSuggestions}
              role="listbox"
              aria-label={`${label} 결과`}
              style={{
                position: 'fixed',
                top: dropdownRect.top,
                bottom: 'auto',
                left: dropdownRect.left,
                width: dropdownRect.width,
                maxHeight: dropdownRect.maxHeight,
                right: 'auto',
              }}
            >
              <div className={styles.placeSuggestionsHeader} aria-hidden>
                <span>장소 검색</span>
                <span>{autocomplete.suggestions.length}건</span>
              </div>
              {autocomplete.suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  role="option"
                  aria-selected={index === autocomplete.activeIndex}
                  data-active={index === autocomplete.activeIndex}
                  onMouseEnter={() => autocomplete.setActiveIndex(index)}
                  onClick={() => void choose(index)}
                >
                  <PlaceIcon types={suggestion.types} className={styles.placeSuggestionIcon} />
                  <span className={styles.placeSuggestionText}>
                    <b>{highlightMatches(suggestion.mainText, suggestion.mainTextMatches, autocomplete.query)}</b>
                    {suggestion.secondaryText ? <small>{suggestion.secondaryText}</small> : null}
                  </span>
                </button>
              ))}
            </div>
          ),
          document.body,
        )
        : null}
    </div>
  )
}
