'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CallcardSliceResponse, OriginalMatchingResponse, ScenarioMatchingResponse, ScenarioPointInput } from '@/lib/adapters/matching'
import type { MatchingCallcardModel, MatchingCandidateModel, MatchingStudioModel } from '@/lib/matching-studio-model'

export type ScenarioStatus = 'original' | 'dirty' | 'calculating' | 'ready' | 'error'
export type InputMode = 'callcard' | 'scenario'

function pointLabel(point: ScenarioPointInput | null): string {
  return point?.label ?? ''
}

function sameScenarioPoint(a: ScenarioPointInput | null, b: ScenarioPointInput | null): boolean {
  if (!a || !b) return false
  return a.lat === b.lat && a.lng === b.lng
}

export function useMatchingStudio(model: MatchingStudioModel) {
  const [callcards, setCallcards] = useState<MatchingCallcardModel[]>(model.callcards)
  const [aspFilter, setAspFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [hourFilter, setHourFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sliceLoading, setSliceLoading] = useState(false)
  const [selectedCallcardId, setSelectedCallcardId] = useState(model.callcards[0]?.id ?? '')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [inputMode, setInputModeState] = useState<InputMode>('callcard')
  const [showEvidence, setShowEvidence] = useState(false)
  const [hasRun, setHasRun] = useState(Boolean(model.callcards[0]))
  // Top 10 per callcard is computed lazily on demand; this cache is seeded with the first
  // callcard the server matched eagerly so the initial view is populated without a round-trip.
  const [originalCache, setOriginalCache] = useState<Map<string, MatchingCandidateModel[]>>(
    () => new Map(Object.entries(model.candidatesByCallcard)),
  )
  const [originalLoading, setOriginalLoading] = useState(false)
  const [originalError, setOriginalError] = useState<string | null>(null)
  const sliceRequestRef = useRef(0)
  const originalRequestRef = useRef(0)
  const [scenarioOrigin, setScenarioOriginState] = useState<ScenarioPointInput | null>(null)
  const [scenarioDestination, setScenarioDestinationState] = useState<ScenarioPointInput | null>(null)
  const [scenarioOriginText, setScenarioOriginTextState] = useState('')
  const [scenarioDestinationText, setScenarioDestinationTextState] = useState('')
  const [scenarioRoute, setScenarioRoute] = useState<MatchingCallcardModel['route'] | null>(null)
  const [scenarioCandidates, setScenarioCandidates] = useState<MatchingCandidateModel[] | null>(null)
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const [scenarioStatus, setScenarioStatus] = useState<ScenarioStatus>('original')
  const [isScenarioPending, setIsScenarioPending] = useState(false)
  const scenarioRequestIdRef = useRef(0)
  const scenarioAbortRef = useRef<AbortController | null>(null)
  const latestScenarioRef = useRef({
    callcardId: selectedCallcardId,
    origin: scenarioOrigin,
    destination: scenarioDestination,
  })

  useEffect(() => {
    latestScenarioRef.current = {
      callcardId: selectedCallcardId,
      origin: scenarioOrigin,
      destination: scenarioDestination,
    }
  }, [scenarioDestination, scenarioOrigin, selectedCallcardId])

  useEffect(() => {
    return () => {
      scenarioRequestIdRef.current += 1
      scenarioAbortRef.current?.abort()
      scenarioAbortRef.current = null
    }
  }, [])

  // Auto-run original Top 10 whenever a callcard is selected and not yet computed
  useEffect(() => {
    if (!selectedCallcardId || hasRun) return
    void ensureOriginal(selectedCallcardId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCallcardId, hasRun])

  // Auto-run scenario matching the moment both points are confirmed (no button needed)
  useEffect(() => {
    if (!scenarioOrigin || !scenarioDestination || !selectedCallcardId) return
    if (scenarioStatus !== 'dirty') return
    void runScenarioMatching()
    // runScenarioMatching reads fresh state from closure after render; intentional omission
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioOrigin, scenarioDestination, selectedCallcardId, scenarioStatus])

  const selectedCallcard = useMemo<MatchingCallcardModel | null>(
    () => callcards.find((callcard) => callcard.id === selectedCallcardId) ?? callcards[0] ?? null,
    [callcards, selectedCallcardId],
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
    if (scenarioStatus === 'dirty' || scenarioStatus === 'calculating' || scenarioStatus === 'error') return []
    if (scenarioStatus === 'ready' && scenarioCandidates) return scenarioCandidates
    return originalCache.get(selectedCallcard.id) ?? []
  }, [hasRun, originalCache, scenarioCandidates, scenarioStatus, selectedCallcard])

  const selectedCandidate = useMemo(
    () => rankedCandidates.find((candidate) => candidate.driver.id === selectedCandidateId) ?? rankedCandidates[0] ?? null,
    [rankedCandidates, selectedCandidateId],
  )

  function abortScenarioRequest() {
    scenarioRequestIdRef.current += 1
    scenarioAbortRef.current?.abort()
    scenarioAbortRef.current = null
    setIsScenarioPending(false)
  }

  function invalidateScenario(nextStatus: ScenarioStatus = 'dirty') {
    abortScenarioRequest()
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
    setOriginalError(null)
    clearScenario()
  }

  // Lazily fetch and cache a callcard's original Top 10, then reveal it. Guarded by a request
  // id so a slow response for a previously selected callcard cannot overwrite the current one.
  async function ensureOriginal(callcardId: string) {
    if (!callcardId) {
      setHasRun(false)
      return
    }
    if (originalCache.has(callcardId)) {
      setOriginalError(null)
      setHasRun(true)
      return
    }

    const requestId = originalRequestRef.current + 1
    originalRequestRef.current = requestId
    setOriginalLoading(true)
    setOriginalError(null)

    try {
      const response = await fetch('/api/matching-studio/original', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callcardId }),
      })
      const result = await response.json() as OriginalMatchingResponse
      if (originalRequestRef.current !== requestId) return
      if (!result.ok) {
        setOriginalError(result.message)
        return
      }
      setOriginalCache((prev) => new Map(prev).set(callcardId, result.candidates))
      setHasRun(true)
    } catch {
      if (originalRequestRef.current !== requestId) return
      setOriginalError('후보 계산에 실패했습니다.')
    } finally {
      if (originalRequestRef.current === requestId) setOriginalLoading(false)
    }
  }

  function runSimulation() {
    if (!selectedCallcard) return
    setSelectedCandidateId('')
    if (scenarioStatus !== 'ready') setScenarioStatus('original')
    void ensureOriginal(selectedCallcard.id)
  }

  // Filter changes drive a fresh server slice (any of the ~440k callcards is reachable this way),
  // then auto-select and match the first result so the studio is never left empty.
  async function loadSlice(asp: string, date: string, hour: string, status: string) {
    const requestId = sliceRequestRef.current + 1
    sliceRequestRef.current = requestId
    setSliceLoading(true)
    setOriginalError(null)

    try {
      const params = new URLSearchParams({ asp, date, hour, status })
      const response = await fetch(`/api/matching-studio/callcards?${params.toString()}`)
      const result = await response.json() as CallcardSliceResponse
      if (sliceRequestRef.current !== requestId) return
      if (!result.ok) return

      setCallcards(result.callcards)
      clearScenario()
      const first = result.callcards[0]
      setSelectedCallcardId(first?.id ?? '')
      setSelectedCandidateId('')
      if (first) {
        await ensureOriginal(first.id)
      } else {
        setHasRun(false)
      }
    } finally {
      if (sliceRequestRef.current === requestId) setSliceLoading(false)
    }
  }

  function changeAspFilter(value: string) {
    setAspFilter(value)
    void loadSlice(value, dateFilter, hourFilter, statusFilter)
  }

  function changeDateFilter(value: string) {
    setDateFilter(value)
    void loadSlice(aspFilter, value, hourFilter, statusFilter)
  }

  function changeHourFilter(value: string) {
    setHourFilter(value)
    void loadSlice(aspFilter, dateFilter, value, statusFilter)
  }

  function changeStatusFilter(value: string) {
    setStatusFilter(value)
    void loadSlice(aspFilter, dateFilter, hourFilter, value)
  }

  // Mode is a hard switch between the two input sources: a real callcard vs a hypothetical
  // origin/destination. Leaving scenario mode clears the manual points so the map and Top 10
  // revert to the selected callcard rather than lingering on a half-edited scenario.
  function setInputMode(mode: InputMode) {
    setInputModeState(mode)
    if (mode === 'callcard') clearScenario()
  }

  function clearScenario() {
    abortScenarioRequest()
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

    scenarioAbortRef.current?.abort()
    const requestId = scenarioRequestIdRef.current + 1
    scenarioRequestIdRef.current = requestId
    const controller = new AbortController()
    scenarioAbortRef.current = controller
    const requestCallcardId = selectedCallcard.id
    const requestOrigin = scenarioOrigin
    const requestDestination = scenarioDestination

    const isCurrentRequest = () => {
      const latest = latestScenarioRef.current
      return (
        scenarioRequestIdRef.current === requestId &&
        latest.callcardId === requestCallcardId &&
        sameScenarioPoint(latest.origin, requestOrigin) &&
        sameScenarioPoint(latest.destination, requestDestination)
      )
    }

    setIsScenarioPending(true)
    setScenarioStatus('calculating')
    setScenarioError(null)

    try {
      const response = await fetch('/api/matching-studio/scenario', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callcardId: requestCallcardId,
          origin: requestOrigin,
          destination: requestDestination,
        }),
      })
      const result = await response.json() as ScenarioMatchingResponse
      if (!isCurrentRequest()) return
      if (!result.ok) {
        setScenarioError(result.message)
        setScenarioStatus('error')
        setScenarioRoute(null)
        setScenarioCandidates(null)
        setSelectedCandidateId('')
        setShowEvidence(false)
        return
      }

      setScenarioRoute(result.route)
      setScenarioCandidates(result.candidates)
      setSelectedCandidateId('')
      setShowEvidence(false)
      setHasRun(true)
      setScenarioStatus('ready')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (!isCurrentRequest()) return
      setScenarioError('시나리오 매칭 계산에 실패했습니다.')
      setScenarioStatus('error')
      setScenarioRoute(null)
      setScenarioCandidates(null)
      setSelectedCandidateId('')
      setShowEvidence(false)
    } finally {
      if (scenarioRequestIdRef.current === requestId) {
        scenarioAbortRef.current = null
        setIsScenarioPending(false)
      }
    }
  }

  // Candidate dock state: surface lazy original loading/errors through the same status the
  // dock already understands, without disturbing the scenario flow.
  const candidateState: ScenarioStatus = scenarioStatus === 'original'
    ? (originalLoading ? 'calculating' : originalError ? 'error' : 'original')
    : scenarioStatus

  return {
    callcards,
    filterOptions: model.filterOptions,
    aspFilter,
    dateFilter,
    hourFilter,
    statusFilter,
    setAspFilter: changeAspFilter,
    setDateFilter: changeDateFilter,
    setHourFilter: changeHourFilter,
    setStatusFilter: changeStatusFilter,
    sliceLoading,
    selectedCallcard: activeCallcard,
    originalCallcard: selectedCallcard,
    inputMode,
    setInputMode,
    selectedCallcardId,
    selectedCandidate,
    selectedCandidateId,
    rankedCandidates,
    candidateState,
    hasRun,
    isPending: originalLoading || isScenarioPending || sliceLoading,
    originalError,
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
