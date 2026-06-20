'use client'

import type { VectorEntityModel, VectorFactorModel } from '@/lib/adapters/vectors'
import { cosineSimilarity } from '@/lib/matching-vector'
import { DISPLAY_AXES } from '@/lib/matching-display-axis'
import { EntitySelector } from './EntitySelector'
import { numberValue, percentValue } from './formatters'
import styles from './vectorWorkbench.module.css'

function validVector(entity: VectorEntityModel | null): number[] | null {
  if (!entity || entity.invalidReason) return null
  if (entity.vector.some((value) => value == null)) return null
  return entity.vector as number[]
}

function cosine(a: VectorEntityModel | null, b: VectorEntityModel | null): number | null {
  const va = validVector(a)
  const vb = validVector(b)
  if (!va || !vb) return null
  return cosineSimilarity(va, vb)
}

function factorDiffs(a: VectorEntityModel | null, b: VectorEntityModel | null, factors: VectorFactorModel[]) {
  if (!a || !b) return []
  return factors.map((factor) => {
    const av = a.vector[factor.index]
    const bv = b.vector[factor.index]
    return { factor, av, bv, diff: av == null || bv == null ? null : Math.abs(av - bv) }
  })
}

export function CosineLens({
  entities,
  factors,
  compareAId,
  compareBId,
  compareA,
  compareB,
  onCompareA,
  onCompareB,
}: {
  entities: VectorEntityModel[]
  factors: VectorFactorModel[]
  compareAId: string | null
  compareBId: string | null
  compareA: VectorEntityModel | null
  compareB: VectorEntityModel | null
  onCompareA: (id: string) => void
  onCompareB: (id: string) => void
}) {
  const sameEntitySelected = compareAId != null && compareAId === compareBId
  const score = sameEntitySelected ? null : cosine(compareA, compareB)
  const diffs = sameEntitySelected ? [] : factorDiffs(compareA, compareB, factors)
  const similar = [...diffs].filter((item) => item.diff != null).sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0)).slice(0, 4)
  const different = [...diffs].filter((item) => item.diff != null).sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0)).slice(0, 4)
  const groupScores = DISPLAY_AXES.map((axis) => {
    const av = compareA ? axis.indexes.map((index) => compareA.vector[index]) : []
    const bv = compareB ? axis.indexes.map((index) => compareB.vector[index]) : []
    if (sameEntitySelected || av.some((value) => value == null) || bv.some((value) => value == null)) return { name: axis.name, score: null }
    return { name: axis.name, score: cosineSimilarity(av as number[], bv as number[]) }
  })

  return (
    <section className={styles.cosineLens} aria-label="Cosine lens">
      <div className={styles.sectionHeaderCompact}>
        <div>
          <p>COSINE LENS</p>
          <h2>두 벡터 유사도 비교</h2>
        </div>
        <strong>{percentValue(score, 1)}</strong>
      </div>
      <div className={styles.selectorGrid}>
        <EntitySelector id="compare-a" label="비교 대상 A" value={compareAId} entities={entities} disabledEntityId={compareBId} onChange={onCompareA} />
        <EntitySelector id="compare-b" label="비교 대상 B" value={compareBId} entities={entities} disabledEntityId={compareAId} onChange={onCompareB} />
      </div>
      {sameEntitySelected ? <p className={styles.selectionWarning}>서로 다른 두 엔티티를 선택하세요.</p> : null}
      <p className={styles.analysisNote}>이 값은 벡터 분석용 코사인 유사도이며 추천 순위나 배차 우선순위가 아닙니다.</p>
      <div className={styles.groupCompare}>
        {groupScores.map((item) => <div key={item.name}><span>{item.name}</span><b>{percentValue(item.score, 0)}</b></div>)}
      </div>
      <div className={styles.diffGrid}>
        <div>
          <h3>가장 유사한 팩터</h3>
          {similar.map((item) => <p key={item.factor.key}>{item.factor.label}<span>Δ {numberValue(item.diff, 3)}</span></p>)}
        </div>
        <div>
          <h3>차이가 큰 팩터</h3>
          {different.map((item) => <p key={item.factor.key}>{item.factor.label}<span>Δ {numberValue(item.diff, 3)}</span></p>)}
        </div>
      </div>
    </section>
  )
}
