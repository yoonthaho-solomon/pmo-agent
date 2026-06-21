# END_TO_END_TRACE.md

실제 데이터를 수정하지 않고 가상의 예시 데이터를 사용해 전체 흐름을 추적합니다.
개인정보는 마스킹 처리되었습니다.

---

## 예시 설정

| 항목 | 값 |
|------|-----|
| 기사 | `DRV-1***47` (행복콜택시, 천안) |
| 콜카드 | `CC-20260612-***89` (2026-06-12, 행복콜택시) |
| 날짜 | 2026-06-12 (수요일) |
| ASP | 행복콜택시 (asp_id: 147 → 장형: 147000000000) |

---

## STEP 1 — 원천 호출데이터 (엑셀)

**파일**: `callcard_eta_20260612.xlsx` + `remapped_20260612.xlsx`

```
callcard_eta.xlsx 컬럼 예시:
  CALL_ID         : CC-20260612-***89
  ASP_ID          : 147
  CALL_TIME       : 2026-06-12 08:23:00  (수요일 오전)
  STATUS          : SUCCESS
  DRIVER_ID       : DRV-1***47
  ACCEPTED_TAXI_ETA: 95  (초, 수락까지 걸린 시간)

remapped.xlsx 컬럼 예시:
  CALL_ID         : CC-20260612-***89
  S_HEXAGON       : HEX-CHN-0***42
  D_HEXAGON       : HEX-CHN-0***17
  EXPECTED_DIST   : 6200   (미터, 중거리)
  EXPECTED_FARE   : 14000  (원, 중요금)
  IS_PAID         : false
  IS_SURGE        : false
  PRODUCT_TYPE    : normal
```

---

## STEP 2 — callcard_mbti 테이블 적재

**API**: `POST /api/callcard-mbti`  
**저장 결과**: `callcard_mbti` 테이블

```sql
INSERT INTO callcard_mbti VALUES (
  callcard_id     = 'CC-20260612-***89',
  asp_id          = 147000000000,   -- 장형으로 저장
  call_date       = '2026-06-12',
  hour_slot       = 8,              -- 08:23 → 8
  weekday         = 2,              -- 수요일 (0=월 기준 → 2)
  s_hexagon       = 'HEX-CHN-0***42',
  d_hexagon       = 'HEX-CHN-0***17',
  expected_distance = 6200,
  expected_fare   = 14000,
  is_paid         = false,
  eta_distance    = NULL,           -- 콜카드 ETA와 구분, 여기는 배차 ETA
  is_surge        = false,
  product_type    = 'normal'
);
```

---

## STEP 3 — driver_daily_logs 적재

**API**: `POST /api/driver-logs`  
**저장 결과**: `driver_daily_logs` 테이블  
(이 기사의 2026-06-12 수락 이력 집계)

```sql
INSERT INTO driver_daily_logs VALUES (
  driver_id        = 'DRV-1***47',
  asp_id           = 147,           -- 단축형으로 저장
  service_date     = '2026-06-12',
  weekday          = 4,             -- JS getDay(): 수요일 = 3... 실제로 2026-06-12는?
                                    -- 실제로 2026-06-12는 금요일 (JS getDay = 5)
                                    -- 이 예시에서는 수요일(3) 가정
  total_received   = 12,
  total_accepted   = 9,
  total_expired    = 3,
  accept_rate      = 0.75,
  accepted_hours   = {8, 9, 10, 14, 15, 17, 19, 20, 22},
  avg_distance     = 5800,
  avg_fare         = 13200,
  paid_accepted    = 2,
  free_accepted    = 7,
  mid_fare_cnt     = 7,
  high_fare_cnt    = 2,
  medium_cnt       = 8,
  long_cnt         = 1,
  avg_accept_eta   = 88.5
);
```

---

## STEP 4 — driver_mbti 생성 (30일 가중 집계)

**API**: `POST /api/driver-mbti`  
**저장 결과**: `driver_mbti` 테이블

최근 30일 가중 집계 후 22차원 벡터 생성 (이 기사 기준):

```
시간대 분포 (가중):
  score_dawn    = 0.05   (새벽 수락 거의 없음)
  score_morning = 0.42   (오전 선호)
  score_daytime = 0.35   (낮 활동)
  score_night   = 0.18   (야간 일부)

요일 분포 (가중):
  score_mon = 0.18, score_tue = 0.15, score_wed = 0.20,
  score_thu = 0.18, score_fri = 0.16, score_sat = 0.08, score_sun = 0.05

거리 분포:
  score_short  = 0.25
  score_medium = 0.60   (중거리 선호)
  score_long   = 0.15

요금 분포:
  score_low_fare  = 0.30
  score_mid_fare  = 0.55   (중요금 선호)
  score_high_fare = 0.15

유료/무료:
  score_paid = 0.20
  score_free = 0.80   (무료콜 위주)

서지/일반:
  score_surge  = 0.10
  score_normal = 0.90

근접도:
  score_near   = 0.72   (빠른 배차 선호)

선호 지역:
  pref_s_hexagons = ['HEX-CHN-0***42', 'HEX-CHN-0***15', 'HEX-CHN-0***08']
  pref_d_hexagons = ['HEX-CHN-0***17', 'HEX-CHN-0***22', 'HEX-CHN-0***31']

data_days   = 24
reliability = 0.80   (24/30)

asp_id      = 147000000000   (장형 변환 적용)
```

---

## STEP 5 — 콜카드 22차원 벡터 계산

**API**: `POST /api/matching`  
**위치**: `callcardToVector(row)` 함수

콜 `CC-20260612-***89` 기준:
```
hour_slot=8, weekday=2(수), distance=6200m, fare=14000원,
is_paid=false, is_surge=false, eta_distance=null

→ 22차원 벡터:
[0]  score_dawn    = 0  (h=8, 새벽 아님)
[1]  score_morning = 1  (6 <= 8 <= 11)
[2]  score_daytime = 0
[3]  score_night   = 0
[4]  score_mon     = 0
[5]  score_tue     = 0
[6]  score_wed     = 1  (weekday=2)
[7]  score_thu     = 0
[8]  score_fri     = 0
[9]  score_sat     = 0
[10] score_sun     = 0
[11] score_short   = 0  (6200 > 3000)
[12] score_medium  = 1  (3000 < 6200 <= 8000)
[13] score_long    = 0
[14] score_low_fare  = 0  (14000 > 10000)
[15] score_mid_fare  = 1  (10000 < 14000 <= 20000)
[16] score_high_fare = 0
[17] score_paid    = 0  (is_paid=false)
[18] score_free    = 1
[19] score_surge   = 0  (is_surge=false)
[20] score_normal  = 1
[21] score_near    = 0  (eta_distance=null → 0)

콜카드 벡터 = [0,1,0,0, 0,0,1,0,0,0,0, 0,1,0, 0,1,0, 0,1, 0,1, 0]
```

---

## STEP 6 — 기사 22차원 벡터 변환

**위치**: `driverToVector(row)` 함수

기사 `DRV-1***47` 기준 (driver_mbti 저장값):
```
[0]  0.05  [1]  0.42  [2]  0.35  [3]  0.18   ← 시간대
[4]  0.18  [5]  0.15  [6]  0.20  [7]  0.18   ← 요일
[8]  0.16  [9]  0.08  [10] 0.05
[11] 0.25  [12] 0.60  [13] 0.15             ← 거리
[14] 0.30  [15] 0.55  [16] 0.15             ← 요금
[17] 0.20  [18] 0.80                          ← 유료/무료
[19] 0.10  [20] 0.90                          ← 서지/일반
[21] 0.72                                     ← 근접도
```

---

## STEP 7 — 코사인 유사도 계산

```
callcard = [0,1,0,0, 0,0,1,0,0,0,0, 0,1,0, 0,1,0, 0,1, 0,1, 0]
driver   = [0.05,0.42,0.35,0.18, 0.18,0.15,0.20,0.18,0.16,0.08,0.05,
            0.25,0.60,0.15, 0.30,0.55,0.15, 0.20,0.80, 0.10,0.90, 0.72]

dot product:
  [1]×0.42 = 0.42   (오전)
  [6]×0.20 = 0.20   (수요일)
  [12]×0.60 = 0.60  (중거리)
  [15]×0.55 = 0.55  (중요금)
  [18]×0.80 = 0.80  (무료콜)
  [20]×0.90 = 0.90  (일반)
  합계 dot = 0.42 + 0.20 + 0.60 + 0.55 + 0.80 + 0.90 = 3.47

|callcard| = sqrt(0+1+0+0 + 0+0+1+0+0+0+0 + 0+1+0 + 0+1+0 + 0+1 + 0+1 + 0)
           = sqrt(6) ≈ 2.449

|driver|  = sqrt(0.05²+0.42²+0.35²+0.18²+ ... + 0.72²)
           ≈ sqrt(0.0025+0.1764+0.1225+0.0324+0.0324+0.0225+0.04+0.0324+
                  0.0256+0.0064+0.0025+ 0.0625+0.36+0.0225+
                  0.09+0.3025+0.0225+ 0.04+0.64+ 0.01+0.81+ 0.5184)
           ≈ sqrt(2.7019) ≈ 1.644

cosine = 3.47 / (2.449 × 1.644) = 3.47 / 4.026 ≈ 0.862

헥사곤 보너스:
  call.s_hexagon = 'HEX-CHN-0***42'
  driver.pref_s_hexagons = ['HEX-CHN-0***42', ...]  → 포함 → +0.1

최종 score = min(0.862 + 0.1, 1.0) = 0.962
```

---

## STEP 8 — matching_scores 저장

```sql
INSERT INTO matching_scores VALUES (
  call_id      = 'CC-20260612-***89',
  driver_id    = 'DRV-1***47',
  asp_id       = 147000000000,
  match_date   = '2026-06-12',
  cosine_score = 0.9620,
  rank_in_call = 1,           -- Top 1 가정
  was_sent     = false,
  was_accepted = false
);
```

---

## STEP 9 — /api/matching 응답

```json
{
  "message": "매칭 완료",
  "call_date": "2026-06-12",
  "call_count": 3847,
  "driver_count": 523,
  "match_count": 12450
}
```

---

## STEP 10 — /api/recommend 실시간 조회

```bash
POST /api/recommend
{
  "asp_id": 147000000000,
  "hour_slot": 8,
  "weekday": 2,
  "expected_distance": 6200,
  "expected_fare": 14000,
  "is_paid": false,
  "is_surge": false,
  "s_hexagon": "HEX-CHN-0***42",
  "d_hexagon": "HEX-CHN-0***17"
}
```

응답 (20차원 기준, score_free/score_normal 누락으로 실제 값 약간 다름):
```json
{
  "asp_id": 147000000000,
  "driver_pool_size": 523,
  "recommended_drivers": [
    {
      "driver_id": "DRV-1***47",
      "cosine_score": 0.8734,
      "rank": 1,
      "match_reason": "오전 전문 기사 (활동 비중 42%) · 중거리 콜 선호 · 해당 출발지 구역 수락 이력 다수"
    },
    ...
  ]
}
```

---

## STEP 11 — /simulator 출력

브라우저에서 `/simulator` 접속 후:

**Step 1** — 콜카드 입력:
- 플랫폼: 행복콜택시 (천안)
- 시간: 8시 (오전 슬라이더)
- 요일: 수
- 거리: 중거리 (3~10km)
- 요금: 중요금
- 콜유형: 무료콜
- 상품: 일반 요금

**Step 2** — 22차원 벡터 시각화:
```
활성 차원: score_morning=1, score_wed=1, score_medium=1,
           score_mid_fare=1, score_free=1, score_normal=1
레이더 차트: 오전/수요일/중거리/중요금 축 돌출
```

**Step 3** — 매칭 결과 (driver_mbti에서 실시간 쿼리):
```
분석 대상: 행복콜 기사 중 reliability >= 0.3, data_days >= 3인 기사

#1  DRV-1***47  유사도 96.2%  데이터 24일  신뢰도 80%
    강점: [오전형] [중거리] [무료콜]

#2  DRV-2***83  유사도 89.1%  ...
...
```

---

## 흐름 요약 다이어그램

```
엑셀 업로드
    ↓
callcard_mbti (콜 속성 저장)
    ↓
driver_daily_logs (기사 일별 수락 이력)
    ↓
driver_mbti (30일 가중 프로파일 22D 벡터)
    ↓
matching (배치: 콜 22D one-hot × 기사 22D 확률 → cosine)
    ↓
matching_scores (Top 10 저장, rank 1~10)
    ↓
recommend (실시간: 동일 로직, DB 저장 없음, 20D ⚠️)
    ↓
/simulator (클라이언트 사이드 cosine, 22D UI ⚠️)
```
