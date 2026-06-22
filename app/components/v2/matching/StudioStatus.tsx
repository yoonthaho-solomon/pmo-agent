import type { MatchingStudioModel } from '@/lib/matching-studio-model'
import { formatNumber } from './formatters'
import styles from './matchingStudio.module.css'

export function StudioStatus({ model, sliceCount, candidateCount }: { model: MatchingStudioModel; sliceCount: number; candidateCount: number }) {
  return (
    <section className={styles.statusBar} aria-label="매칭 스튜디오 데이터 상태">
      <div>
        <span>콜카드 표본</span>
        <strong>{formatNumber(sliceCount)}</strong>
        <small>전체 {formatNumber(model.callcardCount)}건 중 (필터 슬라이스)</small>
      </div>
      <div>
        <span>계산 기사군</span>
        <strong>{formatNumber(model.driverCount)}</strong>
        <small>선택 콜카드 ASP 기준 전체 후보 계산</small>
      </div>
      <div>
        <span>추천 후보</span>
        <strong>{formatNumber(candidateCount)}</strong>
        <small>Top {model.limits.topCandidates} 우선발송 후보</small>
      </div>
      <div>
        <span>최종 점수</span>
        <strong>75:25</strong>
        <small>성향 유사도 + H3 공간 적합도</small>
      </div>
    </section>
  )
}
