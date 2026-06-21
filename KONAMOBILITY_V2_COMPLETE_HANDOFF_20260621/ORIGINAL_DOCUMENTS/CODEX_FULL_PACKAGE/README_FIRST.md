# KONAMOBILITY V2 — CODEX FULL PACKAGE

이 패키지는 현재 `pmo-agent` 프로젝트의 3개 화면을 첨부 레퍼런스 이미지와 최대한 동일한 정보구조, 레이아웃, 디자인 시스템, 인터랙션으로 구현하기 위한 전체 작업 패키지입니다.

## 최종 목표 화면

1. `assets/reference/01_DATA_OPS_CONSOLE_REFERENCE.png`
   - 데이터 운영 콘솔
   - 데이터 소스 레일
   - 적재 상태 매트릭스
   - 선택 셀 상세 인스펙터
   - 데이터 카탈로그

2. `assets/reference/02_VECTOR_WORKBENCH_REFERENCE.png`
   - 벡터 워크벤치
   - 팩터 라이브러리
   - 벡터 매트릭스
   - 관계 맵
   - 팩터 인스펙터
   - 코사인 렌즈

3. `assets/reference/03_MATCHING_STUDIO_REFERENCE.png`
   - 공간 매칭 스튜디오
   - Mapbox 중심 대형 캔버스
   - deck.gl 레이어
   - H3 공간 적합도
   - 후보 기사 Top 10
   - 픽업 ETA
   - 점수 근거

## Codex에서 사용하는 순서

1. 이 ZIP을 프로젝트 루트에 압축 해제한다.
2. Codex에 `00_CODEX_MASTER_PROMPT.md`의 내용을 그대로 전달한다.
3. Codex가 아직 코드를 수정하지 않고 저장소 분석 보고서를 먼저 작성하게 한다.
4. 분석 보고서가 현재 구조와 실제 파일을 정확히 찾았는지 검토한다.
5. 승인 후 `09_IMPLEMENTATION_PLAN.md` 단계 순서대로 구현한다.
6. 각 단계가 끝날 때 `10_QA_ACCEPTANCE.md`로 검수한다.
7. 레퍼런스 이미지를 참고하되, 이미지 속 잘못된 예시 텍스트나 임의 값은 복사하지 않고 실제 데이터와 로직을 연결한다.

## 중요한 작업 원칙

- 기존 Production 기능과 데이터 연결을 깨지 않는다.
- 기존 API, Supabase 스키마, 벡터 계산, 추천 계산을 먼저 조사한다.
- 기능 로직을 임의로 재작성하지 않는다.
- V2를 별도 브랜치에서 작업한다.
- 한 번에 전체를 갈아엎지 않는다.
- 화면별 승인 단계를 둔다.
- 픽셀 복제보다 정보구조와 상호작용의 동일성이 우선이다.
- 레퍼런스의 스타일과 밀도는 유지하되 실제 데이터가 없는 값은 생성하지 않는다.

## 패키지 파일

- `00_CODEX_MASTER_PROMPT.md`: Codex에 처음 전달할 전체 명령
- `01_PRODUCT_SCOPE.md`: 제품 범위와 탭별 역할
- `02_FRONTEND_ARCHITECTURE.md`: 라우트·컴포넌트·상태 아키텍처
- `03_WIREFRAME_LAYOUT_SPEC.md`: 화면별 영역 크기와 배치
- `04_DESIGN_SYSTEM.md`: 색상·타이포·표면·그리드 규칙
- `05_COMPONENT_SPEC.md`: 컴포넌트별 요구사항
- `06_INTERACTION_MOTION_SPEC.md`: hover·선택·모핑·상태 전환
- `07_MAPBOX_DECKGL_H3_SPEC.md`: 공간 시각화와 지도 인터랙션
- `08_DATA_API_CONTRACT.md`: UI가 기대하는 데이터 계약
- `09_IMPLEMENTATION_PLAN.md`: 안전한 단계별 구현 순서
- `10_QA_ACCEPTANCE.md`: 최종 완료 기준
- `11_DO_NOT_CHANGE.md`: 금지사항과 보호 대상
- `12_CODE_REVIEW_PROMPT.md`: 구현 후 Codex 검수용 명령
- `styles/design-tokens.css`: CSS 변수 초안
- `styles/component-primitives.css`: 공통 UI CSS 초안
- `scaffolds/component-tree.txt`: 권장 컴포넌트 트리
- `scaffolds/ui-types.ts`: UI 타입 초안
