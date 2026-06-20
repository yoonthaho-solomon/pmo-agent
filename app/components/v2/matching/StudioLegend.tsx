import styles from './matchingStudio.module.css'

export function StudioLegend() {
  return (
    <div className={styles.legend} aria-label="시각화 범례">
      <span><i data-tone="cyan" /> 콜카드 출발·도착</span>
      <span><i data-tone="green" /> 기사 선호 H3 후보</span>
      <span><i data-tone="amber" /> 분석 점수</span>
      <span><i data-tone="muted" /> 실제 위치 아님</span>
    </div>
  )
}
