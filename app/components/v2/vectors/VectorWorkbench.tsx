'use client'

import type { VectorWorkbenchModel } from '@/lib/adapters/vectors'
import { FactorInspector } from './FactorInspector'
import { FactorLibrary } from './FactorLibrary'
import { VectorMatrix } from './VectorMatrix'
import { RelationshipMap } from './RelationshipMap'
import { CosineLens } from './CosineLens'
import { VectorLegend } from './VectorLegend'
import { useVectorWorkbench } from './useVectorWorkbench'
import styles from './vectorWorkbench.module.css'

export function VectorWorkbench({ model }: { model: VectorWorkbenchModel }) {
  const state = useVectorWorkbench(model)

  return (
    <div className={styles.workspace}>
      <div className={styles.progressBar} aria-label="Vector workflow status">
        <span data-active="true">원천 데이터</span>
        <i />
        <span data-active="true">팩터 결합</span>
        <i />
        <span data-active="true">벡터 생성</span>
        <i />
        <span data-active="true">비교/기여도 분석</span>
        <VectorLegend />
      </div>

      <div className={styles.mainGrid}>
        <FactorLibrary
          factors={state.filteredFactors}
          selectedKey={state.selectedFactorKey}
          query={state.factorQuery}
          group={state.factorGroup}
          onQuery={state.setFactorQuery}
          onGroup={state.setFactorGroup}
          onSelect={state.setSelectedFactorKey}
        />

        <div className={styles.centerStack}>
          <VectorMatrix
            factors={model.factors}
            visibleEntities={state.visibleEntities}
            totalEntities={state.sortedEntities.length}
            selectedFactorKey={state.selectedFactorKey}
            selectedEntityId={state.selectedEntityId}
            query={state.entityQuery}
            entityFilter={state.entityFilter}
            sortMode={state.sortMode}
            canLoadMore={state.canLoadMore}
            rowLimit={state.rowLimit}
            onQuery={state.setEntityQuery}
            onEntityFilter={state.setEntityFilter}
            onSort={state.setSortMode}
            onSelectFactor={state.setSelectedFactorKey}
            onSelectEntity={state.setSelectedEntityId}
            onLoadMore={state.loadMore}
          />
          <div className={styles.bottomGrid}>
            <RelationshipMap
              entities={state.sortedEntities}
              factors={model.factors}
              xFactorKey={state.xFactorKey}
              yFactorKey={state.yFactorKey}
              onXFactor={state.setXFactorKey}
              onYFactor={state.setYFactorKey}
              sampleLimit={model.relationshipSampleLimit}
            />
            <CosineLens
              entities={model.entities}
              factors={model.factors}
              compareAId={state.compareAId}
              compareBId={state.compareBId}
              compareA={state.compareA}
              compareB={state.compareB}
              onCompareA={state.setCompareAId}
              onCompareB={state.setCompareBId}
            />
          </div>
        </div>

        <FactorInspector factor={state.selectedFactor} selectedEntity={state.selectedEntity} />
      </div>
    </div>
  )
}
