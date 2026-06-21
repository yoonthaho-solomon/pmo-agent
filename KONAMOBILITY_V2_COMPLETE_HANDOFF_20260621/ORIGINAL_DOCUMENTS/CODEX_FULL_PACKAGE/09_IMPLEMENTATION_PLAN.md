# IMPLEMENTATION PLAN

## Phase 0 — 보호와 조사
- branch 생성
- 현재 Production commit/tag 기록
- 기존 스크린샷 보존
- route/API/component 조사
- build baseline 기록

완료 조건:
- 코드 변경 전 분석 보고서 승인

## Phase 1 — Foundation
- design tokens
- AppShell
- header/workspace tabs
- primitives
- loading/empty/error primitives
- route aliases

완료 조건:
- 기존 기능은 여전히 접근 가능
- 새 shell에서 3개 route 이동

## Phase 2 — 데이터 운영
- SourceRail
- summary strip
- IngestionMatrix
- Inspector
- DataCatalog
- existing ingestion API adapter

완료 조건:
- 실제 적재 기간/상태 표시
- 날짜 셀 선택
- inspector 연동
- null/partial 처리

## Phase 3 — 벡터 워크벤치
- FactorLibrary
- VectorMatrix
- modes
- RelationshipMap
- Inspector
- CosineLens
- existing vector API adapter

완료 조건:
- 실제 콜카드/기사 벡터 연결
- 선택 팩터 동기화
- cosine 값 일치
- 더미 추천 UI 없음

## Phase 4 — 매칭 스튜디오 구조
- full map shell
- floating CallBuilder
- CandidateDock
- EvidenceDrawer
- map loading state

완료 조건:
- 지도 우선 레이아웃
- 패널/드로어 조작
- 반응형 기본

## Phase 5 — Mapbox/deck.gl/H3
- Mapbox instance
- MapboxOverlay
- H3 layer
- candidate layer
- route layer
- marker/geocoder
- map picking
- layer control

완료 조건:
- 실제 좌표/H3
- 출발/도착 선택
- route 표시
- 기사 선택 지도 연동

## Phase 6 — 추천 연결
- simulation API
- Top 10
- selected driver
- pickup ETA
- evidence
- score formula label

완료 조건:
- API 수치와 UI 일치
- rank 정렬
- selected driver map/evidence sync

## Phase 7 — Motion/State/Accessibility
- motion
- keyboard
- focus
- reduced motion
- skeleton
- error/empty/partial
- tooltips

## Phase 8 — QA/Performance
- 1366/1440/1600/1920
- build/typecheck/lint
- map performance
- API request dedupe
- no layout shift
- browser zoom
- projector readability

## Phase 9 — Release
- before/after
- screenshots
- final review
- preview deployment
- Production approval
