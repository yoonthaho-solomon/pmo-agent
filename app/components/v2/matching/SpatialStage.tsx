import type { MatchingCallcardModel, MatchingCandidateModel } from '@/lib/matching-studio-model'
import { compactH3, formatCoordinate, formatPercent, formatScore } from './formatters'
import styles from './matchingStudio.module.css'

function pointPosition(callcard: MatchingCallcardModel, type: 'pickup' | 'destination') {
  const pickup = callcard.route.pickup
  const destination = callcard.route.destination
  const lat = type === 'pickup' ? pickup.lat : destination.lat
  const lng = type === 'pickup' ? pickup.lng : destination.lng
  if (lat == null || lng == null || pickup.lat == null || pickup.lng == null || destination.lat == null || destination.lng == null) {
    return type === 'pickup' ? { x: 32, y: 58 } : { x: 68, y: 38 }
  }
  const minLat = Math.min(pickup.lat, destination.lat)
  const maxLat = Math.max(pickup.lat, destination.lat)
  const minLng = Math.min(pickup.lng, destination.lng)
  const maxLng = Math.max(pickup.lng, destination.lng)
  const latSpan = Math.max(0.01, maxLat - minLat)
  const lngSpan = Math.max(0.01, maxLng - minLng)
  return {
    x: 18 + ((lng - minLng) / lngSpan) * 64,
    y: 78 - ((lat - minLat) / latSpan) * 56,
  }
}

export function SpatialStage({
  callcard,
  selectedCandidate,
  candidates,
}: {
  callcard: MatchingCallcardModel | null
  selectedCandidate: MatchingCandidateModel | null
  candidates: MatchingCandidateModel[]
}) {
  if (!callcard) {
    return (
      <section className={styles.stage}>
        <div className={styles.emptyStage}>콜카드를 선택하면 출발·도착 H3 기반 후보 분석이 표시됩니다.</div>
      </section>
    )
  }

  const pickup = pointPosition(callcard, 'pickup')
  const destination = pointPosition(callcard, 'destination')
  const line = {
    x1: `${pickup.x}%`,
    y1: `${pickup.y}%`,
    x2: `${destination.x}%`,
    y2: `${destination.y}%`,
  }

  return (
    <section className={styles.stage} aria-label="공간 매칭 스테이지">
      <div className={styles.stageHeader}>
        <div>
          <p className={styles.eyebrow}>SPATIAL MATCHING STUDIO</p>
          <h1>콜카드 위치와 기사 선호권역을 겹쳐 봅니다</h1>
          <p>기사 현재 위치가 아니라, 실제 콜카드 H3와 기사 누적 선호 H3를 비교하는 분석 화면입니다.</p>
        </div>
        <div className={styles.bestScore}>
          <span>BEST FINAL</span>
          <strong>{formatPercent(selectedCandidate?.finalScore)}</strong>
          <small>{selectedCandidate?.driver.id ?? '후보 없음'}</small>
        </div>
      </div>

      <div className={styles.mapCanvas}>
        <svg className={styles.routeSvg} viewBox="0 0 100 100" role="img" aria-label="콜카드 출발지와 도착지 연결선">
          <line {...line} className={styles.routeLineShadow} />
          <line {...line} className={styles.routeLine} />
        </svg>
        <div className={styles.gridGlow} />
        <div className={`${styles.locationNode} ${styles.pickupNode}`} style={{ left: `${pickup.x}%`, top: `${pickup.y}%` }}>
          <b>출발</b>
          <span>{compactH3(callcard.route.pickup.h3Res7)}</span>
        </div>
        <div className={`${styles.locationNode} ${styles.destinationNode}`} style={{ left: `${destination.x}%`, top: `${destination.y}%` }}>
          <b>도착</b>
          <span>{compactH3(callcard.route.destination.h3Res7)}</span>
        </div>
        {candidates.slice(0, 6).map((candidate, index) => (
          <div
            className={styles.preferenceNode}
            data-active={candidate.driver.id === selectedCandidate?.driver.id}
            key={candidate.driver.id}
            style={{
              left: `${22 + ((index * 13) % 55)}%`,
              top: `${24 + ((index * 19) % 46)}%`,
            }}
          >
            <span>#{index + 1}</span>
            <b>{formatScore(candidate.finalScore)}</b>
          </div>
        ))}
      </div>

      <div className={styles.stageFooter}>
        <span>출발 좌표 <b>{formatCoordinate(callcard.route.pickup.lat, callcard.route.pickup.lng)}</b></span>
        <span>도착 좌표 <b>{formatCoordinate(callcard.route.destination.lat, callcard.route.destination.lng)}</b></span>
        <span>OD <b>{callcard.route.originDestinationKey ? '생성됨' : '정보 없음'}</b></span>
      </div>
    </section>
  )
}
