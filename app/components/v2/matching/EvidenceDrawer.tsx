'use client'

import type { MatchingCallcardModel, MatchingCandidateModel, MatchingStudioModel } from '@/lib/matching-studio-model'
import { ScoreBreakdown } from './ScoreBreakdown'
import { SpatialEvidence } from './SpatialEvidence'
import { VectorEvidence } from './VectorEvidence'
import styles from './matchingStudio.module.css'

export function EvidenceDrawer({
  open,
  onToggle,
  callcard,
  candidate,
  formula,
}: {
  open: boolean
  onToggle: (next: boolean) => void
  callcard: MatchingCallcardModel | null
  candidate: MatchingCandidateModel | null
  formula: MatchingStudioModel['formula']
}) {
  return (
    <section className={styles.evidenceDrawer} data-open={open} aria-label="추천 근거 패널">
      <button
        className={styles.drawerToggle}
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        <b>{open ? '접기' : '추천근거 보기'}</b>
      </button>
      {open ? (
        <div className={styles.drawerGrid}>
          <ScoreBreakdown candidate={candidate} formula={formula} />
          <VectorEvidence callcard={callcard} candidate={candidate} />
          <SpatialEvidence callcard={callcard} candidate={candidate} />
          <section className={styles.evidenceSection}>
            <h3>데이터 주의</h3>
            <ul className={styles.qualityList}>
              <li>실시간 기사 위치는 연결되어 있지 않습니다.</li>
              <li>ETA와 픽업거리는 운영 검증 전 비교값으로만 표시합니다.</li>
              <li>공간 데이터가 부족하면 성향 유사도 중심으로 후보를 유지합니다.</li>
              <li>Top 10은 확정 배차가 아니라 우선 검토 후보입니다.</li>
            </ul>
          </section>
        </div>
      ) : null}
    </section>
  )
}
