import type { GoogleFormattableText, GoogleMapsGlobal, GooglePlace, GooglePlaceSessionToken } from './client-loader'

export type PlaceTextMatch = { start: number; end: number }

export type PlaceSuggestion = {
  id: string
  /** Full combined text — kept for resolve fallback and accessibility labels. */
  label: string
  /** Primary line: place name (e.g. 천안역). Falls back to the full text. */
  mainText: string
  /** Secondary line: address context (e.g. 충청남도 천안시 동남구). */
  secondaryText: string | null
  /** Matched ranges within mainText so the typed substring can be highlighted. */
  mainTextMatches: PlaceTextMatch[]
  /** Google place types, used to pick a leading icon (역/버스/상가/길 …). */
  types: string[]
  place: GooglePlace
}

function normalizeMatches(raw: GoogleFormattableText['matches'], text: string): PlaceTextMatch[] {
  if (!raw?.length) return []
  const out: PlaceTextMatch[] = []
  for (const match of raw) {
    const start = match.startOffset ?? 0
    const end = match.endOffset ?? (match.length != null ? start + match.length : null)
    if (end == null || end <= start) continue
    out.push({ start: Math.max(0, start), end: Math.min(text.length, end) })
  }
  return out
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
    const fullText = prediction?.text?.text
    if (!prediction || !place || !id || !fullText) continue

    // Places API (New) exposes mainText/secondaryText either directly on the prediction
    // or nested under structuredFormat depending on SDK version — read both defensively.
    const structured = prediction.structuredFormat
    const mainFt = prediction.mainText ?? structured?.mainText
    const secondaryFt = prediction.secondaryText ?? structured?.secondaryText
    const mainText = mainFt?.text ?? fullText
    const secondaryText = secondaryFt?.text ?? null

    suggestions.push({
      id,
      label: fullText,
      mainText,
      secondaryText,
      mainTextMatches: normalizeMatches(mainFt?.matches ?? prediction.text?.matches, mainText),
      types: prediction.types ?? [],
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
