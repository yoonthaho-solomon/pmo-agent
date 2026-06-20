import type { GoogleMapsGlobal, GooglePlace, GooglePlaceSessionToken } from './client-loader'

export type PlaceSuggestion = {
  id: string
  label: string
  secondaryText: string | null
  place: GooglePlace
}

export type ResolvedPlace = {
  placeId: string
  name: string
  address: string | null
  lat: number
  lng: number
}

export function createPlaceSessionToken(google: GoogleMapsGlobal): GooglePlaceSessionToken | null {
  const Token = google.maps.places?.AutocompleteSessionToken
  return Token ? new Token() : null
}

export async function fetchPlaceSuggestions(options: {
  google: GoogleMapsGlobal
  input: string
  sessionToken: GooglePlaceSessionToken | null
  center?: { lat: number; lng: number } | null
}): Promise<PlaceSuggestion[]> {
  const input = options.input.trim()
  if (input.length < 2) return []

  const autocomplete = options.google.maps.places?.AutocompleteSuggestion
  if (!autocomplete) throw new Error('places_unavailable')

  const request: Record<string, unknown> = {
    input,
    language: 'ko',
    region: 'kr',
    includedRegionCodes: ['kr'],
    sessionToken: options.sessionToken ?? undefined,
  }
  if (options.center) {
    request.locationBias = {
      center: { lat: options.center.lat, lng: options.center.lng },
      radius: 45000,
    }
  }

  const response = await autocomplete.fetchAutocompleteSuggestions(request)
  const suggestions: PlaceSuggestion[] = []
  for (const suggestion of response.suggestions ?? []) {
    const prediction = suggestion.placePrediction
    const place = prediction?.toPlace?.()
    const id = prediction?.placeId
    const label = prediction?.text?.text
    if (!prediction || !place || !id || !label) continue

    suggestions.push({
      id,
      label,
      secondaryText: null,
      place,
    })
  }
  return suggestions
}

export async function resolvePlace(suggestion: PlaceSuggestion): Promise<ResolvedPlace> {
  await suggestion.place.fetchFields?.({ fields: ['id', 'displayName', 'formattedAddress', 'location'] })
  const location = suggestion.place.location
  if (!location) throw new Error('place_location_missing')

  const displayName = typeof suggestion.place.displayName === 'string'
    ? suggestion.place.displayName
    : suggestion.place.displayName?.text

  return {
    placeId: suggestion.place.id ?? suggestion.id,
    name: displayName ?? suggestion.label,
    address: suggestion.place.formattedAddress ?? null,
    lat: location.lat(),
    lng: location.lng(),
  }
}
