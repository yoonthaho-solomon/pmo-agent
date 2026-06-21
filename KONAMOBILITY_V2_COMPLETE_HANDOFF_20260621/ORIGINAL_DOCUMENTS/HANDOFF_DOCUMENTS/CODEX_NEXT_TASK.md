# CODEX_NEXT_TASK.md

Codex가 기존 기능을 깨뜨리지 않고 이어서 작업할 수 있도록 목표와 작업 순서를 정리한다.

---

## 목표 요약

1. **[즉시]** 빌드 오류 수정 — TypeScript 타입 오류 1건
2. **[단기]** 벡터 차원 통일 — `/api/recommend` 20D → 22D
3. **[단기]** 탭 구조 개편 — 적재 탭 / 콜카드·기사 탭 / 시뮬레이션 탭
4. **[중기]** 실시간 위치 기반 반경 검색 추가
5. **[중기]** 최종 배차점수 (코사인 + ETA + 수락률) 구현
6. **[장기]** 미수락 시 반경 단계 확장

---

## PHASE 0 — 분석 및 검증 (코드 변경 전 필수)

### 0-1. 현재 빌드 확인
```bash
npm run build
```
예상 결과: `app/simulator/page.tsx:133` TypeScript 오류 1건

### 0-2. 로컬 실행 확인
```bash
npm run dev
# http://localhost:3000 → 업로드 화면
# http://localhost:3000/dashboard → 누적 분석
# http://localhost:3000/simulator → 시뮬레이터 (UI는 동작, 빌드만 실패)
```

### 0-3. Supabase 테이블 존재 여부 확인
Supabase 대시보드 > Table Editor에서 아래 테이블 존재 여부 확인:
- [x] agent_logs
- [x] daily_snapshots
- [x] driver_daily_logs
- [x] driver_mbti
- [x] callcard_mbti
- [x] callcard_profile
- [x] matching_scores
- [x] meter_daily_logs
- [ ] meter_hourly_logs ← 없을 수 있음
- [ ] meter_driver_logs ← 없을 수 있음

---

## PHASE 1 — 빌드 오류 수정

### 1-1. TypeScript 오류 수정 (🔴 P0)

**파일**: `app/simulator/page.tsx:133`

```typescript
// 변경 전:
const b = (driver as Record<string, number>)[k] ?? 0;

// 변경 후:
const b = (driver as unknown as Record<string, number>)[k] ?? 0;
```

### 1-2. 빌드 재검증
```bash
npm run build
# → 오류 없음 확인
```

---

## PHASE 2 — 벡터 차원 통일 (🟠 P1)

### 2-1. 문제 파악

`/api/recommend`(20D)와 `/api/matching`(22D)의 벡터 불일치:
- 누락 차원: `score_free` (index 18), `score_normal` (index 20)
- 현재 recommend는 `is_paid → score_paid(1차원)`만 사용하고 `score_free` 없음
- 현재 recommend는 `is_surge → score_surge(1차원)`만 사용하고 `score_normal` 없음

### 2-2. 수정 대상 파일: `app/api/recommend/route.ts`

```typescript
// DRIVER_COLS에 추가
'score_free', 'score_normal',

// driverToVector() 수정
function driverToVector(d: DriverRow): number[] {
  return [
    d.score_dawn, d.score_morning, d.score_daytime, d.score_night,
    d.score_mon, d.score_tue, d.score_wed, d.score_thu, d.score_fri, d.score_sat, d.score_sun,
    d.score_short, d.score_medium, d.score_long,
    d.score_low_fare, d.score_mid_fare, d.score_high_fare,
    d.score_paid,   d.score_free,    // 추가: score_free
    d.score_surge,  d.score_normal,  // 추가: score_normal
    d.score_near,
  ]
}

// callToVector() 수정
function callToVector(call: CallInput): number[] {
  ...
  call.is_paid ? 1 : 0,     // score_paid
  call.is_paid ? 0 : 1,     // score_free  ← 추가
  call.is_surge ? 1 : 0,    // score_surge
  call.is_surge ? 0 : 1,    // score_normal ← 추가
  0,                         // near
}
```

### 2-3. 검증
```bash
# 로컬에서 테스트
curl -X POST http://localhost:3000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"asp_id":147000000000,"hour_slot":8,"weekday":2,"expected_distance":6200,"expected_fare":14000,"is_paid":false,"is_surge":false}'
```

---

## PHASE 3 — 탭 구조 개편

### 3-1. 목표

현재 홈(`/`) 페이지의 복잡한 단일 뷰를 3개 탭으로 분리:

| 탭 | 내용 | 데이터 소스 |
|----|------|------------|
| 적재 탭 | 호출데이터 + 앱미터데이터 업로드 현황 | agent_logs, driver_daily_logs count |
| 콜카드·기사 탭 | 콜카드 정보 현황 + 기사 데이터 현황 | callcard_mbti count, driver_mbti count |
| 시뮬레이션 탭 | 콜카드 입력 → 코사인 유사도 순 추천 | /api/recommend |

### 3-2. 분석 순서

1. `app/page.tsx` 현재 구조 완전 파악 (기존 기능 목록 확인)
2. 기존 upload 로직 분리 가능한지 확인
3. 탭 컴포넌트 설계 (기존 페이지에 탭 레이어 추가 vs 페이지 리팩터)
4. **기존 API 호출 코드 유지** — 탭은 UI 레이어만 변경

### 3-3. 구현 시 주의사항

- 기존 4단계 파이프라인 버튼 동작 유지
- 기존 agent_logs 테이블 조회 유지
- `/dashboard`, `/simulator` 네비게이션 링크 유지
- 다크 글라스모피즘 디자인 토큰(`app/design-tokens.ts`) 계속 사용

---

## PHASE 4 — 시뮬레이션 탭 강화 (이후 실시간 기능)

### 4-1. 실시간 위치 기반 반경 검색

**전제**: 기사의 현재 위치 데이터 소스 필요 (현재 없음)
- 옵션 A: 별도 위치 API 연동 (외부 시스템)
- 옵션 B: 수동 입력 (시뮬레이션용)

**구현 방향**:
1. 콜카드 출발지 좌표(위도/경도) 필요 — 현재 헥사곤 코드만 있음
2. 헥사곤 코드 → 좌표 변환 테이블 또는 API 필요
3. 기사 현재 위치 좌표 필요
4. 반경 필터: `distance_km(call.s_coord, driver.curr_coord) <= radius_km`

### 4-2. 반경 내 기사 후보 필터링

```typescript
// 의사코드
const radius_km = 3; // 초기 반경
const candidates = drivers.filter(d => 
  haversine(call.s_coord, d.curr_coord) <= radius_km
);
```

### 4-3. 최종 배차점수

```typescript
// 최종 점수 = 코사인 유사도 × α + ETA점수 × β + 수락률 × γ
// α + β + γ = 1 (가중치 합)
// 권장 초기값: α=0.5, β=0.3, γ=0.2

const finalScore = (cosineScore * 0.5) 
                 + (etaScore * 0.3)      // etaScore = 1 - (eta/maxEta)
                 + (acceptRate * 0.2);   // 최근 30일 수락률 (driver_mbti에서 계산 가능)
```

### 4-4. 미수락 시 반경 단계 확장

```typescript
const RADIUS_STEPS = [3, 5, 8, 15]; // km
let step = 0;
while (step < RADIUS_STEPS.length) {
  const candidates = filterByRadius(RADIUS_STEPS[step]);
  if (candidates.length > 0) {
    const top10 = rankByFinalScore(candidates);
    return top10;
  }
  step++;
}
```

---

## 작업 원칙 (기존 기능 보호)

### 분석 → 검증 → 최소 수정 → 빌드 → 테스트 순서 준수

1. **분석**: 수정 전 반드시 해당 파일 전체 읽기
2. **실데이터 흐름 검증**: `agent_logs` 테이블에서 최근 성공 실행 확인
3. **최소 수정**: API 로직 변경 시 인터페이스(Input/Output 구조) 유지
4. **빌드**: `npm run build` 후 오류 없음 확인
5. **테스트**: 로컬에서 `/`, `/dashboard`, `/simulator` 모두 열어 확인

### 절대 금지 사항

- `supabase/migrations/` 파일 변경 금지 (DB 스키마 변경은 별도 논의)
- `.env.local` 수정 금지
- 기존 API의 응답 구조(JSON 키 이름) 변경 금지
- `driver_mbti` 테이블 컬럼 삭제 금지 (기존 데이터 보존)

---

## 파일 우선순위

Codex가 먼저 읽어야 할 파일:

| 순서 | 파일 | 이유 |
|------|------|------|
| 1 | `handoff/CURRENT_STATUS.md` | 빌드 오류 확인 |
| 2 | `app/simulator/page.tsx:133` | 즉시 수정 대상 |
| 3 | `app/api/recommend/route.ts` | 20D→22D 통일 대상 |
| 4 | `app/api/matching/route.ts` | 기준 22D 벡터 확인 |
| 5 | `app/page.tsx` | 탭 개편 전 현재 구조 파악 |
