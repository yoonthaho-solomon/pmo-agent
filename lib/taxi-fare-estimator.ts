import type { RouteSummary } from './google-maps/route-types'

export type TaxiFarePolicy = {
  regionCode: string
  regionName: string
  effectiveFrom: string
  baseFare: number
  baseDistanceMeters: number
  distanceUnitMeters: number
  distanceUnitFare: number
  timeUnitSeconds?: number
  timeUnitFare?: number
  lateNightRules?: unknown
  sourceNote: string
}

export type TaxiFareEstimate =
  | {
      status: 'estimated'
      fare: number
      policy: TaxiFarePolicy
      excluded: string[]
    }
  | {
      status: 'policy_missing'
      fare: null
      regionCode: string | null
      message: string
    }

export function estimateTaxiFare(
  route: Pick<RouteSummary, 'distanceMeters' | 'durationSeconds'> | null,
  regionCode: string | number | null | undefined,
  policies: TaxiFarePolicy[] = [],
): TaxiFareEstimate {
  const normalizedRegion = regionCode == null ? null : String(regionCode)
  const policy = normalizedRegion ? policies.find((item) => item.regionCode === normalizedRegion) : null

  if (!route || !policy) {
    return {
      status: 'policy_missing',
      fare: null,
      regionCode: normalizedRegion,
      message: '요금 정책 미설정',
    }
  }

  const extraDistance = Math.max(0, route.distanceMeters - policy.baseDistanceMeters)
  const distanceUnits = policy.distanceUnitMeters > 0 ? Math.ceil(extraDistance / policy.distanceUnitMeters) : 0
  const timeUnits = policy.timeUnitSeconds && policy.timeUnitFare
    ? Math.ceil(Math.max(0, route.durationSeconds) / policy.timeUnitSeconds)
    : 0

  return {
    status: 'estimated',
    fare: policy.baseFare + distanceUnits * policy.distanceUnitFare + timeUnits * (policy.timeUnitFare ?? 0),
    policy,
    excluded: ['통행료', '심야·시계외 할증', '정체 병산 세부 규칙'],
  }
}

export const VERIFIED_TAXI_FARE_POLICIES: TaxiFarePolicy[] = []

