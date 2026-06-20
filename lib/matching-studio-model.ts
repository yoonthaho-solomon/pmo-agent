import { calculateSpatialScore, calculateV2FinalScore, type SpatialScoreResult } from '@/lib/h3-match-score'
import { getH3GridDistance, normalizeH3Cell } from '@/lib/h3-dispatch'
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
  displayH3: {
    cell: string | null
    kind: 'origin_preference' | 'destination_preference' | 'none'
    lat: number | null
    lng: number | null
  }
}

export type MatchingStudioModel = {
  status: MatchingStudioStatus
  message: string
  source: 'service_role' | 'anon' | 'none'
  callcards: MatchingCallcardModel[]
  drivers: MatchingDriverModel[]
  candidatesByCallcard: Record<string, MatchingCandidateModel[]>
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

function bestPreferenceCell(targetH3: string | null, preferredCells: string[]): string | null {
  const target = normalizeH3Cell(targetH3)
  if (!target) return null

  let bestCell: string | null = null
  let bestDistance: number | null = null

  for (const cell of preferredCells) {
    const normalized = normalizeH3Cell(cell)
    if (!normalized) continue

    const distance = getH3GridDistance(target, normalized)
    if (distance == null) continue

    if (bestDistance == null || distance < bestDistance) {
      bestDistance = distance
      bestCell = normalized
    }
  }

  return bestCell
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
  const destinationCell = bestPreferenceCell(callcard.route.destination.h3Res7, driver.prefDestinationH3)
  const originCell = bestPreferenceCell(callcard.route.pickup.h3Res7, driver.prefOriginH3)

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
