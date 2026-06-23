import type { MatchingStudioModel, MatchingCallcardModel, MatchingCandidateModel } from '@/lib/matching-studio-model'
import { formatNumber } from './formatters'
import styles from './matchingStudio.module.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function callcardHeadline(callcard: MatchingCallcardModel | null): string {
  if (!callcard) return '콜카드 미선택'
  const parts: string[] = []
  if (callcard.aspId != null) parts.push(`ASP ${callcard.aspId}`)
  if (callcard.weekday != null && WEEKDAYS[callcard.weekday]) parts.push(`${WEEKDAYS[callcard.weekday]}요일`)
  if (callcard.hourSlot != null) parts.push(`${callcard.hourSlot}시`)
  return parts.length ? parts.join(' · ') : '콜카드'
}

function callcardSub(callcard: MatchingCallcardModel | null): string {
  if (!callcard) return '왼쪽에서 콜카드를 선택하세요'
  const origin = callcard.passengerAddress ?? '출발지 미상'
  const dest = callcard.destinationAddress ?? '도착지 미상'
  const kind = callcard.isPaid ? '유료호출' : '일반호출'
  return `${origin} → ${dest} · ${kind}`
}

function scoreText(value: number | null | undefined): string {
  return value == null ? '-' : `${Math.round(value)}`
}

export function StudioStatus({
  model,
  sliceCount,
  selectedCallcard,
  selectedCandidate,
}: {
  model: MatchingStudioModel
  sliceCount: number
  selectedCallcard: MatchingCallcardModel | null
  selectedCandidate: MatchingCandidateModel | null
}) {
  return (
    <section className={styles.kpiRow} aria-label="매칭 스튜디오 핵심 지표">
      <div className={styles.kpiChip} data-variant="wide">
        <span className={styles.kpiLabel}>선택 콜카드</span>
        <strong className={styles.kpiHeadline}>{callcardHeadline(selectedCallcard)}</strong>
        <small className={styles.kpiSub}>{callcardSub(selectedCallcard)}</small>
      </div>
      <div className={styles.kpiChip}>
        <span className={styles.kpiLabel}>후보 기사 수</span>
        <strong className={styles.kpiNumber}>{formatNumber(model.driverCount)}</strong>
        <small className={styles.kpiSub}>표본 {formatNumber(sliceCount)}건 · ASP 누적</small>
      </div>
      <div className={styles.kpiChip} data-accent="cyan">
        <span className={styles.kpiLabel}>1위 최종점수</span>
        <strong className={styles.kpiNumber} data-accent="cyan">{scoreText(selectedCandidate?.finalScore)}</strong>
        <small className={styles.kpiSub}>{selectedCandidate ? `기사 ${selectedCandidate.driver.id}` : '후보 없음'}</small>
      </div>
      <div className={styles.kpiChip} data-accent="violet">
        <span className={styles.kpiLabel}>성향 유사도</span>
        <strong className={styles.kpiNumber} data-accent="violet">{scoreText(selectedCandidate?.similarityScore)}</strong>
        <small className={styles.kpiSub}>22D 코사인 · 가중 75%</small>
      </div>
      <div className={styles.kpiChip} data-accent="green">
        <span className={styles.kpiLabel}>공간 적합도</span>
        <strong className={styles.kpiNumber} data-accent="green">{scoreText(selectedCandidate?.spatial.spatialScore)}</strong>
        <small className={styles.kpiSub}>H3 선호 · 가중 25%</small>
      </div>
    </section>
  )
}
