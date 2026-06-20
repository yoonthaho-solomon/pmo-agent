'use client'

import type { ScenarioPointInput } from '@/lib/adapters/matching'
import type { MatchingCallcardModel, MatchingCandidateModel } from '@/lib/matching-studio-model'
import { estimateTaxiFare, VERIFIED_TAXI_FARE_POLICIES } from '@/lib/taxi-fare-estimator'
import { RouteSummaryPanel } from './RouteSummaryPanel'
import { SpatialStage } from './SpatialStage'
import { useGoogleMap } from './useGoogleMap'
import { useRouteSummary } from './useRouteSummary'
import styles from './matchingStudio.module.css'

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
}: {
  callcard: MatchingCallcardModel | null
  selectedCandidate: MatchingCandidateModel | null
  candidates: MatchingCandidateModel[]
  scenarioOrigin: ScenarioPointInput | null
  scenarioDestination: ScenarioPointInput | null
  scenarioMode: boolean
}) {
  const origin = scenarioOrigin ?? (callcard ? pointFromCallcard(callcard.route.pickup, callcard.passengerAddress) : null)
  const destination = scenarioDestination ?? (callcard ? pointFromCallcard(callcard.route.destination, callcard.destinationAddress) : null)
  const routeState = useRouteSummary(origin, destination)
  const { containerRef, state: mapLoadState } = useGoogleMap({ callcard, candidate: selectedCandidate, route: routeState.route })
  const fare = estimateTaxiFare(routeState.route, callcard?.aspId, VERIFIED_TAXI_FARE_POLICIES)

  if (mapLoadState === 'missing_config' || mapLoadState === 'load_error' || mapLoadState === 'unsupported_webgl') {
    return (
      <div className={styles.googleFallback}>
        <SpatialStage callcard={callcard} selectedCandidate={selectedCandidate} candidates={candidates} />
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
      <div className={styles.stageHeader}>
        <div>
          <p className={styles.eyebrow}>GOOGLE SPATIAL MATCHING</p>
          <h1>출발·도착 경로와 기사 선호 H3를 함께 봅니다</h1>
          <p>{scenarioMode ? '시나리오 매칭: 선택 콜카드의 22D 성향 벡터는 유지하고, 출발지·도착지 H3만 바꿔 분석합니다.' : '원본 콜카드 매칭: 저장된 콜카드 벡터와 공간정보를 사용해 분석합니다.'}</p>
        </div>
      </div>

      <div className={styles.winnerSummary}>
        <div>
          <span>최고 후보</span>
          <strong>{selectedCandidate?.driver.id ?? '후보 없음'}</strong>
        </div>
        <div>
          <span>최종 추천점수</span>
          <strong>{selectedCandidate ? `${Math.round(selectedCandidate.finalScore)}점` : '-'}</strong>
        </div>
        <div>
          <span>계산 기준</span>
          <strong>성향 75 + H3 25</strong>
        </div>
      </div>

      <RouteSummaryPanel
        state={routeState.state}
        route={routeState.route}
        fare={fare}
        message={routeState.message}
        onRetry={routeState.retry}
      />

      <div className={styles.h3Meaning}>
        기사 선호 H3 권역은 누적 운행 선호를 공간화한 분석이며 기사 현재 위치가 아닙니다.
      </div>
    </section>
  )
}
