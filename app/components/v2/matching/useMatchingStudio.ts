'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ScenarioMatchingResponse, ScenarioPointInput } from '@/lib/adapters/matching'
import type { MatchingCallcardModel, MatchingCandidateModel, MatchingStudioModel } from '@/lib/matching-studio-model'

export type ScenarioStatus = 'original' | 'dirty' | 'calculating' | 'ready' | 'error'

function pointLabel(point: ScenarioPointInput | null): string {
  return point?.label ?? ''
}

export function useMatchingStudio(model: MatchingStudioModel) {
  const [selectedCallcardId, setSelectedCallcardId] = useState(model.callcards[0]?.id ?? '')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [showEvidence, setShowEvidence] = useState(false)
  const [hasRun, setHasRun] = useState(Boolean(model.callcards[0]))
  const [isPending, startTransition] = useTransition()
  const [scenarioOrigin, setScenarioOriginState] = useState<ScenarioPointInput | null>(null)
  const [scenarioDestination, setScenarioDestinationState] = useState<ScenarioPointInput | null>(null)
  const [scenarioOriginText, setScenarioOriginTextState] = useState('')
  const [scenarioDestinationText, setScenarioDestinationTextState] = useState('')
  const [scenarioRoute, setScenarioRoute] = useState<MatchingCallcardModel['route'] | null>(null)
  const [scenarioCandidates, setScenarioCandidates] = useState<MatchingCandidateModel[] | null>(null)
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const [scenarioStatus, setScenarioStatus] = useState<ScenarioStatus>('original')
  const [isScenarioPending, setIsScenarioPending] = useState(false)

  const selectedCallcard = useMemo<MatchingCallcardModel | null>(
    () => model.callcards.find((callcard) => callcard.id === selectedCallcardId) ?? model.callcards[0] ?? null,
    [model.callcards, selectedCallcardId],
  )

  const activeCallcard = useMemo<MatchingCallcardModel | null>(() => {
    if (!selectedCallcard) return null
    if (scenarioStatus !== 'ready' || !scenarioRoute) return selectedCallcard

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
  }, [scenarioDestination?.label, scenarioOrigin?.label, scenarioRoute, scenarioStatus, selectedCallcard])

  const rankedCandidates = useMemo<MatchingCandidateModel[]>(() => {
    if (!selectedCallcard || !hasRun) return []
    if (scenarioStatus === 'dirty' || scenarioStatus === 'calculating') return []
    if (scenarioStatus === 'ready' && scenarioCandidates) return scenarioCandidates
    return model.candidatesByCallcard[selectedCallcard.id] ?? []
  }, [hasRun, model.candidatesByCallcard, scenarioCandidates, scenarioStatus, selectedCallcard])

  const selectedCandidate = useMemo(
    () => rankedCandidates.find((candidate) => candidate.driver.id === selectedCandidateId) ?? rankedCandidates[0] ?? null,
    [rankedCandidates, selectedCandidateId],
  )

  function invalidateScenario(nextStatus: ScenarioStatus = 'dirty') {
    setScenarioRoute(null)
    setScenarioCandidates(null)
    setSelectedCandidateId('')
    setShowEvidence(false)
    setScenarioError(null)
    setScenarioStatus(nextStatus)
  }

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
      if (scenarioStatus !== 'ready') setScenarioStatus('original')
    })
  }

  function clearScenario() {
    setScenarioOriginState(null)
    setScenarioDestinationState(null)
    setScenarioOriginTextState('')
    setScenarioDestinationTextState('')
    setScenarioRoute(null)
    setScenarioCandidates(null)
    setScenarioError(null)
    setSelectedCandidateId('')
    setShowEvidence(false)
    setScenarioStatus('original')
  }

  function setScenarioOrigin(point: ScenarioPointInput | null) {
    setScenarioOriginState(point)
    setScenarioOriginTextState(pointLabel(point))
    invalidateScenario(point || scenarioDestination ? 'dirty' : 'original')
  }

  function setScenarioDestination(point: ScenarioPointInput | null) {
    setScenarioDestinationState(point)
    setScenarioDestinationTextState(pointLabel(point))
    invalidateScenario(scenarioOrigin || point ? 'dirty' : 'original')
  }

  function setScenarioOriginText(text: string) {
    setScenarioOriginTextState(text)
    if (scenarioOrigin != null) setScenarioOriginState(null)
    invalidateScenario(text.trim() || scenarioDestinationText.trim() ? 'dirty' : 'original')
  }

  function setScenarioDestinationText(text: string) {
    setScenarioDestinationTextState(text)
    if (scenarioDestination != null) setScenarioDestinationState(null)
    invalidateScenario(scenarioOriginText.trim() || text.trim() ? 'dirty' : 'original')
  }

  function swapScenarioPoints() {
    const nextOrigin = scenarioDestination
    const nextDestination = scenarioOrigin
    setScenarioOriginState(nextOrigin)
    setScenarioDestinationState(nextDestination)
    setScenarioOriginTextState(pointLabel(nextOrigin))
    setScenarioDestinationTextState(pointLabel(nextDestination))
    invalidateScenario(nextOrigin || nextDestination ? 'dirty' : 'original')
  }

  async function runScenarioMatching() {
    if (!selectedCallcard || !scenarioOrigin || !scenarioDestination) {
      setScenarioError('출발지와 도착지는 검색 결과에서 선택해야 합니다.')
      setScenarioStatus('dirty')
      return
    }

    setIsScenarioPending(true)
    setScenarioStatus('calculating')
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
        setScenarioStatus('error')
        setScenarioRoute(null)
        setScenarioCandidates(null)
        return
      }

      setScenarioRoute(result.route)
      setScenarioCandidates(result.candidates)
      setSelectedCandidateId('')
      setHasRun(true)
      setScenarioStatus('ready')
    } catch {
      setScenarioError('시나리오 매칭 계산에 실패했습니다.')
      setScenarioStatus('error')
      setScenarioRoute(null)
      setScenarioCandidates(null)
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
    scenarioOriginText,
    scenarioDestinationText,
    scenarioError,
    scenarioStatus,
    scenarioMode: scenarioStatus === 'ready',
    setShowEvidence,
    setScenarioOrigin,
    setScenarioDestination,
    setScenarioOriginText,
    setScenarioDestinationText,
    selectCallcard,
    selectCandidate: setSelectedCandidateId,
    runSimulation,
    clearScenario,
    swapScenarioPoints,
    runScenarioMatching,
  }
}
