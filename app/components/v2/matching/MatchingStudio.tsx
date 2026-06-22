'use client'

import { useMemo, useState } from 'react'
import type { MatchingStudioModel } from '@/lib/matching-studio-model'
import { CallBuilder } from './CallBuilder'
import { CandidateDock } from './CandidateDock'
import { EvidenceDrawer } from './EvidenceDrawer'
import { GoogleSpatialStage } from './GoogleSpatialStage'
import { StudioLegend } from './StudioLegend'
import { StudioStatus } from './StudioStatus'
import { useGoogleMapsApi } from './useGoogleMapsApi'
import { useMatchingStudio } from './useMatchingStudio'
import styles from './matchingStudio.module.css'

export function MatchingStudio({ model }: { model: MatchingStudioModel }) {
  const state = useMatchingStudio(model)
  const google = useGoogleMapsApi()
  const canShowEvidence = state.scenarioStatus === 'original' || state.scenarioStatus === 'ready'

  const [aspFilter, setAspFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')

  const uniqueAsps = useMemo(
    () => [...new Set(model.callcards.map((c) => c.aspId).filter((v): v is number => v != null))].sort((a, b) => a - b),
    [model.callcards],
  )
  const uniqueDates = useMemo(
    () => [...new Set(model.callcards.map((c) => c.callDate).filter((v): v is string => v != null))].sort().reverse(),
    [model.callcards],
  )

  const filteredCallcards = useMemo(
    () => model.callcards.filter((c) =>
      (aspFilter === 'all' || c.aspId === Number(aspFilter)) &&
      (dateFilter === 'all' || c.callDate === dateFilter),
    ),
    [model.callcards, aspFilter, dateFilter],
  )

  return (
    <div className={styles.workspace}>
      <StudioStatus model={model} candidateCount={state.rankedCandidates.length} />
      <div className={styles.mainGrid}>
        <CallBuilder
          google={google.google}
          callcards={filteredCallcards}
          selectedId={state.selectedCallcardId}
          selectedCallcard={state.selectedCallcard}
          asps={uniqueAsps}
          dates={uniqueDates}
          selectedAsp={aspFilter}
          selectedDate={dateFilter}
          onAspChange={setAspFilter}
          onDateChange={setDateFilter}
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
          <StudioLegend />
          {state.hasRun && !state.rankedCandidates.length && state.scenarioStatus === 'original' ? (
            <div className={styles.softNotice}>비교 가능한 후보 기사가 없습니다. 벡터 또는 기사 선호 H3 데이터 상태를 확인해 주세요.</div>
          ) : null}
        </div>
        <CandidateDock
          candidates={state.rankedCandidates}
          state={state.scenarioStatus}
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
