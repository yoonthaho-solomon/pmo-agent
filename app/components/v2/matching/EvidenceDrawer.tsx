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
        <b>{open ? '접기' : `추천근거 보기${candidate ? ` · 기사 ${candidate.driver.id}` : ''}`}</b>
      </button>
      {open ? (
        <div className={styles.drawerGrid}>
          <ScoreBreakdown candidate={candidate} formula={formula} />
          <VectorEvidence callcard={callcard} candidate={candidate} />
          <SpatialEvidence callcard={callcard} candidate={candidate} />
        </div>
      ) : null}
    </section>
  )
}
