export type GoogleMapsConfigState = 'configured' | 'missing'

type LoaderWindow = Window & {
  google?: GoogleMapsGlobal
  __kmGoogleMapsPromise?: Promise<GoogleMapsGlobal>
}

export type GoogleMapsGlobal = {
  maps: {
    Map: GoogleMapConstructor
    LatLngBounds: GoogleLatLngBoundsConstructor
    event: GoogleMapsEventNamespace
    importLibrary?: (library: string) => Promise<unknown>
    places?: GooglePlacesNamespace
  }
}

export type GoogleMapsEventNamespace = {
  addListenerOnce: (instance: unknown, eventName: string, handler: () => void) => void
}

export type GoogleMapConstructor = new (
  element: HTMLElement,
  options: Record<string, unknown>,
) => GoogleMapInstance

export type GoogleLatLngBoundsConstructor = new (
  sw?: { lat: number; lng: number },
  ne?: { lat: number; lng: number },
) => GoogleLatLngBounds

export type GoogleMapInstance = {
  setCenter: (latLng: { lat: number; lng: number }) => void
  panTo: (latLng: { lat: number; lng: number }) => void
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void
  getZoom: () => number | undefined
  setZoom: (zoom: number) => void
}

export type GoogleLatLngBounds = {
  extend: (latLng: { lat: number; lng: number }) => void
}

export type GooglePlaceSessionToken = object

export type GooglePlacesNamespace = {
  AutocompleteSessionToken?: new () => GooglePlaceSessionToken
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions: (request: Record<string, unknown>) => Promise<{ suggestions?: GoogleAutocompleteSuggestion[] }>
  }
}

export type GoogleAutocompleteSuggestion = {
  placePrediction?: {
    text?: { text?: string }
    placeId?: string
    toPlace?: () => GooglePlace
  }
}

export type GooglePlace = {
  id?: string
  displayName?: string | { text?: string }
  formattedAddress?: string
  location?: { lat: () => number; lng: () => number }
  fetchFields?: (request: { fields: string[] }) => Promise<void>
}

export function googleMapsConfigState(): GoogleMapsConfigState {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'configured' : 'missing'
}

export function loadGoogleMaps(): Promise<GoogleMapsGlobal> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps can only load in the browser.'))

  const loaderWindow = window as unknown as LoaderWindow
  if (loaderWindow.google?.maps) return Promise.resolve(loaderWindow.google)
  if (loaderWindow.__kmGoogleMapsPromise) return loaderWindow.__kmGoogleMapsPromise

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return Promise.reject(new Error('missing_config'))

  loaderWindow.__kmGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-km-google-maps="true"]')
    if (existing) {
      existing.addEventListener('load', () => loaderWindow.google?.maps ? resolve(loaderWindow.google) : reject(new Error('load_error')), { once: true })
      existing.addEventListener('error', () => reject(new Error('load_error')), { once: true })
      return
    }

    const script = document.createElement('script')
    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      libraries: 'places',
      language: 'ko',
      region: 'KR',
    })
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.defer = true
    script.dataset.kmGoogleMaps = 'true'
    script.onload = () => loaderWindow.google?.maps ? resolve(loaderWindow.google) : reject(new Error('load_error'))
    script.onerror = () => reject(new Error('load_error'))
    document.head.appendChild(script)
  })

  return loaderWindow.__kmGoogleMapsPromise
}


