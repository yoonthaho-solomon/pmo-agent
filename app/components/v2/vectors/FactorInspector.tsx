'use client'

import type { VectorEntityModel, VectorFactorModel } from '@/lib/adapters/vectors'
import { numberValue } from './formatters'
import styles from './vectorWorkbench.module.css'

export function FactorInspector({ factor, selectedEntity }: { factor: VectorFactorModel | null; selectedEntity: VectorEntityModel | null }) {
  if (!factor) {
    return (
      <aside className={styles.inspector} aria-label="Factor inspector">
        <div className={styles.panelTitle}>팩터 인스펙터</div>
        <p className={styles.empty}>선택된 팩터가 없습니다.</p>
      </aside>
    )
  }
  const selectedValue = selectedEntity?.vector[factor.index] ?? null
  const maxBin = Math.max(1, ...factor.bins)
  return (
    <aside className={styles.inspector} aria-label="Factor inspector">
      <div className={styles.panelTitle}>팩터 인스펙터</div>
      <div className={styles.factorHero}>
        <span>{factor.group}</span>
        <h2>{factor.label}</h2>
        <code>{factor.key}</code>
      </div>
      <dl className={styles.statGrid}>
        <div><dt>표시축</dt><dd>{factor.displayAxis}</dd></div>
        <div><dt>값 범위</dt><dd>{factor.range}</dd></div>
        <div><dt>유효 데이터</dt><dd>{factor.validCount}</dd></div>
        <div><dt>null</dt><dd>{factor.nullCount}</dd></div>
        <div><dt>최소</dt><dd>{numberValue(factor.min, 3)}</dd></div>
        <div><dt>최대</dt><dd>{numberValue(factor.max, 3)}</dd></div>
        <div><dt>평균</dt><dd>{numberValue(factor.average, 3)}</dd></div>
        <div><dt>중앙값</dt><dd>{numberValue(factor.median, 3)}</dd></div>
      </dl>
      <div className={styles.selectedValueBox}>
        <span>선택 엔티티 값</span>
        <strong>{numberValue(selectedValue, 3)}</strong>
        <small>{selectedEntity ? selectedEntity.label : '엔티티 미선택'}</small>
      </div>
      <section className={styles.distribution} aria-label={`${factor.label} distribution`}>
        <div className={styles.subTitle}>분포</div>
        {factor.validCount > 0 ? (
          <svg viewBox="0 0 220 92" role="img" aria-label="팩터 값 분포 히스토그램">
            {factor.bins.map((bin, index) => {
              const height = Math.max(2, (bin / maxBin) * 72)
              return <rect key={index} x={index * 22 + 4} y={84 - height} width="14" height={height} rx="3" />
            })}
            <line x1="0" x2="220" y1="84" y2="84" />
          </svg>
        ) : <p className={styles.empty}>분포를 계산할 유효 데이터가 없습니다.</p>}
      </section>
      <section className={styles.descriptionBox}>
        <div className={styles.subTitle}>설명</div>
        <p>{factor.description}</p>
      </section>
    </aside>
  )
}
