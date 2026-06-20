'use client'

import type { MatchingCandidateModel } from '@/lib/matching-studio-model'
import { formatPercent, formatScore } from './formatters'
import styles from './matchingStudio.module.css'

export function CandidateDock({
  candidates,
  selectedId,
  onSelect,
}: {
  candidates: MatchingCandidateModel[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  if (!candidates.length) {
    return (
      <aside className={styles.candidateDock}>
        <p className={styles.eyebrow}>CANDIDATE DOCK</p>
        <h2>후보 없음</h2>
        <p className={styles.muted}>선택한 콜카드와 비교 가능한 기사 벡터가 없습니다.</p>
      </aside>
    )
  }

  return (
    <aside className={styles.candidateDock} aria-label="Top 10 후보 기사">
      <div className={styles.dockHeader}>
        <div>
          <p className={styles.eyebrow}>CANDIDATE DOCK</p>
          <h2>Top 10 분석 후보</h2>
        </div>
        <span>{candidates.length}명</span>
      </div>
      <div className={styles.candidateList} role="listbox" aria-label="분석 후보 기사 목록">
        {candidates.map((candidate, index) => (
          <div
            className={styles.candidateRow}
            data-selected={candidate.driver.id === selectedId}
            key={candidate.driver.id}
            role="option"
            tabIndex={0}
            aria-selected={candidate.driver.id === selectedId}
            aria-label={`${index + 1}순위 기사 ${candidate.driver.id} 선택`}
            onClick={() => onSelect(candidate.driver.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(candidate.driver.id)
              }
            }}
          >
            <span className={styles.rank}>#{index + 1}</span>
            <span>
              <b>{candidate.driver.id}</b>
              <small>성향 {formatPercent(candidate.similarityScore)} · 공간 {formatPercent(candidate.spatial.spatialScore)}</small>
            </span>
            <strong>{formatScore(candidate.finalScore)}</strong>
          </div>
        ))}
      </div>
    </aside>
  )
}
