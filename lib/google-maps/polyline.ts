export type DecodedPolylinePoint = {
  lat: number
  lng: number
}

export function decodeEncodedPolyline(encoded: string | null | undefined): DecodedPolylinePoint[] {
  if (!encoded) return []

  const points: DecodedPolylinePoint[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    const latResult = decodeChunk(encoded, index)
    if (!latResult) return []
    index = latResult.nextIndex
    lat += latResult.delta

    const lngResult = decodeChunk(encoded, index)
    if (!lngResult) return []
    index = lngResult.nextIndex
    lng += lngResult.delta

    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }

  return points
}

function decodeChunk(encoded: string, startIndex: number): { delta: number; nextIndex: number } | null {
  let result = 0
  let shift = 0
  let index = startIndex
  let byte = 0

  do {
    if (index >= encoded.length) return null
    byte = encoded.charCodeAt(index++) - 63
    result |= (byte & 0x1f) << shift
    shift += 5
  } while (byte >= 0x20)

  return {
    delta: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  }
}

