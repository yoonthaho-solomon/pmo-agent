import type { MatchingCandidateModel, MatchingStudioModel } from '@/lib/matching-studio-model'
import { formatPercent, formatRatioPercent, formatScore } from './formatters'
import styles from './matchingStudio.module.css'

export function ScoreBreakdown({
  candidate,
  formula,
}: {
  candidate: MatchingCandidateModel | null
  formula: MatchingStudioModel['formula']
}) {
  return (
    <section className={styles.evidenceSection}>
      <h3>점수 구성</h3>
      <div className={styles.scoreGrid}>
        <div>
          <span>최종 추천점수</span>
          <strong>{formatScore(candidate?.finalScore)}</strong>
          <small>성향 {Math.round(formula.similarityWeight * 100)}% + 공간 {Math.round(formula.spatialWeight * 100)}%</small>
        </div>
        <div>
          <span>성향 유사도</span>
          <strong>{formatPercent(candidate?.similarityScore)}</strong>
          <small>기존 22D 코사인 유사도</small>
        </div>
        <div>
          <span>공간 적합도</span>
          <strong>{formatPercent(candidate?.spatial.spatialScore)}</strong>
          <small>출발 H3 {Math.round(formula.originSpatialWeight * 100)}% · 도착 H3 {Math.round(formula.destinationSpatialWeight * 100)}%</small>
        </div>
        <div>
          <span>데이터 신뢰도</span>
          <strong>{formatRatioPercent(candidate?.driver.reliability)}</strong>
          <small>{candidate?.driver.dataDays ?? '-'}일 누적 기사 패턴</small>
        </div>
      </div>
    </section>
  )
}
