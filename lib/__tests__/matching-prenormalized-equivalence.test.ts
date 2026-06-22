import { describe, it, expect } from 'vitest'
import { gridDisk, latLngToCell } from 'h3-js'
import { calculateSpatialScore } from '@/lib/h3-match-score'
import { normalizeH3Cell } from '@/lib/h3-dispatch'
import {
  calculateMatchingCandidate,
  type MatchingCallcardModel,
  type MatchingDriverModel,
} from '@/lib/matching-studio-model'
import { callToVector, driverToVector, type CallVectorInput, type DriverVectorRow } from '@/lib/matching-vector'

// Guards the performance optimization: the `prenormalized` fast path used by the SSR
// matching pipeline MUST produce byte-identical scores to the original per-pair-normalizing
// path. The matching score formula is protected (cosine 75% + H3 25%) and must not drift.

const originCell = latLngToCell(36.8151, 127.1139, 7)
const destCell = latLngToCell(36.8351, 127.1539, 7)

// A realistic spread of preferred cells: exact match, ring 1/2/3 neighbours, far cells,
// and (deliberately) upper-cased + whitespace-padded entries that only the slow path sees raw.
function spreadAround(center: string): string[] {
  const ring = gridDisk(center, 3) // distances 0..3
  const far = latLngToCell(35.1796, 129.0756, 7) // Busan — well beyond ring 3
  return [center.toUpperCase(), `  ${ring[2]}  `, ring[8], ring[15], far]
}

const driverRow: DriverVectorRow = {
  score_dawn: 0.2, score_morning: 0.8, score_daytime: 0.6, score_night: 0.3,
  score_mon: 0.5, score_tue: 0.5, score_wed: 0.7, score_thu: 0.4, score_fri: 0.9,
  score_sat: 0.2, score_sun: 0.1, score_short: 0.7, score_medium: 0.5, score_long: 0.2,
  score_low_fare: 0.3, score_mid_fare: 0.6, score_high_fare: 0.4, score_paid: 0.8,
  score_free: 0.2, score_surge: 0.5, score_normal: 0.5, score_near: 0.9,
}

const baseCall: CallVectorInput = {
  hour_slot: 8, weekday: 4, expected_distance: 5000, expected_fare: 15000, is_paid: true, is_surge: false,
}

describe('prenormalized fast path equivalence', () => {
  const rawOrigin = spreadAround(originCell)
  const rawDestination = spreadAround(destCell)
  const normOrigin = rawOrigin.map((c) => normalizeH3Cell(c)).filter((c): c is string => c != null)
  const normDestination = rawDestination.map((c) => normalizeH3Cell(c)).filter((c): c is string => c != null)

  it('calculateSpatialScore yields identical results with and without prenormalization', () => {
    const slow = calculateSpatialScore({
      originH3: originCell,
      destinationH3: destCell,
      preferredOriginH3Cells: rawOrigin,
      preferredDestinationH3Cells: rawDestination,
    })
    const fast = calculateSpatialScore({
      originH3: originCell,
      destinationH3: destCell,
      preferredOriginH3Cells: normOrigin,
      preferredDestinationH3Cells: normDestination,
      prenormalized: true,
    })

    expect(fast.spatialScore).toBe(slow.spatialScore)
    expect(fast.originScore).toBe(slow.originScore)
    expect(fast.destinationScore).toBe(slow.destinationScore)
    expect(fast.originBestDistance).toBe(slow.originBestDistance)
    expect(fast.destinationBestDistance).toBe(slow.destinationBestDistance)
    expect(fast.originBestCell).toBe(slow.originBestCell)
    expect(fast.destinationBestCell).toBe(slow.destinationBestCell)
  })

  it('calculateMatchingCandidate yields identical scores via the prefCache path', () => {
    const callcard = {
      id: 'call-1',
      etaDistance: 100,
      vector: callToVector({ ...baseCall, eta_distance: 100 }),
      vectorAvailable: true,
      route: { pickup: { h3Res7: originCell }, destination: { h3Res7: destCell } },
    } as unknown as MatchingCallcardModel

    const driver = {
      id: 'driver-1',
      reliability: 0.9,
      prefOriginH3: rawOrigin,
      prefDestinationH3: rawDestination,
      vector: driverToVector(driverRow),
      vectorAvailable: true,
    } as unknown as MatchingDriverModel

    const slow = calculateMatchingCandidate(callcard, driver)
    const fast = calculateMatchingCandidate(callcard, driver, { origin: normOrigin, destination: normDestination })

    expect(slow).not.toBeNull()
    expect(fast).not.toBeNull()
    expect(fast!.similarityScore).toBe(slow!.similarityScore)
    expect(fast!.spatial.spatialScore).toBe(slow!.spatial.spatialScore)
    expect(fast!.finalScore).toBe(slow!.finalScore)
    expect(fast!.displayH3.cell).toBe(slow!.displayH3.cell)
    expect(fast!.displayH3.kind).toBe(slow!.displayH3.kind)
  })
})
