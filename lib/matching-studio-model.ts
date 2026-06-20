import { calculateSpatialScore, calculateV2FinalScore, type SpatialScoreResult } from '@/lib/h3-match-score'
import { cosineSimilarity } from '@/lib/matching-vector'
import type { AdaptCallcardLocationResult } from '@/lib/callcard-location-adapter'
import type { VectorDimensionKey } from '@/lib/matching-vector'

export type MatchingStudioStatus = 'success' | 'empty' | 'partial' | 'error'

export type MatchingCallcardModel = {
  id: string
  aspId: number | null
  callDate: string | null
  hourSlot: number | null
  weekday: number | null
  expectedDistance: number | null
  expectedFare: number | null
  etaDistance: number | null
  isPaid: boolean
  isSurge: boolean
  statusGroup: string | null
  passengerAddress: string | null
  destinationAddress: string | null
  route: AdaptCallcardLocationResult['route']
  diagnostics: AdaptCallcardLocationResult['diagnostics']
  vector: number[]
  vectorAvailable: boolean
}

export type MatchingDriverModel = {
  id: string
  aspId: number | null
  dataDays: number | null
  reliability: number | null
  prefOriginH3: string[]
  prefDestinationH3: string[]
  vector: number[]
  vectorAvailable: boolean
  missingDimensions: VectorDimensionKey[]
}

export type MatchingCandidateModel = {
  driver: MatchingDriverModel
  finalScore: number
  similarityScore: number
  spatial: SpatialScoreResult
}

export type MatchingStudioModel = {
  status: MatchingStudioStatus
  message: string
  source: 'service_role' | 'anon' | 'none'
  callcards: MatchingCallcardModel[]
  drivers: MatchingDriverModel[]
  driverCount: number
  callcardCount: number
  limits: {
    callcards: number
    drivers: number
    topCandidates: number
  }
  formula: {
    similarityWeight: number
    spatialWeight: number
    originSpatialWeight: number
    destinationSpatialWeight: number
  }
}

export function calculateMatchingCandidate(callcard: MatchingCallcardModel, driver: MatchingDriverModel): MatchingCandidateModel | null {
  if (!callcard.vectorAvailable || !driver.vectorAvailable) return null

  const similarityScore = cosineSimilarity(callcard.vector, driver.vector) * 100
  const spatial = calculateSpatialScore({
    originH3: callcard.route.pickup.h3Res7,
    destinationH3: callcard.route.destination.h3Res7,
    preferredOriginH3Cells: driver.prefOriginH3,
    preferredDestinationH3Cells: driver.prefDestinationH3,
  })

  return {
    driver,
    similarityScore,
    spatial,
    finalScore: calculateV2FinalScore(similarityScore, spatial.spatialScore),
  }
}

export function rankMatchingCandidates(candidates: MatchingCandidateModel[]): MatchingCandidateModel[] {
  return [...candidates].sort((a, b) => (
    b.finalScore - a.finalScore ||
    b.similarityScore - a.similarityScore ||
    (b.driver.reliability ?? 0) - (a.driver.reliability ?? 0) ||
    a.driver.id.localeCompare(b.driver.id)
  ))
}
