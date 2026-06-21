# CODEX_AUDIT_RESULT.md

## Audit scope

- 기준 커밋: `f3c897f28dee3ceccc33026e04d12bc4a7999d23`
- 검증 방식: 코드 정적 추적 + Supabase 읽기 전용 `select` 조회
- 금지 사항 준수: 앱 코드 수정 없음, DB 쓰기 API 호출 없음, 환경변수 실제 값 미출력
- 주의: `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY`가 로드되지 않아 실제 DB 조회는 anon key 기준으로 수행됨

## 정상 연결된 데이터 흐름

1. 호출 원천 엑셀 2종은 `app/api/callcard-mbti/route.ts`에서 `callcard_id`로 join된다.
   - `callcard_eta` 쪽 `call_id/CALL_ID`
   - `remapped` 쪽 `call_id/CALL_ID`
   - 저장 대상: `callcard_mbti`
   - DB 확인: `callcard_mbti` 274,823건 존재

2. 기사 일일 로그는 `app/api/driver-logs/route.ts`에서 `driver_id + asp_id` 기준으로 집계된다.
   - 저장 대상: `driver_daily_logs`
   - DB 확인: `driver_daily_logs` 79,947건 존재

3. 기사 MBTI는 `app/api/driver-mbti/route.ts`에서 최근 30일 `driver_daily_logs`를 읽어 `driver_mbti`로 upsert한다.
   - 단축형 `asp_id` 예: `137`
   - 매칭용 장형 변환: `137000000000`
   - DB 확인: `driver_mbti` 9,956건 존재

4. 배치 매칭은 `app/api/matching/route.ts`에서 실 Supabase 데이터를 사용한다.
   - 읽기: `callcard_mbti`, `driver_mbti`
   - 쓰기: `matching_scores`
   - 연결 키: `callcard_mbti.asp_id = driver_mbti.asp_id`
   - 결과 키: `matching_scores.call_id = callcard_mbti.callcard_id`, `matching_scores.driver_id = driver_mbti.driver_id`

5. 실시간 추천은 `app/api/recommend/route.ts`에서 `driver_mbti`를 직접 조회한다.
   - `asp_id`로 기사 풀을 필터링
   - `pref_s_hexagons` 출발지 보너스 `+0.1`

6. `/simulator`는 클라이언트에서 Supabase `driver_mbti`를 직접 조회한다.
   - 필터: `asp_id`, `reliability >= 0.3`, `data_days >= 3`
   - 출력: 클라이언트 계산 Top 10

## 끊어진 데이터 흐름

1. `meter_daily_logs`는 앱미터데이터 저장 테이블로 보이나, 현재 매칭/추천/시뮬레이터 흐름에 연결되어 있지 않다.
   - 코드상 `/api/meter-logs`만 `meter_daily_logs`에 upsert한다.
   - `driver_mbti`, `/api/matching`, `/api/recommend`, `/simulator`는 `meter_daily_logs`를 읽지 않는다.
   - anon 조회 기준 샘플 0건, `driver_id` 연결 샘플도 없음.

2. `driver_profiles`는 실제 테이블은 존재하지만 0건이며, 코드에서 생성/조회 흐름을 찾지 못했다.

3. `callcard_profile`은 `app/api/callcard-mbti-compute/route.ts`에서 생성 로직이 있으나 DB는 0건이다.
   - 현재 매칭/추천/시뮬레이터도 `callcard_profile`을 사용하지 않는다.

4. `meter_hourly_logs`, `meter_driver_logs`는 실제 테이블은 존재하지만 0건이다.
   - `/api/meter-excel`에서 upsert 대상이지만 이번 매칭 흐름에는 미연결이다.

## mock 또는 하드코딩 사용 부분

1. `/simulator`의 입력 콜카드는 실제 `callcard_mbti` 행을 고르는 방식이 아니라 사용자가 만든 가상 콜카드다.
   - 실제 기사 데이터 `driver_mbti`는 사용한다.
   - 실제 콜카드 원천/`callcard_mbti`는 사용하지 않는다.

2. `/simulator`의 ASP 목록은 하드코딩되어 있다.
   - `137000000000`, `147000000000`, `160000000000`

3. `/simulator`는 DB에 없는 `score_night_prod`를 1개 차원으로 포함한다.
   - `driver_mbti` 스키마에는 `score_night_prod` 컬럼이 없다.
   - 계산 시 기사 값은 `undefined -> 0`으로 처리된다.

4. `/api/recommend`는 20차원 벡터를 하드코딩한다.
   - `score_free`, `score_normal` 축이 빠져 있다.
   - 결과적으로 `/api/matching`과 다른 점수를 만든다.

## 22차원 벡터 계산의 정확성

`/api/matching` 기준 22차원 순서는 코드와 문서가 일치한다.

1. 시간: `score_dawn`, `score_morning`, `score_daytime`, `score_night`
2. 요일: `score_mon`, `score_tue`, `score_wed`, `score_thu`, `score_fri`, `score_sat`, `score_sun`
3. 거리: `score_short`, `score_medium`, `score_long`
4. 요금: `score_low_fare`, `score_mid_fare`, `score_high_fare`
5. 유무료: `score_paid`, `score_free`
6. 상품: `score_surge`, `score_normal`
7. 근접성: `score_near`

콜카드 one-hot 계산:

- `hour_slot <= 5`: dawn
- `6 <= hour_slot <= 11`: morning
- `12 <= hour_slot <= 17`: daytime
- `hour_slot >= 18`: night
- `weekday`는 0=월, 6=일
- 거리: `<=3000`, `3001~8000`, `>8000`
- 요금: `<=10000`, `10001~20000`, `>20000`
- `is_paid`는 paid/free 상호 배타
- `is_surge`는 surge/normal 상호 배타
- `eta_distance`: `<=150`이면 1, `>=600`이면 0, 그 사이는 선형 보간

기사 벡터 계산:

- 최근 30일 `driver_daily_logs` 기준
- 날짜 가중치: 0~7일 1.0, 8~14일 0.7, 15~21일 0.4, 22~30일 0.1
- `weekday`는 JS `getDay()` 값을 `((weekday + 6) % 7)`로 0=월 기준 변환
- `score_near`는 평균 ETA 기준으로 계산하되, 기사 쪽은 `>=300`초에서 0이 된다. 콜카드 쪽 `etaToNear`는 `>=600`초에서 0이므로 스케일이 서로 다르다.

## 기사와 콜카드 유사도 계산의 정확성

대표 실데이터 1건으로 `/api/matching` 계산식을 재현했다.

- 콜카드: `202***581`, `asp_id=137000000000`, `call_date=2026-06-12`
- 기사: `DR0***869`, `data_days=12`, `reliability=0.4`
- 저장된 순위: rank 3
- 저장된 점수: `0.9934`
- 재계산 raw cosine: `0.893382`
- 출발지 hex 보너스: `+0.1`
- 재계산 최종 점수: `0.993382`
- 저장 점수와 반올림 기준 일치

해당 콜카드 벡터:

```text
[1,0,0,0, 0,0,0,0,1,0,0, 0,1,0, 0,1,0, 0,1, 0,1, 0.96]
```

해당 기사 벡터:

```text
[0.8088,0.1176,0,0.0735, 0.2279,0.0588,0.0735,0.2059,0.2353,0.1985,0,
 0.2059,0.5588,0.2353, 0.3676,0.6324,0, 0,1, 0.0588,0.9412,0.5536]
```

같은 쌍을 `/api/recommend`의 20차원 방식으로 계산하면 `0.955262`가 되어 `/api/matching`과 다르다.

## 실데이터 시뮬레이터 동작 여부

- 기사 데이터는 실 Supabase `driver_mbti`를 사용한다.
- 필터 조건상 `reliability >= 0.3`, `data_days >= 3` 기사만 포함한다.
- 대표 기사 `DR0***869`는 `data_days=12`, `reliability=0.4`라 시뮬레이터 후보가 될 수 있다.
- 단, 시뮬레이터의 콜카드는 실제 `callcard_mbti` 행이 아니라 UI 입력값으로 만든 가상 벡터다.
- 또한 `score_night_prod` 때문에 시뮬레이터의 벡터 체계는 DB 스키마 및 `/api/matching`의 22D와 정확히 같지 않다.

## 수정이 필요한 파일과 함수

1. `app/api/recommend/route.ts`
   - `DRIVER_COLS`
   - `CallInput` / `DriverRow`
   - `callToVector()`
   - `driverToVector()`
   - `buildMatchReason()`

2. `app/simulator/page.tsx`
   - `FACTORS`
   - `DriverMBTI`
   - `CallCard.product`
   - `callcardToVector()`
   - `cosineSimilarity()`
   - 상품 UI

3. `app/api/driver-mbti/route.ts`
   - `computeScoreNear()` 스케일 검토
   - `product_night_cnt`가 생성되지만 `driver_mbti` 22D에는 반영되지 않는 점 명시 또는 제거

4. `app/api/meter-logs/route.ts`, `app/api/meter-excel/route.ts`
   - 앱미터데이터를 기사 프로필/매칭에 연결할지 정책 결정 필요

## 데이터베이스 변경 없이 고칠 수 있는 항목

1. `/api/recommend`를 `/api/matching`과 동일한 22D로 수정
   - `score_free`, `score_normal` 추가
   - 같은 입력에 대해 배치 매칭과 점수 체계 일치

2. `/simulator`에서 `score_night_prod` 제거
   - 상품 축을 `score_surge`, `score_normal` 2개로 맞춤
   - UI의 심야 상품 선택은 `hour_slot` 또는 `product_type` 설명으로만 처리

3. `score_near` 스케일 통일
   - 콜카드 `etaToNear`: 150~600초
   - 기사 `computeScoreNear`: 150~300초
   - DB 변경 없이 코드 계산식만 통일 가능

4. `callcard_profile` 생성 버튼/API 실행 확인
   - 테이블은 있고 코드는 있으나 현재 0건

## 스키마 변경이 필요한 항목

1. 심야 상품을 독립 차원으로 유지하려면 `driver_mbti`, `callcard_profile`에 `score_night_prod` 컬럼 추가 필요
   - 현재 22D 체계와 충돌하므로 권장도는 낮음

2. 앱미터데이터를 매칭에 반영하려면 `meter_daily_logs.driver_id` 연결 채우기 또는 매핑 테이블 필요
   - 현재 `driver_key`와 `driver_id`의 연결이 확인되지 않음

3. 실시간 위치/반경 매칭을 구현하려면 기사 현재 위치와 콜 출발 좌표 또는 hex 좌표 변환 테이블이 필요

## 다음 구현 단계의 최소 수정 계획

1. `/api/recommend`를 22D로 맞춘다.
2. `/simulator`에서 `score_night_prod`를 제거하고 `/api/matching`과 동일한 22D 순서를 사용한다.
3. `score_near` 스케일을 하나로 통일한다.
4. `callcard_profile`이 비어 있는 원인을 운영 플로우에서 확인하고, 필요하면 기존 API 실행 버튼/상태 표시만 보강한다.
5. 앱미터데이터는 별도 단계로 `driver_key -> driver_id` 매핑 정책을 먼저 정한다.

## 실행한 검증 명령과 결과

1. `Get-Content -Raw handoff/*.md`
   - 요청된 handoff 문서 11개 모두 읽음.
   - 일부 문서는 터미널 인코딩 문제로 한글이 깨져 보였으나 테이블명, API명, 컬럼명, 코드 경로는 확인 가능.

2. `git rev-parse HEAD; git status --short`
   - HEAD: `f3c897f28dee3ceccc33026e04d12bc4a7999d23`
   - 미추적 항목: `.claude/`, `dashboard_design_guidelines.md`, `handoff/`

3. `Get-Content -Raw app/api/matching/route.ts`
   - `callcard_mbti`, `driver_mbti`를 읽고 `matching_scores`에 upsert함.
   - 22D 벡터와 cosine 계산 확인.

4. `Get-Content -Raw app/api/recommend/route.ts`
   - `driver_mbti` 실데이터 조회 확인.
   - 20D 벡터 사용 확인.

5. `Get-Content -Raw app/simulator/page.tsx`
   - `driver_mbti` 실데이터 조회 확인.
   - `score_night_prod` 포함 확인.

6. Supabase 읽기 전용 Node 조회
   - `callcard_mbti`: 274,823건
   - `driver_daily_logs`: 79,947건
   - `driver_mbti`: 9,956건
   - `callcard_profile`: 0건
   - `driver_profiles`: 0건
   - `meter_hourly_logs`: 0건
   - `meter_driver_logs`: 0건
   - `agent_logs`: 83건
   - `daily_snapshots`: 63건
   - `matching_scores`: 샘플 Top 10 조회 가능, count/head는 anon 기준 빈 오류 반환
   - `meter_daily_logs`: anon 기준 count가 null이고 샘플 0건, 후속 조회에서 schema cache 오류가 관찰됨

7. 대표 E2E 재계산
   - 콜카드 `202***581` -> 기사 `DR0***869`
   - 저장 점수 `0.9934`
   - 코드 기준 재계산 `0.993382`
   - `/api/recommend` 20D 방식 같은 쌍 점수 `0.955262`
