'use client'

import { useMemo, useState } from 'react'
import type { VectorDimensionKey } from '@/lib/matching-vector'
import type { VectorWorkbenchModel } from '@/lib/adapters/vectors'

export type EntityFilter = 'all' | 'driver' | 'callcard'
export type SortMode = 'label' | 'type' | 'selected_factor_desc' | 'selected_factor_asc'

export function useVectorWorkbench(model: VectorWorkbenchModel) {
  const firstFactor = model.factors[0]?.key ?? 'score_dawn'
  const [selectedFactorKey, setSelectedFactorKey] = useState<VectorDimensionKey>(firstFactor)
  const [factorQuery, setFactorQuery] = useState('')
  const [factorGroup, setFactorGroup] = useState('all')
  const [entityQuery, setEntityQuery] = useState('')
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('selected_factor_desc')
  const [rowLimit, setRowLimit] = useState(60)
  const [selectedEntityId, setSelectedEntityId] = useState(model.entities[0]?.id ?? null)
  const [compareAId, setCompareAId] = useState(model.entities.find((entity) => entity.type === 'callcard')?.id ?? model.entities[0]?.id ?? null)
  const [compareBId, setCompareBId] = useState(model.entities.find((entity) => entity.type === 'driver')?.id ?? model.entities[1]?.id ?? null)
  const [xFactorKey, setXFactorKey] = useState<VectorDimensionKey>(firstFactor)
  const [yFactorKey, setYFactorKey] = useState<VectorDimensionKey>(model.factors[1]?.key ?? firstFactor)

  const selectedFactor = useMemo(
    () => model.factors.find((factor) => factor.key === selectedFactorKey) ?? model.factors[0] ?? null,
    [model.factors, selectedFactorKey],
  )
  const selectedFactorIndex = selectedFactor?.index ?? 0

  const filteredFactors = useMemo(() => {
    const query = factorQuery.trim().toLowerCase()
    return model.factors.filter((factor) => {
      if (factorGroup !== 'all' && factor.group !== factorGroup) return false
      if (!query) return true
      return [factor.label, factor.key, factor.group, factor.displayAxis].some((value) => value.toLowerCase().includes(query))
    })
  }, [factorGroup, factorQuery, model.factors])

  const sortedEntities = useMemo(() => {
    const query = entityQuery.trim().toLowerCase()
    const result = model.entities.filter((entity) => {
      if (entityFilter !== 'all' && entity.type !== entityFilter) return false
      if (!query) return true
      return [entity.label, entity.type, String(entity.aspId ?? '')].some((value) => value.toLowerCase().includes(query))
    })
    return [...result].sort((a, b) => {
      if (sortMode === 'type') return a.type.localeCompare(b.type) || a.label.localeCompare(b.label)
      if (sortMode === 'selected_factor_asc') {
        const av = a.vector[selectedFactorIndex] ?? -1
        const bv = b.vector[selectedFactorIndex] ?? -1
        return av - bv || a.label.localeCompare(b.label)
      }
      if (sortMode === 'selected_factor_desc') {
        const av = a.vector[selectedFactorIndex] ?? -1
        const bv = b.vector[selectedFactorIndex] ?? -1
        return bv - av || a.label.localeCompare(b.label)
      }
      return a.label.localeCompare(b.label)
    })
  }, [entityFilter, entityQuery, model.entities, selectedFactorIndex, sortMode])


  const visibleEntities = sortedEntities.slice(0, rowLimit)
  const selectedEntity = model.entities.find((entity) => entity.id === selectedEntityId) ?? visibleEntities[0] ?? null
  const compareA = model.entities.find((entity) => entity.id === compareAId) ?? null
  const compareB = model.entities.find((entity) => entity.id === compareBId) ?? null
  const canLoadMore = rowLimit < sortedEntities.length

  return {
    selectedFactor,
    selectedFactorKey,
    setSelectedFactorKey,
    factorQuery,
    setFactorQuery,
    factorGroup,
    setFactorGroup,
    filteredFactors,
    entityQuery,
    setEntityQuery,
    entityFilter,
    setEntityFilter,
    sortMode,
    setSortMode,
    sortedEntities,
    visibleEntities,
    rowLimit,
    canLoadMore,
    loadMore: () => setRowLimit((current) => Math.min(current + 40, sortedEntities.length)),
    selectedEntity,
    selectedEntityId,
    setSelectedEntityId,
    compareA,
    compareAId,
    setCompareAId,
    compareB,
    compareBId,
    setCompareBId,
    xFactorKey,
    setXFactorKey,
    yFactorKey,
    setYFactorKey,
  }
}


