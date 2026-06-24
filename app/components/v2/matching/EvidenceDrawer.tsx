'use client'

import type { MatchingCallcardModel, MatchingCandidateModel, MatchingStudioModel } from '@/lib/matching-studio-model'
import { ScoreBreakdown } from './ScoreBreakdown'
import { SpatialEvidence } from './SpatialEvidence'
import { VectorEvidence } from './VectorEvidence'
import styles from './matchingStudio.module.css'

export function EvidenceDrawer({
  callcard,
  candidate,
  formula,
}: {
  callcard: MatchingCallcardModel | null
  candidate: MatchingCandidateModel | null
  formula: MatchingStudioModel['formula']
}) {
  return (
    <section className={styles.evidenceDrawer} aria-label="추천 근거 요약">
      <div className={styles.drawerHead}>
        <p className={styles.eyebrow}>추천 근거</p>
        <span>{candidate ? `기사 ${candidate.driver.id}` : '후보 선택 필요'}</span>
      </div>
      <div className={styles.drawerGrid}>
        <ScoreBreakdown candidate={candidate} formula={formula} />
        <VectorEvidence callcard={callcard} candidate={candidate} />
        <SpatialEvidence callcard={callcard} candidate={candidate} />
      </div>
    </section>
  )
}
