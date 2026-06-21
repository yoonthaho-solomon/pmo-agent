# MATCHING_LOGIC.md

## 22차원 벡터 구성 (정확한 순서)

**파일 기준**: `app/api/matching/route.ts` — `callcardToVector()` 함수

| Index | 차원명 | 그룹 | 콜카드 one-hot 조건 |
|-------|--------|------|---------------------|
| 0 | score_dawn | 시간대 | hour_slot <= 5 |
| 1 | score_morning | 시간대 | hour_slot >= 6 && <= 11 |
| 2 | score_daytime | 시간대 | hour_slot >= 12 && <= 17 |
| 3 | score_night | 시간대 | hour_slot >= 18 |
| 4 | score_mon | 요일 | weekday === 0 (월) |
| 5 | score_tue | 요일 | weekday === 1 (화) |
| 6 | score_wed | 요일 | weekday === 2 (수) |
| 7 | score_thu | 요일 | weekday === 3 (목) |
| 8 | score_fri | 요일 | weekday === 4 (금) |
| 9 | score_sat | 요일 | weekday === 5 (토) |
| 10 | score_sun | 요일 | weekday === 6 (일) |
| 11 | score_short | 거리 | expected_distance > 0 && <= 3000 |
| 12 | score_medium | 거리 | expected_distance > 3000 && <= 8000 |
| 13 | score_long | 거리 | expected_distance > 8000 |
| 14 | score_low_fare | 요금 | expected_fare > 0 && <= 10000 |
| 15 | score_mid_fare | 요금 | expected_fare > 10000 && <= 20000 |
| 16 | score_high_fare | 요금 | expected_fare > 20000 |
| 17 | score_paid | 콜유형 | is_paid === true |
| 18 | score_free | 콜유형 | is_paid === false |
| 19 | score_surge | 상품 | is_surge === true |
| 20 | score_normal | 상품 | is_surge === false |
| 21 | score_near | 근접도 | etaToNear(eta_distance) |

**그룹별 요약**:
- 시간대 4차원 (0~3)
- 요일 7차원 (4~10)
- 거리 3차원 (11~13)
- 요금 3차원 (14~16)
- 콜유형 2차원 (17~18): 유료/무료 상호 배타
- 상품 2차원 (19~20): 서지/일반 상호 배타
- 근접도 1차원 (21): 연속값 0~1

---

## 시간대 구분 (4차원)

| 슬롯명 | 조건 | 설명 |
|--------|------|------|
| score_dawn | hour_slot <= 5 | 새벽 (0~5시) |
| score_morning | 6 <= hour_slot <= 11 | 오전 |
| score_daytime | 12 <= hour_slot <= 17 | 낮 |
| score_night | hour_slot >= 18 | 야간 (18~23시) |

정확히 하나의 차원만 1, 나머지 3개는 0.

---

## 요일 구분 (7차원)

**callcard_mbti 기준**: 0=월요일, 1=화요일, ..., 6=일요일 (한국 기준)

```typescript
// callcardToVector() — matching route
wd === 0 ? 1 : 0,  // mon (index 4)
wd === 1 ? 1 : 0,  // tue (index 5)
...
wd === 6 ? 1 : 0,  // sun (index 10)
```

**driver_daily_logs weekday**: JS `getDay()` 기준 (0=일요일, 1=월요일, ..., 6=토요일)
- `/api/driver-mbti`에서 변환 적용: JS요일 → 한국 기준으로 재계산 후 driver_mbti에 저장

**주의**: `driver_mbti` migration 파일의 컬럼 순서가 `score_sun, score_mon, score_tue...`이지만
API 코드에서 named field 접근하므로 컬럼 정의 순서는 무관.

---

## 거리 구분 (3차원)

| 슬롯명 | 조건 | 설명 |
|--------|------|------|
| score_short | 0 < expected_distance <= 3000 | 단거리 (~3km) |
| score_medium | 3000 < expected_distance <= 8000 | 중거리 (3~8km) |
| score_long | expected_distance > 8000 | 장거리 (8km+) |

expected_distance = 0인 콜: 모든 거리 차원 0 (거리 미상)

---

## 요금 구분 (3차원)

| 슬롯명 | 조건 | 설명 |
|--------|------|------|
| score_low_fare | 0 < expected_fare <= 10000 | 저요금 (~1만원) |
| score_mid_fare | 10000 < expected_fare <= 20000 | 중요금 (1~2만원) |
| score_high_fare | expected_fare > 20000 | 고요금 (2만원+) |

---

## 콜유형 2차원

| 슬롯명 | 조건 | 설명 |
|--------|------|------|
| score_paid | is_paid === true | 유료콜 (콜카드 필요) |
| score_free | is_paid === false | 무료콜 (일반 호출) |

상호 배타: 항상 정확히 하나만 1.

---

## 상품 3차원 (simulator UI) vs 2차원 (API)

**⚠️ 불일치 주의**:

| | /api/matching (22D) | /api/recommend (20D) | /simulator UI |
|-|---------------------|----------------------|---------------|
| 상품 차원 | score_surge(1) + score_normal(1) = 2D | score_surge(1) = 1D | score_normal + score_night_prod + score_surge = 3D |
| score_night_prod | 없음 | 없음 | UI에만 존재, driver_mbti 테이블에 컬럼 없음 |

---

## 콜카드 one-hot 벡터 생성 방식

**위치**: `app/api/matching/route.ts` — `callcardToVector(row: CallcardRow)`

```typescript
function callcardToVector(row: CallcardRow): number[] {
  const h = row.hour_slot;          // callcard_mbti.hour_slot
  const wd = row.weekday ?? -1;     // callcard_mbti.weekday (0=월~6=일)
  const dist = row.expected_distance ?? 0;
  const fare = row.expected_fare ?? 0;
  return [
    h <= 5 ? 1 : 0,                        // [0] dawn
    ...                                     // [1~21] 위 표 참조
    etaToNear(row.eta_distance),            // [21] near
  ]
}

function etaToNear(eta: number | null): number {
  if (eta == null || eta <= 0) return 0;
  if (eta <= 150) return 1.0;              // 2.5분 이내: 1.0
  if (eta >= 600) return 0.0;              // 10분 이상: 0.0
  return 1 - (eta - 150) / 450;           // 선형 보간
}
```

---

## 기사 누적확률 벡터 생성 방식

**위치**: `app/api/driver-mbti/route.ts`

1. 최근 30일 `driver_daily_logs` 로드
2. 각 행에 시간 감쇠 가중치 적용:

```
days_old 0~7  → weight 1.0
days_old 8~14 → weight 0.7
days_old 15~21 → weight 0.4
days_old 22~30 → weight 0.1
```

3. 각 차원 = 가중합(해당 조건 수락 수) / 가중합(전체 수락 수)
4. 정규화: 시간대/요일은 비율합 = 1, 거리/요금은 비율합 ≤ 1 (미상 콜 제외)
5. `pref_s_hexagons` / `pref_d_hexagons`: 가중 빈도 기준 Top 3

---

## 정규화 방식

| 그룹 | 정규화 |
|------|--------|
| 시간대 | 4개 비율 합 = 1 (수락 콜 전부 분류됨) |
| 요일 | 7개 비율 합 = 1 |
| 거리 | 합 ≤ 1 (거리 미상 콜 제외) |
| 요금 | 합 ≤ 1 (요금 미상 콜 제외) |
| 유료/무료 | 합 = 1 |
| 서지/일반 | 합 = 1 |
| 근접도 | 0~1 연속값 (etaToNear 결과 평균) |

---

## 코사인 유사도 계산 코드 위치

**배치 매칭**: `app/api/matching/route.ts` — `cosine(a, b)` 함수 (라인 169~178)

```typescript
function cosine(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
```

**실시간 추천**: `app/api/recommend/route.ts` — 동일 패턴 (라인 117~126)  
**시뮬레이터**: `app/simulator/page.tsx` — `cosineSimilarity()` 함수 (라인 125~140)

---

## Top 10 선별 기준

1. 코사인 유사도 기본 점수 계산
2. 출발지 헥사곤 보너스: `d.pref_s_hexagons.includes(call.s_hexagon)` 시 +0.1
3. `Math.min(score + bonus, 1.0)`으로 캡 적용
4. 내림차순 정렬 후 `.slice(0, 10)` — rank 1~10

**시뮬레이터 추가 필터**: `reliability >= 0.3 AND data_days >= 3` (driver_mbti 쿼리 조건)

---

## 데이터 부족 기사 처리 방식

- `driver_daily_logs` 데이터 없는 기사: `driver_mbti` 행 자체 없음 → 매칭에서 제외
- 데이터 있으나 적은 기사 (data_days < 30): `reliability = data_days / 30`으로 낮게 설정
- 시뮬레이터: `reliability >= 0.3` 필터로 제외 (10일 미만 데이터 기사 제외)
- 배치 매칭 (`/api/matching`): 신뢰도 필터 없음 — 모든 driver_mbti 포함

---

## matching_scores 저장 방식

**위치**: `app/api/matching/route.ts` — POST handler

```typescript
{
  call_id:      call.callcard_id,
  driver_id:    top10[i].driver_id,
  asp_id:       call.asp_id,
  match_date:   call.call_date,
  cosine_score: parseFloat(top10[i].score.toFixed(4)),
  rank_in_call: i + 1,        // 1-based
  was_sent:     false,         // 발송 전
  was_accepted: false,         // 수락 전
}
```

- **Conflict 처리**: `onConflict: 'call_id,driver_id'` → upsert (재실행 시 덮어씀)
- **저장 단위**: 콜 1건당 최대 10행 (콜 수 × 10 행)
- **피드백 갱신**: PATCH /api/matching으로 was_sent/was_accepted 업데이트 가능

---

## 현재 로직의 한계

| 한계 | 설명 |
|------|------|
| 정적 프로파일 | 기사 현재 위치/상태 반영 없음 (반경 검색 미구현) |
| 차원 불일치 | /api/matching(22D) vs /api/recommend(20D) |
| 심야 상품 누락 | score_night_prod 차원이 시뮬레이터 UI에만 존재 |
| 수락률 미반영 | 개별 기사 수락률(was_accepted 누적)이 매칭 점수에 미포함 |
| ETA 미반영 | 실시간 배차까지 걸리는 예상 시간 미포함 |
| 단일 보너스 | 출발지 헥사곤 보너스만 있음, 도착지 헥사곤 보너스 없음 |
| 콜 취소 무반응 | 만료/취소된 콜 이력이 기사 프로파일에 부정적으로 반영 안 됨 |
| ASP 간 격리 | asp_id 다른 기사-콜 매칭 불가 (by design, 변경 가능) |
