import { getResolution } from 'h3-js'
import {
  coordinateToH3Res7,
  coordinateToH3Res8,
  createOdKey,
  isValidCoordinate,
  normalizeH3Cell,
} from './h3-dispatch'
import type { MatchingLocation, MatchingRouteLocation } from '../types/matching-location'

export interface CallcardLocationRow {
  passenger_lat?: number | string | null
  passenger_lng?: number | string | null
  dest_lat?: number | string | null
  dest_lng?: number | string | null
  s_hexagon?: string | null
  d_hexagon?: string | null
}

export type H3Source = 'STORED' | 'COORDINATE' | 'NONE'

export interface BuildLocationFromCallcardFieldsInput {
  lat: number | string | null | undefined
  lng: number | string | null | undefined
  storedH3?: string | null
}

export interface BuildLocationFromCallcardFieldsResult {
  location: MatchingLocation
  h3Source: H3Source
  h3Mismatch: boolean
  coordinateValid: boolean
  storedH3Res7: string | null
  coordinateH3Res7: string | null
}

export interface AdaptCallcardLocationResult {
  route: MatchingRouteLocation
  diagnostics: {
    pickupH3Source: H3Source
    destinationH3Source: H3Source
    pickupH3Mismatch: boolean
    destinationH3Mismatch: boolean
    pickupCoordinateValid: boolean
    destinationCoordinateValid: boolean
  }
}

export function toNullableNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeStoredH3Res7(cell: string | null | undefined): string | null {
  const normalized = normalizeH3Cell(cell)
  if (!normalized) return null

  try {
    return getResolution(normalized) === 7 ? normalized : null
  } catch {
    return null
  }
}

export function buildLocationFromCallcardFields(
  options: BuildLocationFromCallcardFieldsInput,
): BuildLocationFromCallcardFieldsResult {
  const lat = toNullableNumber(options.lat)
  const lng = toNullableNumber(options.lng)
  const coordinateValid = isValidCoordinate(lat, lng)
  const safeLat = coordinateValid ? lat : null
  const safeLng = coordinateValid ? lng : null
  const storedH3Res7 = normalizeStoredH3Res7(options.storedH3)
  const coordinateH3Res7 = coordinateValid ? coordinateToH3Res7(safeLat, safeLng) : null
  const h3Res7 = storedH3Res7 ?? coordinateH3Res7
  const h3Source: H3Source = storedH3Res7 ? 'STORED' : coordinateH3Res7 ? 'COORDINATE' : 'NONE'

  return {
    location: {
      lat: safeLat,
      lng: safeLng,
      h3Res7,
      h3Res8: coordinateValid ? coordinateToH3Res8(safeLat, safeLng) : null,
    },
    h3Source,
    h3Mismatch: Boolean(storedH3Res7 && coordinateH3Res7 && storedH3Res7 !== coordinateH3Res7),
    coordinateValid,
    storedH3Res7,
    coordinateH3Res7,
  }
}

export function adaptCallcardLocation(row: CallcardLocationRow): AdaptCallcardLocationResult {
  const pickup = buildLocationFromCallcardFields({
    lat: row.passenger_lat,
    lng: row.passenger_lng,
    storedH3: row.s_hexagon,
  })
  const destination = buildLocationFromCallcardFields({
    lat: row.dest_lat,
    lng: row.dest_lng,
    storedH3: row.d_hexagon,
  })

  return {
    route: {
      pickup: pickup.location,
      destination: destination.location,
      originDestinationKey: createOdKey(pickup.location.h3Res7, destination.location.h3Res7),
    },
    diagnostics: {
      pickupH3Source: pickup.h3Source,
      destinationH3Source: destination.h3Source,
      pickupH3Mismatch: pickup.h3Mismatch,
      destinationH3Mismatch: destination.h3Mismatch,
      pickupCoordinateValid: pickup.coordinateValid,
      destinationCoordinateValid: destination.coordinateValid,
    },
  }
}
