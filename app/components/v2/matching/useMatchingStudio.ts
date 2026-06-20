'use client'

import { useMemo, useState, useTransition } from 'react'
import type { MatchingCallcardModel, MatchingCandidateModel, MatchingStudioModel } from '@/lib/matching-studio-model'

export function useMatchingStudio(model: MatchingStudioModel) {
  const [selectedCallcardId, setSelectedCallcardId] = useState(model.callcards[0]?.id ?? '')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [showEvidence, setShowEvidence] = useState(false)
  const [hasRun, setHasRun] = useState(Boolean(model.callcards[0]))
  const [isPending, startTransition] = useTransition()

  const selectedCallcard = useMemo<MatchingCallcardModel | null>(
    () => model.callcards.find((callcard) => callcard.id === selectedCallcardId) ?? model.callcards[0] ?? null,
    [model.callcards, selectedCallcardId],
  )

  const rankedCandidates = useMemo<MatchingCandidateModel[]>(() => {
    if (!selectedCallcard || !hasRun) return []
    return model.candidatesByCallcard[selectedCallcard.id] ?? []
  }, [hasRun, model.candidatesByCallcard, selectedCallcard])

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
