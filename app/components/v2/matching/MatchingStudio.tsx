'use client'

import type { MatchingStudioModel } from '@/lib/matching-studio-model'
import { CallBuilder } from './CallBuilder'
import { CandidateDock } from './CandidateDock'
import { EvidenceDrawer } from './EvidenceDrawer'
import { SpatialStage } from './SpatialStage'
import { StudioLegend } from './StudioLegend'
import { StudioStatus } from './StudioStatus'
import { useMatchingStudio } from './useMatchingStudio'
import styles from './matchingStudio.module.css'

export function MatchingStudio({ model }: { model: MatchingStudioModel }) {
  const state = useMatchingStudio(model)

  return (
    <div className={styles.workspace}>
      <StudioStatus model={model} candidateCount={state.rankedCandidates.length} />
      <div className={styles.mainGrid}>
        <CallBuilder
          callcards={model.callcards}
          selectedId={state.selectedCallcardId}
          selectedCallcard={state.selectedCallcard}
          onSelect={state.selectCallcard}
          onRun={state.runSimulation}
          isPending={state.isPending}
        />
        <div className={styles.centerPane}>
          <SpatialStage
            callcard={state.selectedCallcard}
            selectedCandidate={state.selectedCandidate}
            candidates={state.rankedCandidates}
          />
          <StudioLegend />
          {state.hasRun && !state.rankedCandidates.length ? (
            <div className={styles.softNotice}>비교 가능한 후보 기사가 없습니다. 벡터 또는 기사 선호 H3 데이터 상태를 확인하세요.</div>
          ) : null}
        </div>
        <CandidateDock
          candidates={state.rankedCandidates}
          selectedId={state.selectedCandidate?.driver.id ?? ''}
          onSelect={state.selectCandidate}
        />
      </div>
      <EvidenceDrawer
        open={state.showEvidence}
        onToggle={state.setShowEvidence}
        callcard={state.selectedCallcard}
        candidate={state.selectedCandidate}
        formula={model.formula}
      />
    </div>
  )
}
