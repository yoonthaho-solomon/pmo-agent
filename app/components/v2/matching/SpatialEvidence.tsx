import type { MatchingCallcardModel, MatchingCandidateModel } from '@/lib/matching-studio-model'
import { compactH3, formatPercent } from './formatters'
import styles from './matchingStudio.module.css'

function distanceLabel(distance: number | null | undefined): string {
  if (distance == null) return '거리 계산 불가'
  if (distance === 0) return '동일 H3'
  return `${distance}-ring`
}

export function SpatialEvidence({
  callcard,
  candidate,
}: {
  callcard: MatchingCallcardModel | null
  candidate: MatchingCandidateModel | null
}) {
  return (
    <section className={styles.evidenceSection}>
      <h3>공간 H3 근거</h3>
      <div className={styles.spatialEvidence}>
        <div>
          <span>출발지 적합도</span>
          <strong>{formatPercent(candidate?.spatial.originScore)}</strong>
          <small>{distanceLabel(candidate?.spatial.originBestDistance)}</small>
          <em>콜 {compactH3(callcard?.route.pickup.h3Res7)}</em>
        </div>
        <div>
          <span>목적지 적합도</span>
          <strong>{formatPercent(candidate?.spatial.destinationScore)}</strong>
          <small>{distanceLabel(candidate?.spatial.destinationBestDistance)}</small>
          <em>콜 {compactH3(callcard?.route.destination.h3Res7)}</em>
        </div>
      </div>
      <p className={styles.evidenceNote}>
        공간 점수는 기사 현재 위치가 아니라 기사 누적 선호 출발·도착 H3와 이번 콜카드 H3의 인접도를 비교합니다.
      </p>
    </section>
  )
}
