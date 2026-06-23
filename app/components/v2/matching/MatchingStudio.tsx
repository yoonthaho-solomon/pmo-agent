'use client'

import type { MatchingStudioModel } from '@/lib/matching-studio-model'
import { CallBuilder } from './CallBuilder'
import { CandidateDock } from './CandidateDock'
import { EvidenceDrawer } from './EvidenceDrawer'
import { GoogleSpatialStage } from './GoogleSpatialStage'
import { StudioStatus } from './StudioStatus'
import { useGoogleMapsApi } from './useGoogleMapsApi'
import { useMatchingStudio } from './useMatchingStudio'
import styles from './matchingStudio.module.css'

export function MatchingStudio({ model }: { model: MatchingStudioModel }) {
  const state = useMatchingStudio(model)
  const google = useGoogleMapsApi()
  const canShowEvidence = state.scenarioStatus === 'original' || state.scenarioStatus === 'ready'

  return (
    <div className={styles.workspace}>
      <StudioStatus model={model} sliceCount={state.callcards.length} candidateCount={state.rankedCandidates.length} />
      <div className={styles.mainGrid}>
        <CallBuilder
          google={google.google}
          callcards={state.callcards}
          selectedId={state.selectedCallcardId}
          selectedCallcard={state.selectedCallcard}
          asps={state.filterOptions.asps}
          dates={state.filterOptions.dates}
          hours={state.filterOptions.hours}
          statuses={state.filterOptions.statuses}
          selectedAsp={state.aspFilter}
          selectedDate={state.dateFilter}
          selectedHour={state.hourFilter}
          selectedStatus={state.statusFilter}
          sliceLoading={state.sliceLoading}
          onAspChange={state.setAspFilter}
          onDateChange={state.setDateFilter}
          onHourChange={state.setHourFilter}
          onStatusChange={state.setStatusFilter}
          scenarioOrigin={state.scenarioOrigin}
          scenarioDestination={state.scenarioDestination}
          scenarioOriginText={state.scenarioOriginText}
          scenarioDestinationText={state.scenarioDestinationText}
          scenarioStatus={state.scenarioStatus}
          scenarioError={state.scenarioError}
          onSelect={state.selectCallcard}
          onRun={state.runSimulation}
          onScenarioOrigin={state.setScenarioOrigin}
          onScenarioDestination={state.setScenarioDestination}
          onScenarioOriginText={state.setScenarioOriginText}
          onScenarioDestinationText={state.setScenarioDestinationText}
          onClearScenario={state.clearScenario}
          onSwapScenario={state.swapScenarioPoints}
          onRunScenario={state.runScenarioMatching}
          isPending={state.isPending}
        />
        <div className={styles.centerPane}>
          <GoogleSpatialStage
            callcard={state.selectedCallcard}
            selectedCandidate={state.selectedCandidate}
            candidates={state.rankedCandidates}
            scenarioOrigin={state.scenarioOrigin}
            scenarioDestination={state.scenarioDestination}
            scenarioMode={state.scenarioMode}
            scenarioStatus={state.scenarioStatus}
          />
          {state.hasRun && !state.rankedCandidates.length && state.candidateState === 'original' ? (
            <div className={styles.softNotice}>비교 가능한 후보 기사가 없습니다. 벡터 또는 기사 선호 H3 데이터 상태를 확인해 주세요.</div>
          ) : null}
        </div>
        <CandidateDock
          candidates={state.rankedCandidates}
          state={state.candidateState}
          selectedId={state.selectedCandidate?.driver.id ?? ''}
          onSelect={state.selectCandidate}
        />
      </div>
      <EvidenceDrawer
        open={state.showEvidence && canShowEvidence}
        onToggle={state.setShowEvidence}
        callcard={state.selectedCallcard}
        candidate={state.selectedCandidate}
        formula={model.formula}
      />
    </div>
  )
}
