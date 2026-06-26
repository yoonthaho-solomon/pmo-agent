import {
  cellToLatLng,
  getResolution,
  gridDistance,
  isValidCell,
  latLngToCell,
} from 'h3-js'
import type { MatchingLocation, MatchingRouteLocation } from '../types/matching-location'

const H3_RESOLUTION_7 = 7
const H3_RESOLUTION_8 = 8

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeH3CellAtResolution(cell: string | null | undefined, resolution: number): string | null {
  const normalized = normalizeH3Cell(cell)
  if (!normalized) return null

  try {
    return getResolution(normalized) === resolution ? normalized : null
  } catch {
    return null
  }
}

export function isValidCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return isFiniteNumber(lat) && isFiniteNumber(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function normalizeH3Cell(cell: string | null | undefined): string | null {
  if (cell == null) return null

  const normalized = cell.trim().toLowerCase()
  if (!normalized) return null

  try {
    return isValidCell(normalized) ? normalized : null
  } catch {
    return null
  }
}

function coordinateToH3(
  lat: number | null | undefined,
  lng: number | null | undefined,
  resolution: number,
): string | null {
  if (!isValidCoordinate(lat, lng)) return null
  const safeLat = lat as number
  const safeLng = lng as number

  try {
    const cell = latLngToCell(safeLat, safeLng, resolution)
    return normalizeH3CellAtResolution(cell, resolution)
  } catch {
    return null
  }
}

export function coordinateToH3Res7(lat: number | null | undefined, lng: number | null | undefined): string | null {
  return coordinateToH3(lat, lng, H3_RESOLUTION_7)
}

export function coordinateToH3Res8(lat: number | null | undefined, lng: number | null | undefined): string | null {
  return coordinateToH3(lat, lng, H3_RESOLUTION_8)
}

export function resolveH3Res7(location: MatchingLocation): string | null {
  return normalizeH3CellAtResolution(location.h3Res7, H3_RESOLUTION_7) ?? coordinateToH3Res7(location.lat, location.lng)
}

export function createOdKey(originH3: string | null | undefined, destinationH3: string | null | undefined): string | null {
  const origin = normalizeH3CellAtResolution(originH3, H3_RESOLUTION_7)
  const destination = normalizeH3CellAtResolution(destinationH3, H3_RESOLUTION_7)
  if (!origin || !destination) return null
  return `${origin}_${destination}`
}

export function getH3GridDistance(originH3: string | null | undefined, destinationH3: string | null | undefined): number | null {
  const origin = normalizeH3Cell(originH3)
  const destination = normalizeH3Cell(destinationH3)
  if (!origin || !destination) return null
  if (getResolution(origin) !== getResolution(destination)) return null
  if (origin === destination) return 0

  try {
    return gridDistance(origin, destination)
  } catch {
    return null
  }
}

// Center of an H3 cell as a deck.gl-style [lng, lat] position (null when invalid).
export function h3CellCenterLngLat(cell: string | null | undefined): [number, number] | null {
  const normalized = normalizeH3Cell(cell)
  if (!normalized) return null
  try {
    const [lat, lng] = cellToLatLng(normalized)
    return [lng, lat]
  } catch {
    return null
  }
}

export function getH3RingWeight(distance: number | null | undefined): number {
  if (distance === 0) return 1
  if (distance === 1) return 0.7
  if (distance === 2) return 0.4
  if (distance === 3) return 0.2
  return 0
}

export function buildMatchingRouteLocation(
  pickup: MatchingLocation,
  destination: MatchingLocation,
): MatchingRouteLocation {
  const pickupH3Res7 = resolveH3Res7(pickup)
  const destinationH3Res7 = resolveH3Res7(destination)

  return {
    pickup: {
      ...pickup,
      h3Res7: pickupH3Res7,
      h3Res8: normalizeH3CellAtResolution(pickup.h3Res8, H3_RESOLUTION_8) ?? coordinateToH3Res8(pickup.lat, pickup.lng),
    },
    destination: {
      ...destination,
      h3Res7: destinationH3Res7,
      h3Res8: normalizeH3CellAtResolution(destination.h3Res8, H3_RESOLUTION_8) ?? coordinateToH3Res8(destination.lat, destination.lng),
    },
    originDestinationKey: createOdKey(pickupH3Res7, destinationH3Res7),
  }
}
