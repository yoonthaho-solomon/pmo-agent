# 1 To 6 Implementation Status

작성일: 2026-06-14

## 1. 기사-차량-앱미터 연결 완성

완료:

- `callcard_mbti.driver_id`, `callcard_mbti.vehicle_id` 보존.
- `driver_vehicle_map` 생성 및 정합성 검증 API 구축.
- CSV/XLSX 업로드로 기존 `driver_id + vehicle_id` 행에 `vehicle_no`, `driver_key`를 보강하는 `PATCH /api/driver-vehicle-map` 추가.
- 대시보드 데이터 적재 탭에 매핑 보강 UI 추가.

남음:

- 실제 `vehicle_no` 또는 앱미터 `driver_key`가 포함된 매핑 원천 파일 필요.
- 현재 확인된 앱미터 엑셀에는 `driver_key`는 있으나 콜카드 `driver_id/vehicle_id`와 직접 연결되는 차량번호 컬럼은 확인되지 않음.

## 2. 기사 22차원 벡터 재계산 고도화

완료:

- 기사 벡터 순서와 계산 기준을 `lib/matching-vector.ts`로 공통화.
- `/api/matching`의 중복 벡터 계산을 제거하고 공통 모듈 사용으로 변경.
- 기사 데이터 신뢰도는 UI와 시뮬레이터 점수 구성요소로 분리 표시.

남음:

- 앱미터 `driver_key`가 실제 기사에 연결된 뒤 운행패턴 기반 기사 벡터 재학습/보강 필요.

## 3. 콜카드 22차원 벡터 검증/보강

완료:

- `callToVector` 기준 콜카드 22차원 계산식 문서화.
- `/api/recommend` 응답에 `call_vector`와 점수 공식 추가.
- ETA near 계산식 명시.

남음:

- 라이브 콜카드 입력에서 `expected_distance`, `expected_fare`, `eta_distance`, `is_paid`, `is_surge`의 소스 계약 확정 필요.

## 4. 실데이터 추천 검증

완료:

- `GET /api/matching-verify?call_id=...` 추가.
- 실제 콜 1건 기준으로 `matching_scores` 저장 Top 10과 현재 즉시 계산 Top 10을 비교.
- 시뮬레이터에 저장 Top10 검증 버튼과 결과 패널 추가.

주의:

- 저장 Top10이 과거 계산식으로 저장된 경우 현재 공통 계산 결과와 차이가 날 수 있음.
- 차이가 나면 `/api/matching` 재계산 시점과 계산식 버전을 확인해야 함.

## 5. 시뮬레이터 운영형 전환

완료:

- 실제 콜카드 선택 후 조건 자동 적용.
- `/api/recommend`와 화면 공통 계산 Top 10 비교.
- 저장 Top10 검증 추가.
- 반경 확장, 온라인/공차/위치 최신성/수신 가능 필터는 시뮬레이션용 값으로 명시.
- 최종 배차점수는 고정하지 않고 ETA 점수, 코사인 유사도, 예상 수락확률, 기사 신뢰도, 향후 도착지역 가치, 향후 배차 균형 점수로 분리 표시.

남음:

- 실제 기사 위치/온라인 상태 데이터가 들어오면 시뮬레이션 값을 제거하고 실데이터 필터로 교체.

## 6. 라이브 배차 API 계약 설계

완료:

- `handoff/LIVE_DISPATCH_API_CONTRACT.md` 작성.
- `/api/recommend`, `/api/matching`, `/api/matching-verify`, `/api/driver-vehicle-map` 계약 초안 정리.
- 운영 배차 API 후보 흐름과 아직 필요한 데이터 항목 명시.

## 다음 최소 구현 단계

1. 실제 매핑 원천 파일 확보: `driver_id`, `vehicle_id`, `vehicle_no`, `driver_key`.
2. 대시보드에서 매핑 보강 업로드.
3. `vehicle_no_rows`, `driver_key_rows` 증가 확인.
4. 앱미터 운행패턴을 `driver_vehicle_map.driver_key` 기준으로 기사 벡터 재계산에 반영.
5. 실제 위치/온라인 상태 테이블 또는 API 계약 확정.
6. 운영용 `/api/dispatch/recommend`를 별도 신규 API로 설계/구현.
