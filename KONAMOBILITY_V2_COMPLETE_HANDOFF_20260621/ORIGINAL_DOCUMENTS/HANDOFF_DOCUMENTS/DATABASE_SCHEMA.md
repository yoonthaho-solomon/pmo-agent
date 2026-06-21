# DATABASE_SCHEMA.md

## 개요

Supabase(PostgreSQL) 기반. migration 파일 위치: `supabase/migrations/`

---

## 1. `agent_logs`

**Migration**: `20260611_agent_logs.sql`  
**역할**: 모든 API 에이전트의 실행 이력 기록 (성공/실패, 소요시간)  
**작성 위치**: `lib/agent-logger.ts → logAgentRun()`  
**실제 사용 여부**: ✅ 모든 API route에서 호출

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGSERIAL | PK (자동 증가) |
| run_date | DATE NOT NULL | 실행 날짜 |
| agent_name | TEXT NOT NULL | 에이전트명 (analyze, driver-logs, callcard-mbti 등) |
| input_rows | INTEGER DEFAULT 0 | 처리한 행 수 |
| status | TEXT NOT NULL | 'success' 또는 'failed' |
| duration_ms | INTEGER DEFAULT 0 | 소요 시간 (ms) |
| error_msg | TEXT NULL | 오류 메시지 |
| created_at | TIMESTAMPTZ DEFAULT NOW() | 생성 시각 |

**인덱스**: `run_date DESC`, `agent_name`, `status`  
**관계**: 독립 테이블 (FK 없음)  
**데이터 건수**: 실행 횟수에 비례, INSERT 전용

---

## 2. `daily_snapshots`

**Migration**: `20260611_daily_snapshots.sql`  
**역할**: ASP별 일일 KPI 스냅샷 + Claude AI 요약 저장  
**작성 API**: `POST /api/analyze`  
**실제 사용 여부**: ✅ 홈 화면 KPI 카드, `/dashboard` 트렌드 차트

| 컬럼 | 타입 | 설명 |
|------|------|------|
| asp_id | INTEGER NOT NULL | ASP 식별자 |
| service_date | DATE NOT NULL | 서비스 날짜 |
| total_calls | INTEGER DEFAULT 0 | 전체 콜 수 |
| success_count | INTEGER DEFAULT 0 | 성공(수락) 수 |
| expired_count | INTEGER DEFAULT 0 | 만료 수 |
| canceled_count | INTEGER DEFAULT 0 | 취소 수 |
| success_rate | FLOAT DEFAULT 0 | 성공률 (%) |
| surge_call_cnt | INTEGER DEFAULT 0 | 서지 콜 수 |
| avg_accept_eta | FLOAT NULL | 평균 수락 ETA (초) |
| ai_summary | TEXT NULL | Claude AI 생성 한국어 요약 |
| created_at | TIMESTAMPTZ | 생성 시각 |
| updated_at | TIMESTAMPTZ | 갱신 시각 (트리거 자동) |

**PK**: `(asp_id, service_date)` (복합)  
**인덱스**: `service_date DESC`, `asp_id`  
**트리거**: `trg_daily_snapshots_updated_at` — UPDATE 시 updated_at 자동 갱신

---

## 3. `driver_daily_logs`

**Migration**: `20260611_driver_daily_logs.sql`  
**역할**: 기사별 일일 콜 수신/수락 집계 (원천 이력)  
**작성 API**: `POST /api/driver-logs`  
**읽기 API**: `POST /api/driver-mbti`  
**실제 사용 여부**: ✅ driver_mbti 생성 원천 데이터

| 컬럼 | 타입 | 설명 |
|------|------|------|
| driver_id | TEXT NOT NULL | 기사 ID |
| asp_id | INTEGER NOT NULL | ASP ID (단축형, 예: 137) |
| service_date | DATE NOT NULL | 서비스 날짜 |
| weekday | SMALLINT NOT NULL | JS getDay() 기준: 0=일, 1=월~6=토 |
| total_received | INTEGER DEFAULT 0 | 수신 콜 수 |
| total_accepted | INTEGER DEFAULT 0 | 수락 콜 수 |
| total_expired | INTEGER DEFAULT 0 | 만료 콜 수 |
| accept_rate | FLOAT DEFAULT 0 | 수락률 |
| accepted_hours | SMALLINT[] DEFAULT '{}' | 수락한 콜의 시간대 배열 |
| accepted_s_areas | TEXT[] DEFAULT '{}' | 수락 콜 출발지 지역명 배열 |
| accepted_d_areas | TEXT[] DEFAULT '{}' | 수락 콜 도착지 지역명 배열 |
| accepted_s_hexagons | TEXT[] DEFAULT '{}' | 수락 콜 출발지 헥사곤 배열 |
| accepted_d_hexagons | TEXT[] DEFAULT '{}' | 수락 콜 도착지 헥사곤 배열 |
| rejected_s_hexagons | TEXT[] DEFAULT '{}' | 만료 콜 출발지 헥사곤 배열 |
| rejected_d_hexagons | TEXT[] DEFAULT '{}' | 만료 콜 도착지 헥사곤 배열 |
| avg_distance | FLOAT NULL | 수락 콜 평균 거리 (미터) |
| avg_fare | FLOAT NULL | 수락 콜 평균 요금 (원) |
| paid_accepted | INTEGER DEFAULT 0 | 유료콜 수락 수 |
| free_accepted | INTEGER DEFAULT 0 | 무료콜 수락 수 |
| low_fare_cnt | INTEGER DEFAULT 0 | 저요금 콜 수락 수 (≤10000원) |
| mid_fare_cnt | INTEGER DEFAULT 0 | 중요금 콜 수락 수 (10001~20000원) |
| high_fare_cnt | INTEGER DEFAULT 0 | 고요금 콜 수락 수 (>20000원) |
| product_normal_cnt | INTEGER DEFAULT 0 | 일반요금 콜 수락 수 |
| product_night_cnt | INTEGER DEFAULT 0 | 심야요금 콜 수락 수 |
| product_surge_cnt | INTEGER DEFAULT 0 | 탄력요금 콜 수락 수 |
| short_cnt | INTEGER DEFAULT 0 | 단거리 콜 수락 수 (≤3000m) |
| medium_cnt | INTEGER DEFAULT 0 | 중거리 콜 수락 수 (3001~8000m) |
| long_cnt | INTEGER DEFAULT 0 | 장거리 콜 수락 수 (>8000m) |
| avg_accept_eta | FLOAT NULL | 평균 수락 ETA (초) |
| created_at / updated_at | TIMESTAMPTZ | 자동 관리 |

**PK**: `(driver_id, service_date)` (복합)  
**인덱스**: `asp_id`, `service_date`, `driver_id`  
**트리거**: `trg_driver_daily_logs_updated_at`

---

## 4. `driver_mbti`

**Migration**: `20260611_driver_mbti.sql`  
**역할**: 기사별 30일 가중 누적 프로파일 (22차원 확률 벡터)  
**작성 API**: `POST /api/driver-mbti`  
**읽기 API**: `POST /api/matching`, `POST /api/recommend`, `/simulator` 페이지  
**실제 사용 여부**: ✅ 핵심 매칭 원천

| 컬럼 | 타입 | 설명 |
|------|------|------|
| driver_id | TEXT | PK |
| asp_id | INTEGER NOT NULL | ASP ID (장형, 예: 137000000000) |
| score_dawn | FLOAT DEFAULT 0 | 새벽(0~5시) 수락 비중 |
| score_morning | FLOAT DEFAULT 0 | 오전(6~11시) 수락 비중 |
| score_daytime | FLOAT DEFAULT 0 | 낮(12~17시) 수락 비중 |
| score_night | FLOAT DEFAULT 0 | 야간(18~23시) 수락 비중 |
| score_sun | FLOAT DEFAULT 0 | 일요일 수락 비중 (주의: 컬럼 순서가 mon보다 앞) |
| score_mon | FLOAT DEFAULT 0 | 월요일 수락 비중 |
| score_tue ~ score_sat | FLOAT DEFAULT 0 | 각 요일 |
| score_short | FLOAT DEFAULT 0 | 단거리(≤3000m) 비중 |
| score_medium | FLOAT DEFAULT 0 | 중거리(3001~8000m) 비중 |
| score_long | FLOAT DEFAULT 0 | 장거리(>8000m) 비중 |
| score_low_fare | FLOAT DEFAULT 0 | 저요금(≤10000원) 비중 |
| score_mid_fare | FLOAT DEFAULT 0 | 중요금(10001~20000원) 비중 |
| score_high_fare | FLOAT DEFAULT 0 | 고요금(>20000원) 비중 |
| score_paid | FLOAT DEFAULT 0 | 유료콜 수락 비중 |
| score_free | FLOAT DEFAULT 0 | 무료콜 수락 비중 |
| score_surge | FLOAT DEFAULT 0 | 탄력요금 콜 수락 비중 |
| score_normal | FLOAT DEFAULT 0 | 일반요금 콜 수락 비중 |
| score_near | FLOAT DEFAULT 0 | 가까운 배차 비중 (ETA 가중) |
| pref_s_hexagons | TEXT[] DEFAULT '{}' | 선호 출발지 헥사곤 Top 3 |
| pref_d_hexagons | TEXT[] DEFAULT '{}' | 선호 도착지 헥사곤 Top 3 |
| data_days | INTEGER DEFAULT 0 | 실제 데이터 있는 날 수 |
| reliability | FLOAT DEFAULT 0 | min(data_days/30, 1.0) |
| created_at / updated_at | TIMESTAMPTZ | 자동 관리 |

**인덱스**: `asp_id`  
**트리거**: `trg_driver_mbti_updated_at`  
**주의**: migration 코멘트에 `score_sun`이 `score_mon` 앞에 정의되어 있으나,
API 코드는 named field로 접근하므로 순서 무관

---

## 5. `callcard_mbti`

**Migration**: `20260611_callcard_mbti.sql`  
**역할**: 콜 단위 속성 + 암묵적 22차원 벡터 원천 데이터  
**작성 API**: `POST /api/callcard-mbti`  
**읽기 API**: `POST /api/matching`, `POST /api/callcard-mbti-compute`  
**실제 사용 여부**: ✅ 매칭의 콜카드 측 원천

| 컬럼 | 타입 | 설명 |
|------|------|------|
| callcard_id | TEXT | PK |
| asp_id | INTEGER NOT NULL | ASP ID (장형) |
| call_date | DATE NOT NULL | 콜 날짜 |
| hour_slot | SMALLINT (0~23) | 시간대 |
| weekday | SMALLINT (0~6) | 0=월~6=일 (한국 기준) |
| s_area | TEXT DEFAULT '' | 출발지 지역명 |
| s_hexagon | TEXT DEFAULT '' | 출발지 헥사곤 코드 |
| d_area | TEXT DEFAULT '' | 도착지 지역명 |
| d_hexagon | TEXT DEFAULT '' | 도착지 헥사곤 코드 |
| expected_distance | INTEGER DEFAULT 0 | 예상 거리 (미터) |
| expected_fare | INTEGER DEFAULT 0 | 예상 요금 (원) |
| is_paid | BOOLEAN DEFAULT FALSE | 유료콜 여부 |
| eta_distance | INTEGER NULL | 배차 ETA (초), NULL 가능 |
| product_type | TEXT DEFAULT '' | 상품 유형 |
| is_surge | BOOLEAN DEFAULT FALSE | 탄력요금 여부 |
| urgency_score | FLOAT DEFAULT 0.0 | 긴급도 점수 |
| created_at / updated_at | TIMESTAMPTZ | 자동 관리 |

**인덱스**: `call_date`, `asp_id`, `s_hexagon`, `d_hexagon`  
**트리거**: `trg_callcard_mbti_updated_at`

---

## 6. `callcard_profile`

**Migration**: `20260611_callcard_profile.sql`  
**역할**: ASP별 콜 수요 프로파일 (driver_mbti와 동일 구조, 집계 단위만 다름)  
**작성 API**: `POST /api/callcard-mbti-compute`  
**실제 사용 여부**: ⚠️ 적재는 되나 현재 매칭에는 직접 사용 안 됨 (향후 활용 예정)

컬럼 구조: `driver_mbti`와 동일 + `total_calls`, `data_days`, `reliability`  
**PK**: `asp_id` (단일)

---

## 7. `matching_scores`

**Migration**: `20260611_matching_scores.sql`  
**역할**: 콜카드별 추천 기사 Top 10 저장 (배치 매칭 결과)  
**작성 API**: `POST /api/matching`  
**갱신 API**: `PATCH /api/matching` (was_sent, was_accepted 피드백)  
**실제 사용 여부**: ✅ 배치 매칭 결과 저장

| 컬럼 | 타입 | 설명 |
|------|------|------|
| call_id | TEXT NOT NULL | 콜카드 ID |
| driver_id | TEXT NOT NULL | 기사 ID |
| asp_id | INTEGER NOT NULL | ASP ID |
| match_date | DATE NOT NULL | 매칭 날짜 |
| cosine_score | FLOAT NOT NULL | 코사인 유사도 (0~1) |
| rank_in_call | INTEGER (1~10) | 해당 콜 내 순위 |
| was_sent | BOOLEAN DEFAULT FALSE | 실제 발송 여부 |
| was_accepted | BOOLEAN DEFAULT FALSE | 기사 수락 여부 |
| created_at / updated_at | TIMESTAMPTZ | 자동 관리 |

**PK**: `(call_id, driver_id)` (복합)  
**인덱스**: `match_date`, `call_id`, `driver_id`, `(match_date, rank_in_call)`  
**트리거**: `trg_matching_scores_updated_at`

---

## 8. `meter_daily_logs`

**Migration**: `20260612_meter_daily_logs.sql`  
**역할**: 미터기 기반 기사 일별 운행 통계 (천안 행복콜)  
**작성 API**: `POST /api/meter-logs`  
**실제 사용 여부**: ✅ 적재 완료, 분석 활용은 미구현

| 컬럼 | 타입 | 설명 |
|------|------|------|
| driver_key | TEXT NOT NULL | 미터기 기사 키 (driver_id와 별도) |
| service_date | DATE NOT NULL | 서비스 날짜 |
| asp_id | BIGINT DEFAULT 147000000000 | ASP ID (천안 고정) |
| start_hour | FLOAT NULL | 운행 시작 시각 |
| work_hour | FLOAT NULL | 근무 시간 (시간) |
| travel_min | FLOAT NULL | 주행 시간 (분) |
| dist_km | FLOAT NULL | 총 주행 거리 (km) |
| empty_km | FLOAT NULL | 공차 거리 (km) |
| ride_count | INTEGER NULL | 운행 건수 |
| earning | FLOAT NULL | 총 매출 |
| earning_streethail | FLOAT NULL | 일반(길거리) 매출 |
| earning_platform | FLOAT NULL | 플랫폼 매출 |
| drive_rate | FLOAT NULL | 가동률 |
| earning_per_hour | FLOAT NULL | 시간당 매출 |
| street_ratio | FLOAT NULL | earning_streethail / earning |
| platform_ratio | FLOAT NULL | earning_platform / earning |
| hourly_rides | JSONB DEFAULT '{}' | 시간대별 운행 건수 {"0":2,...,"23":1} |
| hourly_platform | JSONB DEFAULT '{}' | 시간대별 플랫폼 운행 건수 |
| driver_id | TEXT NULL | 향후 driver_daily_logs 조인용 |
| created_at / updated_at | TIMESTAMPTZ | 자동 관리 |

**PK**: `(driver_key, service_date)` (복합)  
**인덱스**: `service_date`, `asp_id`, `driver_id`

---

## 미확인 테이블 (코드 참조 있으나 migration 없음)

| 테이블명 | 참조 위치 | 상태 |
|----------|----------|------|
| `meter_hourly_logs` | `/api/meter-excel/route.ts` | migration 없음, Supabase 직접 생성 필요 |
| `meter_driver_logs` | `/api/meter-excel/route.ts` | migration 없음, Supabase 직접 생성 필요 |
| `callcard_patterns` | 코드에 없음 | 미구현 |
| `driver_profiles` | 코드에 없음 | 미구현 |
| `dispatch_proposals` | 코드에 없음 | 미구현 |

---

## RLS (Row Level Security)

- 대부분 API: `NEXT_PUBLIC_SUPABASE_ANON_KEY` 사용 → RLS 적용 대상
- `/api/meter-excel`: `SUPABASE_SERVICE_ROLE_KEY` 사용 → RLS 우회
- 실제 RLS 정책은 Supabase 대시보드에서 확인 필요 (코드에 정의 없음)

## RPC / View / Function

각 테이블에 `updated_at` 자동 갱신 트리거 함수 존재:
- `update_callcard_mbti_updated_at()`
- `update_daily_snapshots_updated_at()`
- `update_driver_daily_logs_updated_at()`
- `update_driver_mbti_updated_at()`
- `update_matching_scores_updated_at()`
- `update_callcard_profile_updated_at()`
- `update_meter_daily_logs_updated_at()`

추가 RPC/View: 코드에서 사용 없음 (Supabase 대시보드 직접 확인 필요)
