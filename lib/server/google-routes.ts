import type { RouteApiResponse, RoutePoint, RouteSummary } from '@/lib/google-maps/route-types'

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes'
const ROUTES_FIELD_MASK = [
  'routes.distanceMeters',
  'routes.duration',
  'routes.staticDuration',
  'routes.polyline.encodedPolyline',
  'routes.viewport',
].join(',')
const ROUTES_TIMEOUT_MS = 9000

type GoogleRoutesRawResponse = {
  routes?: Array<{
    distanceMeters?: number
    duration?: string
    staticDuration?: string
    polyline?: { encodedPolyline?: string }
    viewport?: RouteSummary['viewport']
  }>
}

function durationToSeconds(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value)
  if (!match) return null
  const seconds = Number(match[1])
  return Number.isFinite(seconds) ? Math.round(seconds) : null
}

function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && Number.isFinite(lat) &&
    typeof lng === 'number' && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

function pointToWaypoint(point: RoutePoint): { placeId: string } | { location: { latLng: { latitude: number; longitude: number } } } | null {
  if (point.placeId?.trim()) return { placeId: point.placeId.trim() }
  if (isValidCoordinate(point.lat, point.lng)) {
    return { location: { latLng: { latitude: point.lat, longitude: point.lng as number } } }
  }
  return null
}

export async function fetchGoogleRouteSummary(origin: RoutePoint, destination: RoutePoint): Promise<RouteApiResponse> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY
  if (!apiKey) {
    return { ok: false, state: 'invalid_input', message: 'Google Routes 서버 설정이 필요합니다.' }
  }

  const originWaypoint = pointToWaypoint(origin)
  const destinationWaypoint = pointToWaypoint(destination)
  if (!originWaypoint || !destinationWaypoint) {
    return { ok: false, state: 'invalid_input', message: '출발지와 도착지 좌표를 확정해 주세요.' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ROUTES_TIMEOUT_MS)

  try {
    const response = await fetch(ROUTES_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': ROUTES_FIELD_MASK,
      },
      body: JSON.stringify({
        origin: originWaypoint,
        destination: destinationWaypoint,
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        languageCode: 'ko-KR',
        units: 'METRIC',
        computeAlternativeRoutes: false,
      }),
    })

    if (!response.ok) {
      const state = response.status === 403 || response.status === 429 ? 'quota_or_permission_error' : 'error'
      return { ok: false, state, message: 'Google Routes 경로 계산에 실패했습니다.' }
    }

    const body = await response.json() as GoogleRoutesRawResponse
    const route = body.routes?.[0]
    const durationSeconds = durationToSeconds(route?.duration)
    const staticDurationSeconds = durationToSeconds(route?.staticDuration)
    const distanceMeters = route?.distanceMeters
    const encodedPolyline = route?.polyline?.encodedPolyline

    if (!route || !distanceMeters || !durationSeconds || !encodedPolyline) {
      return { ok: false, state: 'no_route', message: '표시할 수 있는 경로가 없습니다.' }
    }

    return {
      ok: true,
      route: {
        distanceMeters,
        durationSeconds,
        staticDurationSeconds: staticDurationSeconds ?? undefined,
        encodedPolyline,
        viewport: route.viewport,
        source: 'google-routes',
        trafficAware: true,
      },
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, state: 'timeout', message: 'Google Routes 경로 계산 시간이 초과됐습니다.' }
    }
    return { ok: false, state: 'error', message: 'Google Routes 경로 계산에 실패했습니다.' }
  } finally {
    clearTimeout(timeoutId)
  }
}

