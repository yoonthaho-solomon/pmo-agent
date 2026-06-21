# CODEX MASTER PROMPT — KONAMOBILITY V2

현재 저장소의 프론트엔드를 첨부된 3장의 V2 레퍼런스 화면과 동일한 제품 구조로 리뉴얼하라.

## 레퍼런스 화면

- `assets/reference/01_DATA_OPS_CONSOLE_REFERENCE.png`
- `assets/reference/02_VECTOR_WORKBENCH_REFERENCE.png`
- `assets/reference/03_MATCHING_STUDIO_REFERENCE.png`

레퍼런스는 단순한 분위기 참고 이미지가 아니다. 다음 항목의 구현 기준이다.

- 정보구조
- 레이아웃 비율
- 패널 우선순위
- 컴포넌트 밀도
- 색상 역할
- 지도 중심 상호작용
- 선택/hover/필터/인스펙터 연결
- 데이터 그리드와 시각화의 관계

다만 이미지 안의 샘플 ID, 주소, 수치, 날짜는 더미 예시다. 실제 시스템 데이터와 현재 로직을 연결해야 하며, 더미 값을 Production 화면에 하드코딩하면 안 된다.

---

# 1. 첫 응답에서는 코드를 수정하지 말 것

먼저 저장소를 조사하고 아래 보고서를 작성하라.

## A. 현재 프로젝트 구조
- framework 및 버전
- app/pages router 여부
- 라우트 목록
- 현재 3개 화면과 연결된 파일
- 공통 layout/header/navigation 파일
- 전역 스타일, Tailwind, CSS module 위치
- 공통 UI 컴포넌트 위치

## B. 데이터 흐름
- Supabase client 위치
- 사용 중인 환경변수 이름
- 호출데이터 적재 상태 API/쿼리
- 앱미터데이터 적재 상태 API/쿼리
- driver vector / driver_mbti 조회
- callcard vector 조회
- matching/simulation API
- Mapbox 관련 코드
- H3 관련 코드
- 추천 점수 산식이 구현된 위치

## C. 유지해야 할 기존 기능
- 현재 정상 동작하는 데이터 조회
- 현재 벡터 계산
- 현재 추천 계산
- 실데이터와 더미 데이터 구분
- 기존 권한/RLS/API 보호 방식

## D. 변경 계획
- 수정할 파일
- 새로 만들 파일
- 삭제하지 않고 재사용할 코드
- 리스크
- 단계별 구현 순서

보고서 제출 전에는 UI나 로직을 변경하지 말라.

---

# 2. 승인 후 작업 원칙

- 별도 브랜치를 만든다.
- V1 화면을 백업하거나 라우트/태그로 보존한다.
- API와 DB를 먼저 변경하지 않는다.
- UI부터 구조적으로 분리하고 기존 응답을 어댑터로 연결한다.
- 각 화면은 독립적으로 완료하고 검수한다.
- 대규모 단일 커밋 금지.
- 단계별 소규모 커밋.
- 각 단계 후 build, typecheck, lint, 해당 화면 실행 확인.
- Production 배포는 최종 승인 후에만 한다.

---

# 3. 화면 이름과 역할

기존 탭명이 무엇이든 UI에서는 다음 제품 작업공간으로 정리한다.

1. **데이터 운영**
   - 데이터가 언제, 얼마나, 정상적으로 수집되었는지 확인
   - 날짜×데이터셋 매트릭스
   - 선택 셀 상세
   - 활용 가능한 데이터 카탈로그

2. **벡터 워크벤치**
   - 콜카드 벡터와 기사 운행 벡터의 팩터 구조 비교
   - 매트릭스, 차이, 기여도, 관계 맵
   - 선택 팩터 인스펙터
   - 코사인 유사도와 축별 기여도

3. **매칭 스튜디오**
   - 콜 조건 입력 또는 지도 출발/도착 선택
   - 경로·거리·승객 예상시간 산출
   - H3 공간 적합도
   - 기사 위치·픽업 ETA
   - Top 10 후보
   - 선택 기사 점수 근거

---

# 4. 구현 기준 문서

아래 문서를 모두 읽고 상충할 경우 우선순위를 적용한다.

1. `11_DO_NOT_CHANGE.md`
2. `01_PRODUCT_SCOPE.md`
3. `03_WIREFRAME_LAYOUT_SPEC.md`
4. `08_DATA_API_CONTRACT.md`
5. `07_MAPBOX_DECKGL_H3_SPEC.md`
6. `05_COMPONENT_SPEC.md`
7. `04_DESIGN_SYSTEM.md`
8. `06_INTERACTION_MOTION_SPEC.md`
9. `09_IMPLEMENTATION_PLAN.md`
10. 레퍼런스 이미지

---

# 5. 요구 기술 방향

현재 저장소 구조를 우선 존중한다. 필요한 경우 아래 기술을 활용한다.

- React / Next.js / TypeScript
- Mapbox GL JS
- deck.gl
- h3-js
- Framer Motion
- Zustand 또는 현재 상태관리
- TanStack Query 또는 현재 fetch 방식
- CSS Variables + 현재 Tailwind/CSS 시스템

라이브러리는 실제 필요할 때만 추가한다.

공간 시각화에서 deck.gl과 Mapbox를 결합할 경우 `MapboxOverlay` 기반의 동기화 구조를 우선 검토한다. H3는 `H3HexagonLayer` 또는 GeoJSON 경계 레이어를 사용하고, 현재 데이터량과 정확도에 따라 선택한다.

---

# 6. 완료 보고 형식

각 단계가 끝나면 다음을 보고하라.

```text
[단계명]

1. 변경 파일
2. 구현 내용
3. 유지한 기존 로직
4. 테스트 결과
5. 화면 캡처 경로
6. 남은 이슈
7. 다음 단계
```

완료했다고 주장하기 전에 `10_QA_ACCEPTANCE.md`의 모든 필수 항목을 확인하라.
