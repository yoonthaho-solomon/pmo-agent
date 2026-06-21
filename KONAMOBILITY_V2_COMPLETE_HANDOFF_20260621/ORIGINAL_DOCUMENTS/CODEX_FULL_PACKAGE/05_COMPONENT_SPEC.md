# COMPONENT SPEC

## GlobalHeader
- 고정 64px
- active workspace 명확
- 연결 상태 dot
- 키보드 이동 가능
- 탭 underline morph

## SourceRail
- 소스명, 최신 상태, 최신 적재 상대시간
- selected row
- 상태 dot
- 섹션 접기 가능
- rail collapse 가능

## IngestionMatrix
- row: 데이터셋
- column: 날짜
- cell: 상태
- 상태 값: healthy / partial / missing / delayed / pending
- hover tooltip
- click selection
- 선택 row/column highlight
- 가로 스크롤 시 첫 열 sticky

## DataInspector
- 선택 날짜/데이터셋
- 수집 건수
- 정상 기준
- 수집 비율
- 최초/최종 시간
- 관련 로그 건수
- 원인
- empty state

## DataCatalogTable
- 검색
- 카테고리
- 소스
- 상태
- 갱신주기
- 활용 가능 여부
- column sorting
- sticky header

## FactorLibrary
- 그룹 accordion
- 검색
- 체크박스
- pin
- category badge
- 선택 개수
- 초기화

## VectorMatrix
- mode: Matrix / Difference / Contribution / Projection
- sticky first column
- selected row
- diverging color for difference
- tooltip raw/normalized values
- legend

## RelationshipMap
- 상위 기여 팩터만
- link width = contribution
- callcard cyan
- driver violet
- hover link isolate
- 전체 네트워크 장식 금지

## FactorInspector
- factor name/category
- raw values
- normalized values
- weight
- contribution
- confidence
- explanation
- selected driver comparisons

## CosineLens
- A/B vector plot
- theta
- raw cosine
- weighted cosine
- contribution chart
- included axes grid
- axis toggle changes score

## CallBuilder
- region
- date/day
- time
- origin
- destination
- call type
- passenger distance/time
- auto route distance/time
- run button
- collapsed/expanded state

## MatchingMap
- Mapbox canvas
- H3 layer
- candidate layer
- passenger route
- pickup route
- ETA label
- hover tooltip
- selected state

## LayerControl
- H3
- candidates
- passenger route
- pickup route
- ETA labels
- basemap style
- legend

## CandidateDock
- Top 10
- rank
- driver ID/name
- final score
- cosine
- pickup ETA
- confidence
- live/stale status
- selected row

## EvidenceDrawer
- collapsed summary
- expanded 5-axis evidence
- score composition
- supporting metrics
- close/drag/keyboard
