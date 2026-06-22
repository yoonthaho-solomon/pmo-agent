import { calculateSpatialScore, calculateV2FinalScore, type SpatialScoreResult } from '@/lib/h3-match-score'
import { cosineSimilarityForMatching } from '@/lib/matching-vector'
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
  displayH3: {
    cell: string | null
    kind: 'origin_preference' | 'destination_preference' | 'none'
    lat: number | null
    lng: number | null
  }
}

export type MatchingFilterOptions = {
  asps: number[]
  dates: string[]
}

export type MatchingStudioModel = {
  status: MatchingStudioStatus
  message: string
  source: 'service_role' | 'anon' | 'none'
  callcards: MatchingCallcardModel[]
  drivers: MatchingDriverModel[]
  candidatesByCallcard: Record<string, MatchingCandidateModel[]>
  filterOptions: MatchingFilterOptions
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

export function calculateMatchingCandidate(
  callcard: MatchingCallcardModel,
  driver: MatchingDriverModel,
  prenormalizedPrefs?: { origin: string[]; destination: string[] },
): MatchingCandidateModel | null {
  if (!callcard.vectorAvailable || !driver.vectorAvailable) return null

  const similarityScore = cosineSimilarityForMatching(callcard.vector, driver.vector) * 100
  // Callcard h3Res7 values are already normalized lowercase res-7 cells (built by the
  // location adapter), so when the caller also supplies prenormalized driver cells we can
  // run the spatial scoring without re-validating every cell on each pair.
  const spatial = calculateSpatialScore({
    originH3: callcard.route.pickup.h3Res7,
    destinationH3: callcard.route.destination.h3Res7,
    preferredOriginH3Cells: prenormalizedPrefs?.origin ?? driver.prefOriginH3,
    preferredDestinationH3Cells: prenormalizedPrefs?.destination ?? driver.prefDestinationH3,
    prenormalized: prenormalizedPrefs != null,
  })
  const destinationCell = spatial.destinationBestCell
  const originCell = spatial.originBestCell

  return {
    driver,
    similarityScore,
    spatial,
    finalScore: calculateV2FinalScore(similarityScore, spatial.spatialScore),
    displayH3: {
      cell: destinationCell ?? originCell,
      kind: destinationCell ? 'destination_preference' : originCell ? 'origin_preference' : 'none',
      lat: null,
      lng: null,
    },
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
