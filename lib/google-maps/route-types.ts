export type GoogleLatLng = {
  latitude: number
  longitude: number
}

export type GoogleRouteViewport = {
  low: GoogleLatLng
  high: GoogleLatLng
}

export type RoutePoint = {
  placeId?: string
  lat?: number
  lng?: number
  label?: string
}

export type RouteSummary = {
  distanceMeters: number
  durationSeconds: number
  staticDurationSeconds?: number
  encodedPolyline: string
  viewport?: GoogleRouteViewport
  source: 'google-routes'
  trafficAware: true
}

export type RouteApiState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'no_route'
  | 'invalid_input'
  | 'timeout'
  | 'quota_or_permission_error'
  | 'error'

export type RouteApiResponse =
  | { ok: true; route: RouteSummary }
  | { ok: false; state: Exclude<RouteApiState, 'idle' | 'loading' | 'success'>; message: string }

