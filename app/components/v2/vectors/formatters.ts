export function numberValue(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '-'
  return value.toFixed(digits)
}

export function percentValue(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${(value * 100).toFixed(digits)}%`
}

export function compactNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '-'
  return Intl.NumberFormat('en', { notation: value >= 100000 ? 'compact' : 'standard' }).format(value)
}

export function entityTypeLabel(type: 'driver' | 'callcard') {
  return type === 'driver' ? '기사 벡터' : '콜카드 벡터'
}
