import type { MatchingStudioModel } from '@/lib/matching-studio-model'
import { formatNumber } from './formatters'
import styles from './matchingStudio.module.css'

export function StudioStatus({ model, candidateCount }: { model: MatchingStudioModel; candidateCount: number }) {
  return (
    <section className={styles.statusBar} aria-label="매칭 스튜디오 데이터 상태">
      <div>
        <span>콜카드 표본</span>
        <strong>{formatNumber(model.callcards.length)}</strong>
        <small>최대 {formatNumber(model.limits.callcards)}건</small>
      </div>
      <div>
        <span>기사 벡터 표본</span>
        <strong>{formatNumber(model.drivers.length)}</strong>
        <small>전체 {formatNumber(model.driverCount)}명 중 제한 조회</small>
      </div>
      <div>
        <span>추천 후보</span>
        <strong>{formatNumber(candidateCount)}</strong>
        <small>Top {model.limits.topCandidates} 분석 후보</small>
      </div>
      <div>
        <span>점수 산식</span>
        <strong>75:25</strong>
        <small>성향 유사도 + H3 공간 적합도</small>
      </div>
    </section>
  )
}
