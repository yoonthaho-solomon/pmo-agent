import type { MatchingCallcardModel, MatchingCandidateModel } from '@/lib/matching-studio-model'
import { VECTOR_DIMENSIONS } from '@/lib/matching-vector'
import { AXIS_LABELS } from './matchingMeta'
import styles from './matchingStudio.module.css'

function averageFor(keys: string[], vector: number[]): number | null {
  const indexes = keys.map((key) => VECTOR_DIMENSIONS.findIndex((dimension) => dimension.key === key)).filter((index) => index >= 0)
  const values = indexes.map((index) => vector[index]).filter((value) => Number.isFinite(value))
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percent(value: number | null): string {
  if (value == null) return '-'
  return `${Math.round(value * 100)}%`
}

export function VectorEvidence({
  callcard,
  candidate,
}: {
  callcard: MatchingCallcardModel | null
  candidate: MatchingCandidateModel | null
}) {
  return (
    <section className={styles.evidenceSection}>
      <h3>22D 벡터 근거</h3>
      <div className={styles.axisList}>
        {AXIS_LABELS.map((axis) => {
          const callValue = callcard ? averageFor(axis.keys, callcard.vector) : null
          const driverValue = candidate ? averageFor(axis.keys, candidate.driver.vector) : null
          return (
            <div className={styles.axisRow} key={axis.label}>
              <span>{axis.label}</span>
              <div>
                <i style={{ width: `${Math.round((callValue ?? 0) * 100)}%` }} />
                <b style={{ width: `${Math.round((driverValue ?? 0) * 100)}%` }} />
              </div>
              <small>콜 {percent(callValue)} · 기사 {percent(driverValue)}</small>
            </div>
          )
        })}
      </div>
    </section>
  )
}
