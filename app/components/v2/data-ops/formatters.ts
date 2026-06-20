export function numberLabel(value: number | null | undefined) {
  return value == null ? '-' : value.toLocaleString('ko-KR')
}
