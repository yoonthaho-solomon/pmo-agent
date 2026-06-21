# Live Dispatch API Contract

작성일: 2026-06-15
대상: PMO AI 우선배차 라이브서비스 개발자 연동 계약 초안

## 현재 확정된 원칙

- 기존 22차원 기사 벡터와 콜카드 벡터를 유지한다.
- 기본 추천 점수는 아직 22D 코사인 유사도 중심으로 유지한다.
- 저장형 `/api/matching`과 즉시형 `/api/recommend`는 공통 `lib/matching-vector.ts` 계산식을 사용한다.
- `call_risk_score`는 현재 배차점수에 섞지 않고, 화면에서 독립 지표로 비교한다.
- 실시간 위치, 온라인, 공차, 위치 최신성, 콜 수신 가능 상태는 아직 운영 데이터가 없으므로 시뮬레이터 값과 라이브 로직을 분리한다.
- 시뮬레이터의 거리, ETA, 온라인 상태는 정책 비교용 값이다. 라이브 전환 시 `driver_realtime_state` 또는 외부 위치 API로 교체한다.

## 현재 완료된 위험도 축

`GET /api/callcard-outcomes`는 실제 `callcard_mbti.status_group` 기준으로 읽기 전용 outcome 통계를 계산한다.

지원 축:

- `hour`: 시간대
- `distance`: 거리 구간
- `fare`: 요금 구간
- `paid`: 유료/무료
- `surge`: 탄력/일반
- `s_area`: 출발 권역
- `d_area`: 도착 권역

`problem_rate = (expired + canceled) / total`이다.

`call_risk_score` 현재 계산식:

```text
0.35*time + 0.20*distance + 0.20*fare + 0.15*paid + 0.10*surge
```

출발/도착권역은 표본 검증 전이라 별도 참고축으로만 표시한다. `s_area`, `d_area`가 비어 있으면 출발/도착 경위도를 0.01도 격자로 묶어 읽기 계산한다.

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

## 제안 테이블: `driver_realtime_state`

목적: Uber식 후보 생성과 상태 필터를 실데이터로 전환하기 위한 기사 현재 상태 테이블.

이 테이블은 기사 성향 데이터가 아니라 순간 상태 데이터다. 짧은 TTL을 가진 최신 상태로 취급한다.

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---:|---|
| driver_id | TEXT | Y | 기사 ID. `driver_mbti.driver_id`와 연결 |
| asp_id | BIGINT | Y | 지역 ASP ID. 예: `137000000000` |
| vehicle_id | TEXT | N | 호출데이터의 차량 ID |
| vehicle_no | TEXT | N | 실제 차량번호가 있으면 저장 |
| lat | DOUBLE PRECISION | Y | 기사 현재 위도 |
| lng | DOUBLE PRECISION | Y | 기사 현재 경도 |
| location_updated_at | TIMESTAMPTZ | Y | 위치 수신 시각 |
| online_status | BOOLEAN | Y | 앱 온라인 여부 |
| empty_status | BOOLEAN | Y | 공차 여부 |
| can_receive_call | BOOLEAN | Y | 콜 수신 가능 여부 |
| current_trip_status | TEXT | N | `idle`, `assigned`, `pickup`, `on_trip`, `offline` 등 |
| last_call_id | TEXT | N | 마지막 배차/수신 콜 ID |
| source | TEXT | N | 상태 출처: driver_app, dispatch_server, simulator 등 |
| created_at | TIMESTAMPTZ | Y | 생성 시각 |
| updated_at | TIMESTAMPTZ | Y | 갱신 시각 |

권장 PK:

```sql
PRIMARY KEY (driver_id)
```

권장 인덱스:

```sql
CREATE INDEX idx_driver_realtime_state_asp_online
  ON driver_realtime_state (asp_id, online_status, empty_status, can_receive_call);

CREATE INDEX idx_driver_realtime_state_location_updated
  ON driver_realtime_state (location_updated_at DESC);
```

PostGIS를 도입하면 위치 인덱스는 `geography(Point, 4326)` + `GIST`가 가장 좋다. PostGIS를 당장 쓰지 않으면 1차 버전은 lat/lng bounding box로 후보를 줄이고 앱 서버에서 haversine 거리 계산을 한다.

## 상태 필터 규칙 초안

후보 기사는 아래 조건을 모두 만족해야 한다.

- `asp_id`가 콜카드 ASP와 일치
- `online_status = true`
- `empty_status = true`
- `can_receive_call = true`
- `location_updated_at >= now() - interval '90 seconds'`
- 호출 위치 기준 1차 반경 안에 있음

반경 확장:

1. 1차 반경: 기본 3km
2. 2차 반경: 6km
3. 3차 반경: 9km

실제 운영에서는 km 고정값 대신 ETA 기반으로 바꿀 수 있다.

## 제안 API: `POST /api/dispatch/recommend`

목적: 라이브 배차 후보를 생성하고 발송 순서를 반환하는 운영용 신규 API. 기존 `/api/recommend`는 22D 계산 검증용으로 유지한다.

### Request

```json
{
  "callcard_id": "optional-existing-call-id",
  "asp_id": 137000000000,
  "request_datetime": "2026-06-15T10:00:00+09:00",
  "passenger_lat": 36.8151,
  "passenger_lng": 127.1139,
  "dest_lat": 36.8001,
  "dest_lng": 127.1201,
  "expected_distance": 5200,
  "expected_fare": 13000,
  "is_paid": false,
  "is_surge": false,
  "eta_distance": 240,
  "s_hexagon": "optional-start-h3",
  "d_hexagon": "optional-dest-h3",
  "max_candidates": 10,
  "radius_steps_km": [3, 6, 9]
}
```

### Processing

1. 콜카드 입력을 22D 콜 벡터로 변환
2. `driver_realtime_state`에서 ASP/상태/위치 최신성 필터 적용
3. 호출 위치 기준 1차 반경 후보 생성
4. 후보가 부족하거나 미수락이면 2차, 3차 반경 확장
5. 후보별 `driver_mbti` 조회
6. 22D 코사인 유사도 계산
7. ETA 점수, 기사 신뢰도, 예상 수락확률, `call_risk_score`를 분리 계산
8. 최종 발송 순서 반환

### Response

```json
{
  "callcard_id": "call-id",
  "asp_id": 137000000000,
  "radius_step_used_km": 3,
  "candidate_counts": {
    "nearby": 52,
    "available": 31,
    "ranked": 10
  },
  "call_risk_score": 0.4941,
  "score_formula_version": "dispatch_v0_explain_only",
  "recommended_drivers": [
    {
      "rank": 1,
      "driver_id": "driver-id",
      "vehicle_id": "vehicle-id",
      "distance_km": 1.2,
      "eta_seconds": 240,
      "vector_cosine": 0.8123,
      "eta_score": 0.73,
      "acceptance_probability": 0.61,
      "driver_reliability": 0.8,
      "call_risk_score": 0.4941,
      "final_score": 0.8123,
      "score_components": {
        "cosine": 0.8123,
        "eta": 0.73,
        "acceptance": 0.61,
        "reliability": 0.8,
        "destination_value": null,
        "dispatch_balance": null
      },
      "status_snapshot": {
        "online_status": true,
        "empty_status": true,
        "can_receive_call": true,
        "location_updated_at": "2026-06-15T09:59:30+09:00"
      }
    }
  ]
}
```

`final_score`는 초기 라이브 버전에서 코사인 중심으로 시작하고, ETA/수락확률/위험도는 설명 가능한 구성요소로 먼저 노출한다. 충분히 검증한 뒤 가중치 정책을 별도 버전으로 올린다.

## 기존 API 역할

### `/api/recommend`

- 즉시형 22D 추천 검증 API
- 실시간 위치/상태 필터는 아직 없음
- `call_vector`, `vector_cosine`, `start_area_bonus`, `final_score` 반환

### `/api/matching`

- 날짜 단위 저장형 배치 API
- `matching_scores`에 Top 10 저장
- 운영 배차 호출의 실시간 응답 API로 직접 쓰지 않음

### `/api/matching-verify`

- 저장 Top 10과 현재 공통 계산 Top 10 비교
- 읽기 전용 검증 API

### `/api/callcard-outcomes`

- 실제 outcome 기반 위험도 조회 API
- ASP/date/group_by 필터 지원
- 읽기 전용

## 운영 전 남은 결정

- `driver_realtime_state`를 Supabase 테이블로 만들지, 외부 기사앱/관제 API에서 직접 읽을지 결정
- 위치 거리 계산을 PostGIS로 할지, 앱 서버 haversine으로 시작할지 결정
- 위치 최신성 TTL: 현재 초안 90초
- 반경 확장 기준: 3/6/9km 또는 ETA 기준
- `call_risk_score`를 최종 점수에 언제 반영할지 검증 기준 설정
- 출발/도착권역 위험도에 smoothing과 최소 표본 수 기준 적용
