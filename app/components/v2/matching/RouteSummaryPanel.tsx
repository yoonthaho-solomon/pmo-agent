'use client'

import type { RouteApiState, RouteSummary } from '@/lib/google-maps/route-types'
import type { TaxiFareEstimate } from '@/lib/taxi-fare-estimator'
import { formatFare, formatMeter } from './formatters'
import styles from './matchingStudio.module.css'

function formatMinutes(seconds: number | null | undefined) {
  if (seconds == null) return '-'
  return `${Math.max(1, Math.round(seconds / 60))}분`
}

export function RouteSummaryPanel({
  state,
  route,
  fare,
  message,
  onRetry,
}: {
  state: RouteApiState
  route: RouteSummary | null
  fare: TaxiFareEstimate
  message: string | null
  onRetry: () => void
}) {
  return (
    <section className={styles.routeSummary} aria-label="승객 이동 경로 요약">
      <div>
        <span>승객 이동 경로</span>
        <strong>
          {route ? `${formatMeter(route.distanceMeters)} · ${formatMinutes(route.durationSeconds)}` : routeStatusLabel(state)}
        </strong>
      </div>
      <div>
        <span>요금</span>
        <strong>{fare.status === 'estimated' ? `예상 ${formatFare(fare.fare)}` : '요금 정책 미설정'}</strong>
      </div>
      <small>Google 교통 반영 · 기사 픽업 ETA 아님 · 매칭 점수 미반영</small>
      {state !== 'idle' && state !== 'loading' && state !== 'success' ? (
        <button type="button" onClick={onRetry}>{message ?? '경로 다시 계산'}</button>
      ) : null}
    </section>
  )
}

function routeStatusLabel(state: RouteApiState) {
  if (state === 'loading') return '경로 계산 중'
  if (state === 'idle') return '출발·도착 선택 필요'
  if (state === 'timeout') return '경로 시간 초과'
  if (state === 'quota_or_permission_error') return 'API 설정 확인 필요'
  if (state === 'no_route') return '경로 없음'
  return '경로 계산 불가'
}
