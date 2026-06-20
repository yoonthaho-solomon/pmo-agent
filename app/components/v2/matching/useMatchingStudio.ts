'use client'

import { useMemo, useState, useTransition } from 'react'
import type { MatchingCallcardModel, MatchingCandidateModel, MatchingStudioModel } from '@/lib/matching-studio-model'
import { calculateMatchingCandidate, rankMatchingCandidates } from '@/lib/matching-studio-model'

export function useMatchingStudio(model: MatchingStudioModel) {
  const [selectedCallcardId, setSelectedCallcardId] = useState(model.callcards[0]?.id ?? '')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [showEvidence, setShowEvidence] = useState(true)
  const [hasRun, setHasRun] = useState(Boolean(model.callcards[0]))
  const [isPending, startTransition] = useTransition()

  const selectedCallcard = useMemo<MatchingCallcardModel | null>(
    () => model.callcards.find((callcard) => callcard.id === selectedCallcardId) ?? model.callcards[0] ?? null,
    [model.callcards, selectedCallcardId],
  )

  const rankedCandidates = useMemo<MatchingCandidateModel[]>(() => {
    if (!selectedCallcard || !hasRun) return []
    const rawCandidates = model.drivers
      .filter((driver) => driver.aspId == null || selectedCallcard.aspId == null || driver.aspId === selectedCallcard.aspId)
      .map((driver) => calculateMatchingCandidate(selectedCallcard, driver))
      .filter((candidate): candidate is MatchingCandidateModel => candidate != null)
    return rankMatchingCandidates(rawCandidates).slice(0, model.limits.topCandidates)
  }, [hasRun, model.drivers, model.limits.topCandidates, selectedCallcard])

  const selectedCandidate = useMemo(
    () => rankedCandidates.find((candidate) => candidate.driver.id === selectedCandidateId) ?? rankedCandidates[0] ?? null,
    [rankedCandidates, selectedCandidateId],
  )

  function selectCallcard(id: string) {
    setSelectedCallcardId(id)
    setSelectedCandidateId('')
    setHasRun(false)
  }

  function runSimulation() {
    startTransition(() => {
      setHasRun(true)
      setSelectedCandidateId('')
    })
  }

  return {
    selectedCallcard,
    selectedCallcardId,
    selectedCandidate,
    selectedCandidateId,
    rankedCandidates,
    hasRun,
    isPending,
    showEvidence,
    setShowEvidence,
    selectCallcard,
    selectCandidate: setSelectedCandidateId,
    runSimulation,
  }
}
