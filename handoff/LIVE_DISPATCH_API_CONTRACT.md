# Live Dispatch API Contract

작성일: 2026-06-14
대상: PMO AI 우선배차 라이브서비스 개발자 연동 계약 초안

## 현재 확정된 원칙

- 기존 22차원 기사 벡터와 콜카드 벡터를 유지한다.
- 기본 추천 점수는 `final_score = min(vector_cosine + start_area_bonus, 1)`이다.
- 실시간 위치, 온라인, 공차, 위치 최신성, 콜 수신 가능 상태는 아직 운영 데이터가 없으므로 매칭 점수에 섞지 않는다.
- 시뮬레이터의 거리, ETA, 온라인 상태는 정책 비교용 시뮬레이션 값이다.
- 저장형 `/api/matching`과 즉시형 `/api/recommend`는 공통 `lib/matching-vector.ts` 계산식을 사용해야 한다.

## 22차원 벡터 순서

| index | key | group | callcard calculation |
|---:|---|---|---|
| 0 | score_dawn | 시간대 | `hour_slot <= 5 ? 1 : 0` |
| 1 | score_morning | 시간대 | `6 <= hour_slot <= 11 ? 1 : 0` |
| 2 | score_daytime | 시간대 | `12 <= hour_slot <= 17 ? 1 : 0` |
| 3 | score_night | 시간대 | `hour_slot >= 18 ? 1 : 0` |
| 4 | score_mon | 요일 | `weekday === 0 ? 1 : 0` |
| 5 | score_tue | 요일 | `weekday === 1 ? 1 : 0` |
| 6 | score_wed | 요일 | `weekday === 2 ? 1 : 0` |
| 7 | score_thu | 요일 | `weekday === 3 ? 1 : 0` |
| 8 | score_fri | 요일 | `weekday === 4 ? 1 : 0` |
| 9 | score_sat | 요일 | `weekday === 5 ? 1 : 0` |
| 10 | score_sun | 요일 | `weekday === 6 ? 1 : 0` |
| 11 | score_short | 거리 | `0 < expected_distance <= 3000 ? 1 : 0` |
| 12 | score_medium | 거리 | `3000 < expected_distance <= 8000 ? 1 : 0` |
| 13 | score_long | 거리 | `expected_distance > 8000 ? 1 : 0` |
| 14 | score_low_fare | 요금 | `0 < expected_fare <= 10000 ? 1 : 0` |
| 15 | score_mid_fare | 요금 | `10000 < expected_fare <= 20000 ? 1 : 0` |
| 16 | score_high_fare | 요금 | `expected_fare > 20000 ? 1 : 0` |
| 17 | score_paid | 콜유형 | `is_paid ? 1 : 0` |
| 18 | score_free | 콜유형 | `is_paid ? 0 : 1` |
| 19 | score_surge | 상품 | `is_surge ? 1 : 0` |
| 20 | score_normal | 상품 | `is_surge ? 0 : 1` |
| 21 | score_near | ETA | `etaToNear(eta_distance)` |

`etaToNear`: `eta <= 150초`는 1, `eta >= 600초`는 0, 중간은 선형 감소.

## `/api/recommend`

### Request

```json
{
  "asp_id": 137000000000,
  "hour_slot": 14,
  "weekday": 2,
  "expected_distance": 5200,
  "expected_fare": 13000,
  "is_paid": false,
  "is_surge": false,
  "eta_distance": 240,
  "s_hexagon": "optional-start-h3",
  "d_hexagon": "optional-dest-h3"
}
```

### Response

```json
{
  "asp_id": 137000000000,
  "driver_pool_size": 1234,
  "call_vector": [0, 0, 1],
  "score_formula": "final_score = min(vector_cosine + start_area_bonus, 1)",
  "recommended_drivers": [
    {
      "rank": 1,
      "driver_id": "driver-id",
      "cosine_score": 0.8123,
      "vector_cosine": 0.8123,
      "start_area_bonus": 0,
      "final_score": 0.8123,
      "match_reason": "낮 시간대 전문 기사"
    }
  ]
}
```

`cosine_score`는 기존 호환 필드로 유지한다. 신규 연동은 `vector_cosine`, `start_area_bonus`, `final_score`를 사용한다.

## `/api/matching`

- `POST { "call_date": "YYYY-MM-DD" }`
- 해당 날짜의 `callcard_mbti` 전체에 대해 Top 10을 계산하고 `matching_scores`에 저장한다.
- 현재는 저장형 배치 API이므로 운영 배차 호출의 실시간 응답 API로 직접 쓰지 않는다.

## `/api/matching-verify`

- `GET /api/matching-verify?call_id={callcard_id}`
- 실제 콜 1건 기준으로 `matching_scores` 저장 Top 10과 현재 공통 계산 Top 10을 비교한다.
- 읽기 전용 검증 API다.

## `/api/driver-vehicle-map`

- `GET`: 매핑 행 수, 차량번호 보강 수, 앱미터 키 보강 수 조회
- `GET ?detail=1`: callcard 원천과 매핑 테이블 상세 정합성 조회
- `POST`: `callcard_mbti.driver_id + vehicle_id` 기준으로 매핑 테이블 재생성/보강
- `PATCH`: CSV/XLSX로 기존 매핑 행에 `vehicle_no`, `driver_key` 보강

필수 업로드 컬럼:

- `driver_id`
- `vehicle_id`
- `vehicle_no` 또는 `driver_key`

## 운영 배차 API 후보 흐름

1. 콜카드 수신
2. 후보 기사 생성: 호출 위치 주변 기사 또는 ASP 기사 풀
3. 실시간 상태 필터: 온라인, 공차, 위치 최신성, 콜 수신 가능
4. 22D 벡터 변환
5. 코사인 유사도 계산
6. 출발권역 보너스 적용
7. ETA, 수락확률, 신뢰도, 도착지역 가치, 배차 균형 점수는 별도 구성요소로 노출
8. 최종 Top N 반환

## 아직 필요한 데이터

- 기사 실시간 위치
- 기사 온라인 상태
- 공차 여부
- 위치 업데이트 시각
- 콜 수신 가능 상태
- `driver_id + vehicle_id`와 앱미터 `driver_key` 또는 실제 차량번호 연결 원천
- 도착지역 가치 산정 데이터
- 배차 균형 정책 파라미터
