import styles from './matchingStudio.module.css'

export function StudioLegend() {
  return (
    <div className={styles.legend} aria-label="시각화 범례">
      <span><i data-tone="cyan-dim" /> 기사 선호 출발 H3</span>
      <span><i data-tone="purple-dim" /> 기사 선호 도착 H3</span>
      <span><i data-tone="red" /> 출발·도착 마커</span>
    </div>
  )
}
