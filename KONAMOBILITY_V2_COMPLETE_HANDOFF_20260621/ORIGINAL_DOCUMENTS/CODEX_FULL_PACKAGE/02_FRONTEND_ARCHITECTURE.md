# FRONTEND ARCHITECTURE

## 권장 라우트

현재 라우트를 조사한 뒤 기존 URL 호환성을 유지하면서 다음 구조를 적용한다.

```text
/data-ops
/vector-workbench
/matching-studio
```

기존 `/ingest`, `/vectors`, `/simulator`가 공개된 상태라면:
- redirect 또는 route alias를 사용
- 기존 링크가 깨지지 않게 유지

## 권장 컴포넌트 트리

```text
AppShell
├─ GlobalHeader
│  ├─ Brand
│  ├─ WorkspaceTabs
│  ├─ ConnectionStatus
│  ├─ HelpAction
│  ├─ NotificationAction
│  └─ UserMenu
├─ RouteTransition
└─ Workspace
   ├─ DataOpsWorkspace
   ├─ VectorWorkbench
   └─ MatchingStudio
```

### DataOpsWorkspace

```text
DataOpsWorkspace
├─ DataOpsSummaryBar
├─ SourceRail
├─ IngestionMatrix
│  ├─ MatrixToolbar
│  ├─ MatrixGrid
│  ├─ CellTooltip
│  └─ StatusLegend
├─ DataInspector
└─ DataCatalogTable
```

### VectorWorkbench

```text
VectorWorkbench
├─ VectorToolbar
├─ FactorLibrary
├─ VectorMatrix
│  ├─ MatrixModeTabs
│  ├─ MatrixHeader
│  ├─ MatrixRows
│  └─ MatrixLegend
├─ RelationshipMap
├─ FactorInspector
└─ CosineLens
   ├─ VectorAnglePlot
   ├─ SimilarityMetrics
   ├─ ContributionChart
   └─ AxisToggleGrid
```

### MatchingStudio

```text
MatchingStudio
├─ WinnerSummaryBar
├─ MapStage
│  ├─ MatchingMap
│  ├─ CallBuilderDrawer
│  ├─ LayerControl
│  ├─ MapLegend
│  ├─ MapToolbar
│  └─ CandidateDock
└─ EvidenceDrawer
```

## 상태 분리

### 서버 상태
- React Query 또는 현재 fetch/cache 계층
- 적재 현황
- 벡터 목록
- 기사 후보
- 추천 결과

### UI 상태
- Zustand 또는 local reducer
- 선택 데이터 소스
- 선택 날짜/셀
- 선택 팩터
- matrix mode
- 지도 레이어 토글
- 출발/도착 선택 모드
- 선택 기사
- drawer 상태

### URL 상태
공유 가치가 있는 상태만 query string에 저장:
- workspace
- selected date
- factor group
- selected driver
- region/ASP

## 어댑터 계층
기존 API 응답을 UI가 직접 해석하지 않도록 어댑터를 둔다.

```text
API response
→ domain adapter
→ normalized UI model
→ component
```

예:
- `adaptIngestionSummary`
- `adaptVectorFactors`
- `adaptSimulationResult`
- `adaptDriverCandidate`

## 경계
- 계산 로직은 component 안에 넣지 않는다.
- formatting은 `lib/formatters`.
- spatial transform은 `lib/spatial`.
- score labeling은 `lib/scoring`.
- map layer creation은 `lib/map/layers`.
