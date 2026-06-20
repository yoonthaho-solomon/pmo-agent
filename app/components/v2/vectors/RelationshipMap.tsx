'use client'

import type { VectorEntityModel, VectorFactorModel } from '@/lib/adapters/vectors'
import type { VectorDimensionKey } from '@/lib/matching-vector'
import { numberValue } from './formatters'
import styles from './vectorWorkbench.module.css'

export function RelationshipMap({
  entities,
  factors,
  xFactorKey,
  yFactorKey,
  onXFactor,
  onYFactor,
  sampleLimit,
}: {
  entities: VectorEntityModel[]
  factors: VectorFactorModel[]
  xFactorKey: VectorDimensionKey
  yFactorKey: VectorDimensionKey
  onXFactor: (key: VectorDimensionKey) => void
  onYFactor: (key: VectorDimensionKey) => void
  sampleLimit: number
}) {
  const xFactor = factors.find((factor) => factor.key === xFactorKey) ?? factors[0]
  const yFactor = factors.find((factor) => factor.key === yFactorKey) ?? factors[1] ?? factors[0]
  const sample = entities
    .filter((entity) => xFactor && yFactor && entity.vector[xFactor.index] != null && entity.vector[yFactor.index] != null)
    .slice(0, sampleLimit)

  return (
    <section className={styles.relationship} aria-label="Relationship map">
      <div className={styles.sectionHeaderCompact}>
        <div>
          <p>RELATIONSHIP MAP</p>
          <h2>2D 팩터 분포</h2>
        </div>
        <span>표본 {sample.length}/{entities.length}</span>
      </div>
      <div className={styles.axisControls}>
        <label> X축
          <select value={xFactorKey} onChange={(event) => onXFactor(event.target.value as VectorDimensionKey)}>
            {factors.map((factor) => <option key={factor.key} value={factor.key}>{factor.label}</option>)}
          </select>
        </label>
        <label> Y축
          <select value={yFactorKey} onChange={(event) => onYFactor(event.target.value as VectorDimensionKey)}>
            {factors.map((factor) => <option key={factor.key} value={factor.key}>{factor.label}</option>)}
          </select>
        </label>
      </div>
      <svg className={styles.scatter} viewBox="0 0 520 210" role="img" aria-label="선택한 두 팩터의 2D 분포">
        <line x1="36" y1="178" x2="500" y2="178" />
        <line x1="36" y1="18" x2="36" y2="178" />
        {sample.map((entity) => {
          const x = entity.vector[xFactor.index] ?? 0
          const y = entity.vector[yFactor.index] ?? 0
          return (
            <circle
              key={entity.id}
              cx={36 + x * 464}
              cy={178 - y * 160}
              r={entity.type === 'driver' ? 4 : 5}
              data-type={entity.type}
              aria-label={`${entity.label}: ${xFactor.label} ${numberValue(x, 2)}, ${yFactor.label} ${numberValue(y, 2)}`}
            />
          )
        })}
        <text x="36" y="202">{xFactor.label}</text>
        <text x="8" y="22">{yFactor.label}</text>
      </svg>
      <p className={styles.mapNote}>차원축소가 아닌 선택한 두 22D 팩터의 실제 값 분포입니다. 표본은 현재 정렬 순서의 상위 {sampleLimit}개로 제한합니다.</p>
    </section>
  )
}

