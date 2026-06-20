'use client'

import type { KeyboardEvent } from 'react'
import type { GoogleMapsGlobal } from '@/lib/google-maps/client-loader'
import type { ScenarioPointInput } from '@/lib/adapters/matching'
import { usePlaceAutocomplete } from './usePlaceAutocomplete'
import styles from './matchingStudio.module.css'

export function PlaceSearchInput({
  google,
  label,
  placeholder,
  value,
  center,
  onSelect,
  onClear,
}: {
  google: GoogleMapsGlobal | null
  label: string
  placeholder: string
  value: ScenarioPointInput | null
  center: { lat: number; lng: number } | null
  onSelect: (point: ScenarioPointInput) => void
  onClear: () => void
}) {
  const autocomplete = usePlaceAutocomplete(google, center)

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

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      autocomplete.clear()
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
    <div className={styles.placeSearch}>
      <label>
        <span>{label}</span>
        <input
          value={autocomplete.query}
          placeholder={placeholder}
          aria-label={label}
          onChange={(event) => autocomplete.setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      {value ? (
        <div className={styles.selectedPlace}>
          <b>{value.label}</b>
          <small>{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</small>
          <button type="button" onClick={() => {
            autocomplete.clear()
            onClear()
          }}>초기화</button>
        </div>
      ) : null}
      {autocomplete.state === 'searching' ? <div className={styles.placeStatus}>검색 중</div> : null}
      {autocomplete.state === 'empty' ? <div className={styles.placeStatus}>검색 결과 없음</div> : null}
      {autocomplete.state === 'error' ? <div className={styles.placeStatus}>장소 검색 오류</div> : null}
      {autocomplete.suggestions.length ? (
        <div className={styles.placeSuggestions} role="listbox" aria-label={`${label} 검색 결과`}>
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
              <b>{suggestion.label}</b>
              {suggestion.secondaryText ? <small>{suggestion.secondaryText}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
