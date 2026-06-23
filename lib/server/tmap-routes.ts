import type { RouteApiResponse, RoutePoint, RouteSummary } from '@/lib/google-maps/route-types'
import { encodePolyline, type DecodedPolylinePoint } from '@/lib/google-maps/polyline'

// TMap 자동차 경로안내 (T맵 모빌리티). Google Routes는 한국 국내 운전경로를 제공하지 않으므로
// 국내 경로/ETA는 TMap으로 계산한다. 응답은 GeoJSON(FeatureCollection)이며, 요약(거리/시간)은
// 첫 Point feature properties에, 경로 좌표는 LineString feature들의 coordinates에 담겨 온다.
const TMAP_ENDPOINT = 'https://apis.openapi.sk.com/tmap/routes?version=1&format=json'
const TMAP_TIMEOUT_MS = 9000

type TmapFeature = {
  geometry?: {
    type?: string
    coordinates?: unknown
  }
  properties?: {
    totalDistance?: number
    totalTime?: number
    taxiFare?: number
    totalFare?: number
    pointType?: string
  }
}

type TmapResponse = {
  features?: TmapFeature[]
}

function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && Number.isFinite(lat) &&
    typeof lng === 'number' && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

function collectLineStringPath(features: TmapFeature[]): DecodedPolylinePoint[] {
  const path: DecodedPolylinePoint[] = []
  for (const feature of features) {
    if (feature.geometry?.type !== 'LineString') continue
    const coordinates = feature.geometry.coordinates
    if (!Array.isArray(coordinates)) continue
    for (const pair of coordinates) {
      if (!Array.isArray(pair) || pair.length < 2) continue
      const [lng, lat] = pair as [unknown, unknown]
      if (isValidCoordinate(lat, lng)) path.push({ lat, lng: lng as number })
    }
  }
  return path
}

function pathViewport(path: DecodedPolylinePoint[]): RouteSummary['viewport'] {
  if (!path.length) return undefined
  let lowLat = path[0].lat
  let lowLng = path[0].lng
  let highLat = path[0].lat
  let highLng = path[0].lng
  for (const point of path) {
    if (point.lat < lowLat) lowLat = point.lat
    if (point.lng < lowLng) lowLng = point.lng
    if (point.lat > highLat) highLat = point.lat
    if (point.lng > highLng) highLng = point.lng
  }
  return {
    low: { latitude: lowLat, longitude: lowLng },
    high: { latitude: highLat, longitude: highLng },
  }
}

export async function fetchTmapRouteSummary(origin: RoutePoint, destination: RoutePoint): Promise<RouteApiResponse> {
  const appKey = process.env.TMAP_APP_KEY
  if (!appKey) {
    return { ok: false, state: 'invalid_input', message: 'TMap 경로 서버 설정(TMAP_APP_KEY)이 필요합니다.' }
  }
  if (!isValidCoordinate(origin.lat, origin.lng) || !isValidCoordinate(destination.lat, destination.lng)) {
    return { ok: false, state: 'invalid_input', message: '출발지와 도착지 좌표를 확인해 주세요.' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TMAP_TIMEOUT_MS)

  try {
    const response = await fetch(TMAP_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        appKey,
      },
      body: JSON.stringify({
        startX: String(origin.lng),
        startY: String(origin.lat),
        endX: String(destination.lng),
        endY: String(destination.lat),
        reqCoordType: 'WGS84GEO',
        resCoordType: 'WGS84GEO',
        searchOption: '0',
        trafficInfo: 'N',
      }),
    })

    if (!response.ok) {
      const state = response.status === 401 || response.status === 403 || response.status === 429
        ? 'quota_or_permission_error'
        : 'error'
      return { ok: false, state, message: 'TMap 경로 계산에 실패했습니다.' }
    }

    const body = await response.json() as TmapResponse
    const features = body.features ?? []
    const summary = features.find((feature) => typeof feature.properties?.totalDistance === 'number')?.properties
    const path = collectLineStringPath(features)

    if (!summary || !summary.totalDistance || !summary.totalTime || path.length < 2) {
      return { ok: false, state: 'no_route', message: '표시할 수 있는 경로가 없습니다.' }
    }

    return {
      ok: true,
      route: {
        distanceMeters: summary.totalDistance,
        durationSeconds: summary.totalTime,
        encodedPolyline: encodePolyline(path),
        viewport: pathViewport(path),
        source: 'tmap',
        trafficAware: false,
      },
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, state: 'timeout', message: 'TMap 경로 계산 시간이 초과되었습니다.' }
    }
    return { ok: false, state: 'error', message: 'TMap 경로 계산에 실패했습니다.' }
  } finally {
    clearTimeout(timeoutId)
  }
}
