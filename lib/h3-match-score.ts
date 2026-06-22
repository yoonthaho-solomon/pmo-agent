import { getResolution, gridDistance } from 'h3-js'
import { getH3RingWeight, normalizeH3Cell } from './h3-dispatch'

export const V2_MATCH_WEIGHTS = {
  similarity: 0.75,
  spatial: 0.25,
  originWithinSpatial: 0.45,
  destinationWithinSpatial: 0.55,
} as const

export interface SpatialScoreResult {
  originScore: number | null
  destinationScore: number | null
  spatialScore: number | null
  originBestDistance: number | null
  destinationBestDistance: number | null
  originBestCell: string | null
  destinationBestCell: string | null
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value))
}

// When `prenormalized` is true the caller guarantees that `targetH3` and every
// entry in `preferredH3Cells` are already lowercase, valid H3 indexes. This lets
// the hot matching path (one callcard × thousands of drivers) skip the costly
// per-pair `normalizeH3Cell` / `isValidCell` work and resolve the resolution once.
function bestH3Preference(
  targetH3: string | null,
  preferredH3Cells: string[] | null | undefined,
  prenormalized: boolean,
): { score: number | null; distance: number | null; cell: string | null } {
  const target = prenormalized ? targetH3 : normalizeH3Cell(targetH3)
  if (!target || !preferredH3Cells?.length) return { score: null, distance: null, cell: null }

  const targetResolution = getResolution(target)
  let bestScore: number | null = null
  let bestDistance: number | null = null
  let bestCell: string | null = null

  for (const cell of preferredH3Cells) {
    const preferred = prenormalized ? cell : normalizeH3Cell(cell)
    if (!preferred) continue

    let distance: number | null
    if (preferred === target) {
      distance = 0
    } else {
      if (getResolution(preferred) !== targetResolution) continue
      try {
        distance = gridDistance(target, preferred)
      } catch {
        continue
      }
    }
    if (distance == null) continue

    const score = getH3RingWeight(distance) * 100
    if (bestScore == null || score > bestScore || (score === bestScore && distance < (bestDistance ?? Infinity))) {
      bestScore = score
      bestDistance = distance
      bestCell = preferred
    }
  }

  return { score: bestScore, distance: bestDistance, cell: bestCell }
}

export function scoreH3Preference(
  targetH3: string | null,
  preferredH3Cells: string[] | null | undefined,
): number | null {
  return bestH3Preference(targetH3, preferredH3Cells, false).score
}

export function calculateSpatialScore(options: {
  originH3: string | null
  destinationH3: string | null
  preferredOriginH3Cells: string[] | null | undefined
  preferredDestinationH3Cells: string[] | null | undefined
  prenormalized?: boolean
}): SpatialScoreResult {
  const prenormalized = options.prenormalized ?? false
  const origin = bestH3Preference(options.originH3, options.preferredOriginH3Cells, prenormalized)
  const destination = bestH3Preference(options.destinationH3, options.preferredDestinationH3Cells, prenormalized)

  let spatialScore: number | null = null
  if (origin.score != null && destination.score != null) {
    spatialScore = clampScore(
      origin.score * V2_MATCH_WEIGHTS.originWithinSpatial +
      destination.score * V2_MATCH_WEIGHTS.destinationWithinSpatial,
    )
  } else if (origin.score != null) {
    spatialScore = clampScore(origin.score)
  } else if (destination.score != null) {
    spatialScore = clampScore(destination.score)
  }

  return {
    originScore: origin.score,
    destinationScore: destination.score,
    spatialScore,
    originBestDistance: origin.distance,
    destinationBestDistance: destination.distance,
    originBestCell: origin.cell,
    destinationBestCell: destination.cell,
  }
}

export function calculateV2FinalScore(similarityScore: number, spatialScore: number | null): number {
  const similarity = clampScore(similarityScore)
  if (spatialScore == null) return similarity

  return clampScore(
    similarity * V2_MATCH_WEIGHTS.similarity +
    clampScore(spatialScore) * V2_MATCH_WEIGHTS.spatial,
  )
}
