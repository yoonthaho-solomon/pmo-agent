'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ScenarioMatchingResponse, ScenarioPointInput } from '@/lib/adapters/matching'
import type { MatchingCallcardModel, MatchingCandidateModel, MatchingStudioModel } from '@/lib/matching-studio-model'

export function useMatchingStudio(model: MatchingStudioModel) {
  const [selectedCallcardId, setSelectedCallcardId] = useState(model.callcards[0]?.id ?? '')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [showEvidence, setShowEvidence] = useState(false)
  const [hasRun, setHasRun] = useState(Boolean(model.callcards[0]))
  const [isPending, startTransition] = useTransition()
  const [scenarioOrigin, setScenarioOrigin] = useState<ScenarioPointInput | null>(null)
  const [scenarioDestination, setScenarioDestination] = useState<ScenarioPointInput | null>(null)
  const [scenarioRoute, setScenarioRoute] = useState<MatchingCallcardModel['route'] | null>(null)
  const [scenarioCandidates, setScenarioCandidates] = useState<MatchingCandidateModel[] | null>(null)
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const [isScenarioPending, setIsScenarioPending] = useState(false)

  const selectedCallcard = useMemo<MatchingCallcardModel | null>(
    () => model.callcards.find((callcard) => callcard.id === selectedCallcardId) ?? model.callcards[0] ?? null,
    [model.callcards, selectedCallcardId],
  )

  const activeCallcard = useMemo<MatchingCallcardModel | null>(() => {
    if (!selectedCallcard) return null
    if (!scenarioRoute) return selectedCallcard

    return {
      ...selectedCallcard,
      passengerAddress: scenarioOrigin?.label ?? selectedCallcard.passengerAddress,
      destinationAddress: scenarioDestination?.label ?? selectedCallcard.destinationAddress,
      route: scenarioRoute,
      diagnostics: {
        ...selectedCallcard.diagnostics,
        pickupH3Source: scenarioRoute.pickup.h3Res7 ? 'COORDINATE' : 'NONE',
        destinationH3Source: scenarioRoute.destination.h3Res7 ? 'COORDINATE' : 'NONE',
        pickupCoordinateValid: scenarioRoute.pickup.h3Res7 != null,
        destinationCoordinateValid: scenarioRoute.destination.h3Res7 != null,
      },
    }
  }, [scenarioDestination?.label, scenarioOrigin?.label, scenarioRoute, selectedCallcard])

  const rankedCandidates = useMemo<MatchingCandidateModel[]>(() => {
    if (!selectedCallcard || !hasRun) return []
    if (scenarioCandidates) return scenarioCandidates
    return model.candidatesByCallcard[selectedCallcard.id] ?? []
  }, [hasRun, model.candidatesByCallcard, scenarioCandidates, selectedCallcard])

  const selectedCandidate = useMemo(
    () => rankedCandidates.find((candidate) => candidate.driver.id === selectedCandidateId) ?? rankedCandidates[0] ?? null,
    [rankedCandidates, selectedCandidateId],
  )

  function selectCallcard(id: string) {
    setSelectedCallcardId(id)
    setSelectedCandidateId('')
    setHasRun(false)
    clearScenario()
  }

  function runSimulation() {
    startTransition(() => {
      setHasRun(true)
      setSelectedCandidateId('')
    })
  }

  function clearScenario() {
    setScenarioOrigin(null)
    setScenarioDestination(null)
    setScenarioRoute(null)
    setScenarioCandidates(null)
    setScenarioError(null)
  }

  function swapScenarioPoints() {
    setScenarioOrigin(scenarioDestination)
    setScenarioDestination(scenarioOrigin)
    setScenarioRoute(null)
    setScenarioCandidates(null)
    setScenarioError(null)
  }

  async function runScenarioMatching() {
    if (!selectedCallcard || !scenarioOrigin || !scenarioDestination) {
      setScenarioError('출발지와 도착지를 검색 결과에서 선택해 주세요.')
      return
    }

    setIsScenarioPending(true)
    setScenarioError(null)

    try {
      const response = await fetch('/api/matching-studio/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callcardId: selectedCallcard.id,
          origin: scenarioOrigin,
          destination: scenarioDestination,
        }),
      })
      const result = await response.json() as ScenarioMatchingResponse
      if (!result.ok) {
        setScenarioError(result.message)
        return
      }

      setScenarioRoute(result.route)
      setScenarioCandidates(result.candidates)
      setSelectedCandidateId('')
      setHasRun(true)
    } catch {
      setScenarioError('시나리오 매칭 계산에 실패했습니다.')
    } finally {
      setIsScenarioPending(false)
    }
  }

  return {
    selectedCallcard: activeCallcard,
    originalCallcard: selectedCallcard,
    selectedCallcardId,
    selectedCandidate,
    selectedCandidateId,
    rankedCandidates,
    hasRun,
    isPending: isPending || isScenarioPending,
    showEvidence,
    scenarioOrigin,
    scenarioDestination,
    scenarioError,
    scenarioMode: Boolean(scenarioRoute),
    setShowEvidence,
    setScenarioOrigin,
    setScenarioDestination,
    selectCallcard,
    selectCandidate: setSelectedCandidateId,
    runSimulation,
    clearScenario,
    swapScenarioPoints,
    runScenarioMatching,
  }
}
