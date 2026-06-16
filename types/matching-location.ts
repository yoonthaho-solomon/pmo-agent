export interface MatchingLocation {
  lat: number | null
  lng: number | null
  h3Res7: string | null
  h3Res8?: string | null
  sido?: string | null
  sigungu?: string | null
  eupmyeondong?: string | null
  roadAddress?: string | null
  landmark?: string | null
}

export interface MatchingRouteLocation {
  pickup: MatchingLocation
  destination: MatchingLocation
  originDestinationKey: string | null
}
