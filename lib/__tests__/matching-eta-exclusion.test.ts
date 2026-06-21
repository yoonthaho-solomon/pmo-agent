import { describe, it, expect } from 'vitest'
import { latLngToCell } from 'h3-js'
import {
  callToVector,
  driverToVector,
  cosineSimilarity,
  cosineSimilarityForMatching,
  matchingVectorSlice,
  MATCHING_EXCLUDED_DIMENSION_KEYS,
  VECTOR_DIMENSIONS,
  type CallVectorInput,
  type DriverVectorRow,
} from '@/lib/matching-vector'
import {
  calculateMatchingCandidate,
  type MatchingCallcardModel,
  type MatchingDriverModel,
} from '@/lib/matching-studio-model'

// A driver vector row with non-trivial values across every dimension,
// including a non-zero score_near (the ETA-derived dimension).
const driverRow: DriverVectorRow = {
  score_dawn: 0.2,
  score_morning: 0.8,
  score_daytime: 0.6,
  score_night: 0.3,
  score_mon: 0.5,
  score_tue: 0.5,
  score_wed: 0.7,
  score_thu: 0.4,
  score_fri: 0.9,
  score_sat: 0.2,
  score_sun: 0.1,
  score_short: 0.7,
  score_medium: 0.5,
  score_long: 0.2,
  score_low_fare: 0.3,
  score_mid_fare: 0.6,
  score_high_fare: 0.4,
  score_paid: 0.8,
  score_free: 0.2,
  score_surge: 0.5,
  score_normal: 0.5,
  score_near: 0.9,
}

const baseCall: CallVectorInput = {
  hour_slot: 8,
  weekday: 4,
  expected_distance: 5000,
  expected_fare: 15000,
  is_paid: true,
  is_surge: false,
}

// Same call, only eta_distance differs -> only the score_near (ETA) dimension changes.
const callNearEta: CallVectorInput = { ...baseCall, eta_distance: 100 }
const callFarEta: CallVectorInput = { ...baseCall, eta_distance: 580 }

describe('ETA exclusion from the final matching cosine', () => {
  it('produces 22D vectors that differ only in the ETA (score_near) dimension', () => {
    const near = callToVector(callNearEta)
    const far = callToVector(callFarEta)
    expect(near).toHaveLength(VECTOR_DIMENSIONS.length)
    expect(near).toHaveLength(22)

    const etaIndex = VECTOR_DIMENSIONS.findIndex((d) => d.key === 'score_near')
    for (let i = 0; i < near.length; i++) {
      if (i === etaIndex) {
        expect(near[i]).not.toBe(far[i])
      } else {
        expect(near[i]).toBe(far[i])
      }
    }
  })

  it('matchingVectorSlice drops the ETA dimensions and keeps the rest', () => {
    const full = VECTOR_DIMENSIONS.map((_, i) => i + 1) // positional marker values
    const sliced = matchingVectorSlice(full)
    expect(sliced).toHaveLength(VECTOR_DIMENSIONS.length - MATCHING_EXCLUDED_DIMENSION_KEYS.length)
    expect(MATCHING_EXCLUDED_DIMENSION_KEYS).toContain('score_near')

    for (const key of MATCHING_EXCLUDED_DIMENSION_KEYS) {
      const idx = VECTOR_DIMENSIONS.findIndex((d) => d.key === key)
      expect(sliced).not.toContain(idx + 1)
    }
  })

  it('full 22D cosine DOES change with ETA (documents the original leak)', () => {
    const driver = driverToVector(driverRow)
    const full22Near = cosineSimilarity(callToVector(callNearEta), driver)
    const full22Far = cosineSimilarity(callToVector(callFarEta), driver)
    expect(full22Near).not.toBeCloseTo(full22Far, 10)
  })

  it('matching cosine is INVARIANT to ETA (the fix)', () => {
    const driver = driverToVector(driverRow)
    const matchNear = cosineSimilarityForMatching(callToVector(callNearEta), driver)
    const matchFar = cosineSimilarityForMatching(callToVector(callFarEta), driver)
    expect(matchNear).toBe(matchFar)
  })
})

describe('calculateMatchingCandidate final score is ETA-independent', () => {
  const originCell = latLngToCell(37.5665, 126.978, 7)
  const destCell = latLngToCell(37.5172, 127.0473, 7)

  function makeCallcard(eta: number): MatchingCallcardModel {
    const input: CallVectorInput = { ...baseCall, eta_distance: eta }
    return {
      id: `call-${eta}`,
      etaDistance: eta,
      vector: callToVector(input),
      vectorAvailable: true,
      route: {
        pickup: { h3Res7: originCell },
        destination: { h3Res7: destCell },
      },
    } as unknown as MatchingCallcardModel
  }

  const driver: MatchingDriverModel = {
    id: 'driver-1',
    reliability: 0.9,
    prefOriginH3: [originCell],
    prefDestinationH3: [destCell],
    vector: driverToVector(driverRow),
    vectorAvailable: true,
  } as unknown as MatchingDriverModel

  it('changing only ETA does not change finalScore or similarityScore', () => {
    const a = calculateMatchingCandidate(makeCallcard(100), driver)
    const b = calculateMatchingCandidate(makeCallcard(580), driver)
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a!.similarityScore).toBe(b!.similarityScore)
    expect(a!.finalScore).toBe(b!.finalScore)
    // spatial term is H3-only and identical, so finalScore must be stable too
    expect(a!.spatial.spatialScore).toBe(b!.spatial.spatialScore)
  })

  it('finalScore still blends similarity (75%) and spatial (25%)', () => {
    const c = calculateMatchingCandidate(makeCallcard(100), driver)!
    const expected = c.similarityScore * 0.75 + (c.spatial.spatialScore ?? 0) * 0.25
    expect(c.finalScore).toBeCloseTo(expected, 6)
  })
})
