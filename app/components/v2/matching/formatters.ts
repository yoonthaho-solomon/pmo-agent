export function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${Math.round(value)}`
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${value.toFixed(digits)}%`
}

export function formatRatioPercent(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return value.toLocaleString('ko-KR')
}

export function formatMeter(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-'
  if (value >= 1000) return `${(value / 1000).toFixed(1)}km`
  return `${Math.round(value)}m`
}

export function formatFare(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

export function formatCoordinate(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return '좌표 없음'
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function compactH3(cell: string | null | undefined): string {
  if (!cell) return 'H3 없음'
  if (cell.length <= 12) return cell
  return `${cell.slice(0, 8)}...${cell.slice(-5)}`
}
