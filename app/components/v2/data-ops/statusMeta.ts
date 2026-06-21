import type { IngestionStatus } from '@/lib/adapters/ingestion'

export const STATUS_META: Record<IngestionStatus, { label: string; color: string }> = {
  healthy: { label: '검증 완료', color: 'var(--km-v2-green)' },
  data_present: { label: '적재 확인', color: 'var(--km-v2-green)' },
  partial: { label: '부분 확인', color: 'var(--km-v2-amber)' },
  missing: { label: '누락', color: 'var(--km-v2-red)' },
  error: { label: '오류', color: 'var(--km-v2-red)' },
  delayed: { label: '지연 기준 미설정', color: 'var(--km-v2-blue)' },
  pending: { label: '확인 불가', color: 'rgba(145, 183, 207, 0.72)' },
  unsupported: { label: '날짜 상세 미지원', color: 'rgba(145, 183, 207, 0.46)' },
}

export function statusLabel(status: IngestionStatus) {
  return STATUS_META[status].label
}
