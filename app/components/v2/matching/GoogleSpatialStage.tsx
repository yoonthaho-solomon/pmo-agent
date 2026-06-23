'use client'

import type { ScenarioPointInput } from '@/lib/adapters/matching'
import type { RouteApiState } from '@/lib/google-maps/route-types'
import type { MatchingCallcardModel, MatchingCandidateModel } from '@/lib/matching-studio-model'
import { estimateTaxiFare, VERIFIED_TAXI_FARE_POLICIES } from '@/lib/taxi-fare-estimator'
import type { InputMode, ScenarioStatus } from './useMatchingStudio'
import { SpatialStage } from './SpatialStage'
import { StudioLegend } from './StudioLegend'
import { useGoogleMap } from './useGoogleMap'
import { useRouteSummary } from './useRouteSummary'
import { formatFare, formatMeter } from './formatters'
import styles from './matchingStudio.module.css'

function formatMinutes(seconds: number | null | undefined) {
  if (seconds == null) return '-'
  return `${Math.max(1, Math.round(seconds / 60))}분`
}

function routeStateLabel(state: RouteApiState) {
  if (state === 'loading') return '경로 계산 중'
  if (state === 'idle') return '출발·도착 선택 필요'
  if (state === 'timeout') return '경로 시간 초과'
  if (state === 'quota_or_permission_error') return 'API 설정 확인 필요'
  if (state === 'no_route') return '경로 없음'
  return '경로 계산 불가'
}

function pointFromCallcard(location: MatchingCallcardModel['route']['pickup'], label: string | null): ScenarioPointInput | null {
  if (location.lat == null || location.lng == null) return null
  return {
    lat: location.lat,
    lng: location.lng,
    label: label ?? '콜카드 위치',
  }
}


export function GoogleSpatialStage({
  callcard,
  selectedCandidate,
  candidates,
  scenarioOrigin,
  scenarioDestination,
  scenarioMode,
  scenarioStatus,
  inputMode,
}: {
  callcard: MatchingCallcardModel | null
  selectedCandidate: MatchingCandidateModel | null
  candidates: MatchingCandidateModel[]
  scenarioOrigin: ScenarioPointInput | null
  scenarioDestination: ScenarioPointInput | null
  scenarioMode: boolean
  scenarioStatus: ScenarioStatus
  inputMode: InputMode
}) {
  const originalOrigin = callcard ? pointFromCallcard(callcard.route.pickup, callcard.passengerAddress) : null
  const originalDestination = callcard ? pointFromCallcard(callcard.route.destination, callcard.destinationAddress) : null
  // Each mode owns a single origin/destination source. Crucially, scenario mode does NOT fall
  // back to the callcard points — so clearing/editing a field mid-type leaves the map where it is
  // instead of snapping back to the callcard (which caused the jump-on-delete behavior).
  const effectiveOrigin = inputMode === 'scenario' ? scenarioOrigin : originalOrigin
  const effectiveDestination = inputMode === 'scenario' ? scenarioDestination : originalDestination
  // Map always recenters on a focus point, falling back to the callcard pickup even in scenario
  // mode (before points are picked) so changing ASP/region still pans the map to that area.
  const focusPoint = effectiveOrigin ?? originalOrigin
  const routeState = useRouteSummary(effectiveOrigin, effectiveDestination)
  const showCandidate = scenarioStatus !== 'dirty' && scenarioStatus !== 'calculating' && scenarioStatus !== 'error'
  const { containerRef, state: mapLoadState } = useGoogleMap({
    effectiveOrigin,
    effectiveDestination,
    focusPoint,
    candidate: showCandidate ? selectedCandidate : null,
    route: routeState.route,
  })
  const fare = estimateTaxiFare(routeState.route, callcard?.aspId, VERIFIED_TAXI_FARE_POLICIES)

  if (mapLoadState === 'missing_config' || mapLoadState === 'load_error' || mapLoadState === 'unsupported_webgl') {
    return (
      <div className={styles.googleFallback}>
        <SpatialStage callcard={callcard} selectedCandidate={showCandidate ? selectedCandidate : null} candidates={showCandidate ? candidates : []} />
        <div className={styles.mapConfigNotice}>
          <b>{mapLoadState === 'missing_config' ? 'Google 지도 설정 필요' : 'Google 지도 fallback'}</b>
          <span>지도 설정이 없거나 로드할 수 없어 Phase 4 공간 캔버스를 표시합니다. Top 10과 Evidence는 계속 사용할 수 있습니다.</span>
        </div>
      </div>
    )
  }

  return (
    <section className={styles.stage} aria-label="Google 지도 기반 공간 매칭 스튜디오">
      <div ref={containerRef} className={styles.googleMapCanvas} />
      <StudioLegend />
      <div className={styles.mapTopBar}>
        <div>
          <span>최고 후보</span>
          <strong>{selectedCandidate?.driver.id ?? '후보 없음'}</strong>
        </div>
        <div>
          <span>추천점수</span>
          <strong>{selectedCandidate ? `${Math.round(selectedCandidate.finalScore)}점` : '-'}</strong>
        </div>
        <div>
          <span>계산 기준</span>
          <strong>성향 75 · H3 25</strong>
        </div>
        <div>
          <span>승객 이동 경로</span>
          <strong>
            {routeState.route
              ? `${formatMeter(routeState.route.distanceMeters)} · ${formatMinutes(routeState.route.durationSeconds)}`
              : routeStateLabel(routeState.state)}
          </strong>
        </div>
        <div>
          <span>예상 요금</span>
          <strong>{fare.status === 'estimated' ? formatFare(fare.fare) : '정책 미설정'}</strong>
        </div>
      </div>
    </section>
  )
}
