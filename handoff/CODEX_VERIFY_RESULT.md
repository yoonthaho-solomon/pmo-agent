# CODEX_VERIFY_RESULT.md

## 검증 범위

- 목적: 실제 Supabase 콜 1건으로 `/api/matching` 저장 Top 10과 수정된 `/api/recommend` 실제 응답 비교
- 기준: DB 수정 없음, Supabase는 읽기 전용 `select`만 수행
- API 호출: 로컬 `next start -p 3100` 서버에서 `POST /api/recommend` 실제 호출
- 검증 시각: 2026-06-13

## 사용한 실제 콜

개인/운영 식별자는 마스킹했다.

```text
callcard_id: 202***581
asp_id: 137000000000
call_date: 2026-06-12
hour_slot: 0
weekday: 4
expected_distance: 5041
expected_fare: 11400
is_paid: false
is_surge: false
eta_distance: 168
eta_near: 0.96
s_hexagon: 8730e0a82ffffff
d_hexagon: 8730e0a90ffffff
product_type: e음 택시 일반
```

`/api/recommend` 요청 body:

```json
{
  "asp_id": 137000000000,
  "hour_slot": 0,
  "weekday": 4,
  "expected_distance": 5041,
  "expected_fare": 11400,
  "is_paid": false,
  "is_surge": false,
  "s_hexagon": "8730e0a82ffffff",
  "d_hexagon": "8730e0a90ffffff"
}
```

API 응답 상태:

```text
200 OK
driver_pool_size: 2646
```

## 저장된 `/api/matching` Top 10

```text
1.  DR0***259  0.9999
2.  DR0***188  0.9999
3.  DR0***869  0.9934
4.  DR0***592  0.9781
5.  DR0***522  0.9441
6.  DR0***157  0.9373
7.  DR0***233  0.9287
8.  DR0***003  0.9259
9.  DR0***118  0.9195
10. DR0***311  0.8998
```

## 수정된 `/api/recommend` 실제 Top 10

```text
1.  DR0***869  0.9512
2.  DR0***259  0.9258
3.  DR0***188  0.9258
4.  DR0***522  0.9098
5.  DR0***592  0.8949
6.  DR0***003  0.8839
7.  DR0***983  0.8763
8.  DR0***427  0.8745
9.  DR0***157  0.8735
10. DR0***765  0.8731
```

## 비교 요약

- Top 10 overlap: 7명
- 저장 매칭 Top 10에는 있으나 추천 Top 10에는 없는 기사:
  - `DR0***233`
  - `DR0***118`
  - `DR0***311`
- 추천 Top 10에는 있으나 저장 매칭 Top 10에는 없는 기사:
  - `DR0***983`
  - `DR0***427`
  - `DR0***765`

## 점수 재계산 검증

저장된 `/api/matching` 점수는 현재 코드 기준 재계산과 일치했다.

```text
DR0***259: stored 0.9999 / recomputed matching 0.9999 / recommend 0.9258
DR0***188: stored 0.9999 / recomputed matching 0.9999 / recommend 0.9258
DR0***869: stored 0.9934 / recomputed matching 0.9934 / recommend 0.9512
DR0***592: stored 0.9781 / recomputed matching 0.9781 / recommend 0.8949
DR0***522: stored 0.9441 / recomputed matching 0.9441 / recommend 0.9098
DR0***157: stored 0.9373 / recomputed matching 0.9373 / recommend 0.8735
DR0***233: stored 0.9287 / recomputed matching 0.9287 / recommend 0.8323
DR0***003: stored 0.9259 / recomputed matching 0.9259 / recommend 0.8839
DR0***118: stored 0.9195 / recomputed matching 0.9195 / recommend 0.8059
DR0***311: stored 0.8998 / recomputed matching 0.8998 / recommend 0.7985
```

수정된 `/api/recommend` 실제 응답도 route-equivalent 재계산과 일치했다.

```text
DR0***869: api 0.9512 / recomputed recommend 0.9512
DR0***259: api 0.9258 / recomputed recommend 0.9258
DR0***188: api 0.9258 / recomputed recommend 0.9258
DR0***522: api 0.9098 / recomputed recommend 0.9098
DR0***592: api 0.8949 / recomputed recommend 0.8949
DR0***003: api 0.8839 / recomputed recommend 0.8839
DR0***983: api 0.8763 / recomputed recommend 0.8763
DR0***427: api 0.8745 / recomputed recommend 0.8745
DR0***157: api 0.8735 / recomputed recommend 0.8735
DR0***765: api 0.8731 / recomputed recommend 0.8731
```

## 차이 원인

핵심 원인은 `score_near` 차원이다.

```text
/api/matching call vector near: 0.96
/api/recommend call vector near: 0
other 21 dimensions: same
```

`/api/matching`은 저장된 `callcard_mbti.eta_distance=168`을 사용한다.

```text
etaToNear(168) = 1 - (168 - 150) / 450 = 0.96
```

반면 `/api/recommend`는 실시간 콜 입력에 ETA가 없다는 전제로 near 차원을 항상 0으로 둔다.

```typescript
0  // near: 실시간 콜이므로 ETA 미상 -> 0
```

그래서 `score_near`가 높은 기사는 저장 매칭에서는 유리하지만, 추천 API에서는 dot product에는 기여하지 않고 기사 벡터 norm만 키워 상대적으로 불리해진다.

예시:

```text
DR0***233: driver_near 0.8978
matching rank 7 / score 0.9287
recommend rank 없음 / recomputed recommend 0.8323

DR0***118: driver_near 1.0000
matching rank 9 / score 0.9195
recommend rank 없음 / recomputed recommend 0.8059

DR0***983: driver_near 0.0000
matching rank 없음 / recomputed matching 0.8159
recommend rank 7 / score 0.8763
```

즉, 22차원 축 자체는 이제 맞았지만, 저장 매칭과 실시간 추천은 near 입력 정책이 달라 순위가 완전히 같지는 않다.

## 검증 결론

1. `/api/recommend`는 수정 후 실제로 22차원 벡터 체계로 동작한다.
2. `/api/recommend` 실제 API 응답은 수정된 코드 기준 재계산과 일치한다.
3. `/api/matching` 저장 점수도 코드 기준 재계산과 일치한다.
4. 두 결과의 차이는 버그라기보다 `near` 차원의 입력 정책 차이다.
5. `/api/recommend`에서 저장 매칭과 같은 결과를 원하면 실시간 콜 입력에 `eta_distance` 또는 현재 기사별 실시간 ETA를 넣는 정책이 필요하다.

## 다음 결정 필요

선택지는 두 가지다.

1. 실시간 추천에서도 `eta_distance`를 입력받는다.
   - 장점: `/api/matching`과 점수 정책이 가장 잘 맞는다.
   - 단점: 추천 시점에 ETA 데이터가 필요하다.

2. `/api/recommend`에서는 near 차원을 완전히 제외하거나, call near가 없을 때 driver `score_near`도 점수 계산에서 제외한다.
   - 장점: ETA 없는 실시간 추천에서 특정 기사들이 norm 때문에 불리해지는 현상을 줄인다.
   - 단점: 배치 매칭과 22D 수학 구조가 달라진다.

최소 구현 권장안:

```text
/api/recommend 요청 body에 eta_distance?: number | null 추가
값이 있으면 /api/matching과 동일하게 etaToNear 적용
값이 없으면 near 차원을 양쪽 모두 계산에서 제외하는 옵션 검토
```

## 실행한 명령과 결과

```text
Get-Content package.json
Get-Content app/api/recommend/route.ts
Get-Content app/api/matching/route.ts
```

- API와 벡터 계산 코드 확인.

```text
npm.cmd run start -- -p 3100
```

- 로컬 Next.js 서버 실행.
- `http://localhost:3100` 준비 확인.

```text
POST http://localhost:3100/api/recommend
```

- 실제 API 응답 `200 OK`.
- `driver_pool_size=2646`.

```text
Supabase select:
- matching_scores
- callcard_mbti
- driver_mbti
```

- 읽기 전용 조회만 수행.
- DB 수정 없음.

```text
Stop-Process -Id 21936,27876 -Force
```

- 검증용 로컬 서버 종료.
