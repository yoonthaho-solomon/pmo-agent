# ARCHITECTURE.md

## 전체 폴더 구조

```
pmo-agent/
├── app/                          # Next.js App Router 루트
│   ├── api/                      # API Routes (서버사이드)
│   │   ├── analyze/route.ts      # KPI 분석 + AI 요약
│   │   ├── callcard-mbti/route.ts          # 콜카드 벡터 생성
│   │   ├── callcard-mbti-compute/route.ts  # 콜카드 프로파일 집계
│   │   ├── driver-logs/route.ts            # 기사 일일 로그 적재
│   │   ├── driver-mbti/route.ts            # 기사 MBTI 프로파일 생성
│   │   ├── matching/route.ts               # 코사인 유사도 매칭
│   │   ├── meter-excel/route.ts            # 미터 시간대/기사별 통계
│   │   ├── meter-logs/route.ts             # 미터 기사 일별 통계
│   │   └── recommend/route.ts              # 실시간 기사 추천
│   ├── dashboard/page.tsx        # 누적 분석 대시보드
│   ├── simulator/page.tsx        # MBTI 매칭 시뮬레이터
│   ├── page.tsx                  # 홈 (일일 관제)
│   ├── layout.tsx                # 루트 레이아웃
│   ├── design-tokens.ts          # 디자인 시스템 색상/토큰
│   └── globals.css               # 전역 Tailwind 스타일
├── lib/
│   └── agent-logger.ts           # Supabase 실행 로그 유틸
├── supabase/
│   └── migrations/               # DB 마이그레이션 SQL
│       ├── 20260611_agent_logs.sql
│       ├── 20260611_callcard_mbti.sql
│       ├── 20260611_callcard_profile.sql
│       ├── 20260611_daily_snapshots.sql
│       ├── 20260611_driver_daily_logs.sql
│       ├── 20260611_driver_mbti.sql
│       ├── 20260611_matching_scores.sql
│       └── 20260612_meter_daily_logs.sql
├── .vercel/                      # Vercel 프로젝트 링크 정보
├── package.json
├── tsconfig.json
├── next.config.ts                # Next.js 설정 (빈 설정)
├── eslint.config.mjs
├── postcss.config.mjs
└── dashboard_design_guidelines.md  # 미커밋 파일
```

---

## 프론트엔드 → API → Supabase 데이터 흐름 (전체 개요)

```
[브라우저 (React Client Component)]
        │  FormData / JSON fetch
        ▼
[Next.js API Route (app/api/*/route.ts)]
        │  @supabase/supabase-js
        │  (anon key 또는 service_role key)
        ▼
[Supabase PostgreSQL]
        │
        ├── agent_logs          (모든 API → 실행 이력)
        ├── daily_snapshots     (analyze → KPI 스냅샷)
        ├── driver_daily_logs   (driver-logs → 기사 일별)
        ├── callcard_mbti       (callcard-mbti → 콜 벡터)
        ├── callcard_profile    (callcard-mbti-compute → ASP 프로파일)
        ├── driver_mbti         (driver-mbti → 기사 프로파일)
        ├── matching_scores     (matching → 추천 결과)
        └── meter_daily_logs    (meter-logs → 미터 통계)
```

---

## 호출데이터 적재 흐름

```
[엑셀 2종 업로드]
  - callcard_eta.xlsx   (콜 이벤트 + ETA 정보)
  - remapped.xlsx       (콜 속성 재매핑: 거리/요금/헥사곤 등)
        │
        ▼  POST /api/callcard-mbti (FormData: file1, file2)
[API: callcard-mbti/route.ts]
  1. xlsx.read() → 각 파일 Sheet1 파싱
  2. callcard_id 기준으로 두 시트 JOIN
  3. 각 콜에 대해 필드 추출:
     - asp_id, callcard_id, call_date, hour_slot
     - weekday (0=월~6=일 한국 기준)
     - s_area, s_hexagon, d_area, d_hexagon
     - expected_distance (미터), expected_fare (원)
     - is_paid (유료콜 여부), eta_distance (초)
     - product_type (normal/night/surge), is_surge
  4. 500건 단위 배치 UPSERT → callcard_mbti
  5. agent_logs INSERT (success/failed)
        │
        ▼ (저장된 callcard_mbti)
[callcard_mbti 테이블]
  - PK: callcard_id
  - 1콜 = 1행, 날짜/ASP별 인덱스
```

---

## 앱미터데이터 적재 흐름

```
[미터 엑셀 업로드]
  - 통계_천안_YYYYMMDD_YYYYMMDD.xlsx
    (파일명에서 날짜 자동 추출)
        │
        ├── POST /api/meter-logs   (Driver Summary 시트)
        │     → meter_daily_logs 테이블 UPSERT
        │
        └── POST /api/meter-excel  (Hourly Summary + Driver Summary 시트)
              → meter_hourly_logs, meter_driver_logs 테이블 UPSERT
              ※ 이 두 테이블은 migration 파일 없음 (직접 Supabase에서 생성 필요)
```

---

## 기사 프로필 생성 흐름

```
[callcard_eta + remapped 엑셀]
        │  POST /api/driver-logs (FormData: file1, file2, service_date)
        ▼
[API: driver-logs/route.ts]
  1. 엑셀 파싱 (callcard_eta 주, remapped 보조)
  2. driver_id + asp_id + service_date 단위로 그룹핑
  3. 각 기사의 해당 날 집계:
     - total_received / total_accepted / total_expired / accept_rate
     - 수락한 콜의 시간대 배열 (accepted_hours)
     - 수락/거절한 출발지·도착지 헥사곤 배열
     - 거리/요금 평균, 유료/무료/요금구간/상품/거리구간 카운트
     - avg_accept_eta (수락까지 걸린 시간, 초)
  4. 500건 배치 UPSERT → driver_daily_logs
        │
        ▼ (저장된 driver_daily_logs)
[driver_daily_logs 테이블]
  - PK: (driver_id, service_date)
  - 1기사 1일 = 1행
```

---

## 콜카드 벡터 생성 흐름

```
[callcard_mbti 테이블 (이미 적재된 데이터)]
        │  POST /api/callcard-mbti-compute (선택적 asp_id 필터)
        ▼
[API: callcard-mbti-compute/route.ts]
  1. callcard_mbti 전체 페이지네이션 조회 (1000건/페이지)
  2. asp_id 별 그룹핑
  3. 각 ASP의 모든 콜에서 집계:
     - 시간대/요일/거리/요금/유료여부/서지 비율 계산
     - 출발/도착 헥사곤 Top 3 추출
     - total_calls, data_days, reliability 계산
  4. callcard_profile UPSERT
        │
        ▼
[callcard_profile 테이블]
  - PK: asp_id
  - 1 ASP = 1행 (전체 콜 수요 프로파일)
```

---

## 기사 벡터 생성 흐름

```
[driver_daily_logs 테이블 (최근 30일)]
        │  POST /api/driver-mbti (선택적 asp_id 필터)
        ▼
[API: driver-mbti/route.ts]
  1. 최근 30일 driver_daily_logs 페이지네이션 조회
  2. driver_id 별 그룹핑
  3. 각 행에 시간 감쇠 가중치 적용:
     - 0~7일 전: weight = 1.0
     - 8~14일 전: weight = 0.7
     - 15~21일 전: weight = 0.4
     - 22~30일 전: weight = 0.1
  4. 가중 합산 → 22차원 프로파일 스코어 계산
  5. asp_id 변환: 단축형(137) → 장형(137000000000) [callcard_mbti 정합성]
  6. 500건 배치 UPSERT → driver_mbti
        │
        ▼
[driver_mbti 테이블]
  - PK: driver_id
  - 1기사 = 1행 (30일 누적 가중 프로파일)
```

---

## 코사인 유사도 계산 흐름

```
[callcard_mbti (특정 날짜)]  +  [driver_mbti (전체)]
        │  POST /api/matching  { call_date: "YYYY-MM-DD" }
        ▼
[API: matching/route.ts]
  1. call_date에 해당하는 callcard_mbti 전체 로드
  2. driver_mbti 전체 로드 (ASP별 Map 인덱싱)
  3. 각 콜에 대해:
     a. callcardToVector(row) → 22차원 one-hot 벡터
     b. 같은 asp_id의 기사 풀에서:
        - driverToVector(d) → 22차원 확률 벡터
        - cosine(callVec, driverVec) 계산
        - 출발지 헥사곤 보너스: +0.1 (cap 1.0)
     c. 코사인 유사도 내림차순 정렬 → Top 10 선별
  4. 500건 배치 UPSERT → matching_scores
```

---

## Top 10 추천 흐름

```
[matching_scores 테이블]  또는  [driver_mbti 테이블]
        │
        ├── 배치 매칭: POST /api/matching
        │     → matching_scores에 사전 저장된 Top 10
        │
        └── 실시간 추천: POST /api/recommend
              { asp_id, hour_slot, weekday, expected_distance,
                expected_fare, is_paid, is_surge,
                s_hexagon, d_hexagon }
              → driver_mbti에서 실시간 코사인 계산 (20D)
              → match_reason 생성 (한국어 매칭 이유 텍스트)
              → Top 10 반환 (matching_scores 저장 없음)

[/simulator 페이지]
  → Supabase 직접 쿼리 (driver_mbti, reliability >= 0.3, data_days >= 3)
  → 클라이언트 사이드 코사인 계산
  → 22차원 벡터 레이더 차트 시각화
  → Top 10 카드 출력
```

---

## 주요 설계 결정 및 알려진 불일치

| 항목 | 내용 |
|------|------|
| 벡터 차원 | `/api/matching` = 22D, `/api/recommend` = 20D (score_free, score_normal 누락) |
| weekday 표현 | callcard_mbti: 0=월~6=일, driver_daily_logs: JS getDay (0=일), driver-mbti 변환 적용 |
| asp_id 형식 | callcard_mbti: 장형(137000000000), driver_daily_logs: 단축형(137), driver-mbti에서 변환 |
| 인증 | 대부분 anon key, meter-excel만 service_role key (RLS 우회) |
| 배치 크기 | 모든 UPSERT 500건 단위 |
| 페이지네이션 | 모든 대량 조회 1000건/페이지 |
