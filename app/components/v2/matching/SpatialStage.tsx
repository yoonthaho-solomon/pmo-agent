import type { MatchingCallcardModel, MatchingCandidateModel } from '@/lib/matching-studio-model'
import { compactH3, formatCoordinate, formatScore } from './formatters'
import styles from './matchingStudio.module.css'

type Point = { x: number; y: number }

function boundsFor(callcard: MatchingCallcardModel, candidates: MatchingCandidateModel[]) {
  const points = [
    callcard.route.pickup.lat != null && callcard.route.pickup.lng != null
      ? { lat: callcard.route.pickup.lat, lng: callcard.route.pickup.lng }
      : null,
    callcard.route.destination.lat != null && callcard.route.destination.lng != null
      ? { lat: callcard.route.destination.lat, lng: callcard.route.destination.lng }
      : null,
    ...candidates
      .map((candidate) => candidate.displayH3.lat != null && candidate.displayH3.lng != null
        ? { lat: candidate.displayH3.lat, lng: candidate.displayH3.lng }
        : null),
  ].filter((point): point is { lat: number; lng: number } => point != null)

  if (!points.length) {
    return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 }
  }

  return {
    minLat: Math.min(...points.map((point) => point.lat)),
    maxLat: Math.max(...points.map((point) => point.lat)),
    minLng: Math.min(...points.map((point) => point.lng)),
    maxLng: Math.max(...points.map((point) => point.lng)),
  }
}

function pointPosition(lat: number | null | undefined, lng: number | null | undefined, bounds: ReturnType<typeof boundsFor>, fallback: Point): Point {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return fallback

  const latSpan = Math.max(0.01, bounds.maxLat - bounds.minLat)
  const lngSpan = Math.max(0.01, bounds.maxLng - bounds.minLng)
  return {
    x: 14 + ((lng - bounds.minLng) / lngSpan) * 72,
    y: 82 - ((lat - bounds.minLat) / latSpan) * 64,
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

  const mappedCandidates = candidates.filter((candidate) => candidate.displayH3.lat != null && candidate.displayH3.lng != null).slice(0, 6)
  const bounds = boundsFor(callcard, mappedCandidates)
  const pickup = pointPosition(callcard.route.pickup.lat, callcard.route.pickup.lng, bounds, { x: 30, y: 62 })
  const destination = pointPosition(callcard.route.destination.lat, callcard.route.destination.lng, bounds, { x: 70, y: 38 })
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
          <h1>콜카드 위치와 기사 선호 H3를 겹쳐 봅니다</h1>
          <p>기사 현재 위치가 아니라 실제 콜카드 H3와 기사 누적 선호 H3 중심을 비교하는 분석 화면입니다.</p>
        </div>
      </div>

      <div className={styles.winnerSummary}>
        <div>
          <span>최고 후보</span>
          <strong>{selectedCandidate?.driver.id ?? '후보 없음'}</strong>
        </div>
        <div>
          <span>최종 추천점수</span>
          <strong>{formatScore(selectedCandidate?.finalScore)}</strong>
        </div>
        <div>
          <span>공간 기준</span>
          <strong>H3 선호권역</strong>
        </div>
      </div>

      <div className={styles.mapCanvas}>
        <svg className={styles.routeSvg} viewBox="0 0 100 100" role="img" aria-label="콜카드 출발지와 도착지 연결선">
          <line {...line} className={styles.routeLineShadow} />
          <line {...line} className={styles.routeLine} />
        </svg>
        <div className={`${styles.locationNode} ${styles.pickupNode}`} style={{ left: `${pickup.x}%`, top: `${pickup.y}%` }}>
          <b>출발</b>
          <span>{compactH3(callcard.route.pickup.h3Res7)}</span>
        </div>
        <div className={`${styles.locationNode} ${styles.destinationNode}`} style={{ left: `${destination.x}%`, top: `${destination.y}%` }}>
          <b>도착</b>
          <span>{compactH3(callcard.route.destination.h3Res7)}</span>
        </div>
        {mappedCandidates.map((candidate, index) => {
          const position = pointPosition(candidate.displayH3.lat, candidate.displayH3.lng, bounds, { x: 50, y: 50 })
          return (
            <div
              className={styles.preferenceNode}
              data-active={candidate.driver.id === selectedCandidate?.driver.id}
              key={candidate.driver.id}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
              <span>#{index + 1}</span>
              <b>{formatScore(candidate.finalScore)}</b>
              <em>선호 H3 중심</em>
            </div>
          )
        })}
      </div>

      <div className={styles.stageFooter}>
        <span>출발 좌표 <b>{formatCoordinate(callcard.route.pickup.lat, callcard.route.pickup.lng)}</b></span>
        <span>도착 좌표 <b>{formatCoordinate(callcard.route.destination.lat, callcard.route.destination.lng)}</b></span>
        <span>기사 노드 <b>선호 H3 중심 · 실시간 위치 아님</b></span>
      </div>
    </section>
  )
}
