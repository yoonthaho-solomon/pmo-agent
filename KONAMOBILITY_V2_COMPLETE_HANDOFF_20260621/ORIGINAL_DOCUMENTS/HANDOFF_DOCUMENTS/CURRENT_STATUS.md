# CURRENT_STATUS.md

## 현재 브랜치

```
main (origin/main과 동기화 완료)
```

---

## 최신 커밋

```
e073847  feat: MBTI 매칭 시뮬레이터 페이지 추가 (/simulator)
a2d1c0f  fix: driver-mbti asp_id 단축형→장형 변환 (callcard_mbti 일치)
1596e38  style: 빔프로젝터용 UI 재설계 — happycall 디자인 토큰 적용
5ce0b55  feat: 매칭 벡터 13→22차원 통일, driver-mbti 요일 한국 기준으로 수정
c9dca50  style: 세 화면 헤더 48px로 통일, 네비게이션 우측 정렬
```

---

## 커밋되지 않은 변경사항

```
?? dashboard_design_guidelines.md  (미추적 파일 — 스테이징 안 됨)
```

---

## 빌드 결과

**상태: ❌ 빌드 실패**

```
npm run build → TypeScript 타입 오류로 빌드 실패

오류 위치: app/simulator/page.tsx:133
Type error: Conversion of type 'DriverMBTI' to type 'Record<string, number>'
may be a mistake because neither type sufficiently overlaps with the other.
If this was intentional, convert the expression to 'unknown' first.
```

**원인**: `cosineSimilarity()` 함수에서 `driver`를 `Record<string, number>`로 직접 캐스팅
```typescript
// 문제 코드 (simulator/page.tsx:133)
const b = (driver as Record<string, number>)[k] ?? 0;

// 수정 방법: unknown을 경유
const b = (driver as unknown as Record<string, number>)[k] ?? 0;
```

**난이도**: 수정 1줄, 5분 이내 해결 가능  
**영향 범위**: `/simulator` 페이지만 해당 (다른 API/페이지 무관)

---

## TypeScript 오류

| 파일 | 위치 | 오류 내용 | 심각도 |
|------|------|----------|--------|
| `app/simulator/page.tsx` | 라인 133 | `DriverMBTI`를 `Record<string, number>`로 직접 캐스팅 불가 | 🔴 빌드 차단 |

---

## Lint 오류

빌드가 TypeScript 오류로 중단되어 lint 단계 미도달.
개별 실행 가능: `npm run lint`

---

## 로컬 실행 오류

`.env.local` 파일 존재하여 로컬 개발 서버는 정상 실행 가능 (`npm run dev`).  
개발 모드(`next dev`)는 TypeScript 오류에도 실행됨 — `/simulator` 페이지 UI 동작 확인 가능.

---

## Vercel 배포 상태

`.vercel/` 폴더 존재 → Vercel 프로젝트에 연결되어 있음.  
빌드 실패로 인해 **최신 커밋(e073847) 프로덕션 배포 실패 가능성 높음**.  
이전 성공 커밋(a2d1c0f 또는 그 이전)이 현재 프로덕션에 서빙 중일 수 있음.  
실제 배포 상태는 Vercel 대시보드에서 확인 필요.

---

## Supabase 연결 상태

`.env.local`에 Supabase URL/키 설정됨 → 로컬에서 DB 연결 정상.  
마이그레이션 파일 8개가 `supabase/migrations/`에 있으나,
실제 적용 여부는 Supabase 대시보드 > Table Editor에서 확인 필요.

**주의**: `meter_hourly_logs`, `meter_driver_logs` 테이블은 migration 파일 없음.
`/api/meter-excel` API 호출 시 이 테이블이 Supabase에 없으면 500 에러 발생.

---

## 우선 해결할 문제

### 🔴 P0 — 즉시 수정 (빌드 차단)

1. **`app/simulator/page.tsx:133` TypeScript 오류 수정**
   ```typescript
   // 변경 전:
   const b = (driver as Record<string, number>)[k] ?? 0;
   // 변경 후:
   const b = (driver as unknown as Record<string, number>)[k] ?? 0;
   ```

### 🟠 P1 — 중요 (기능 오류)

2. **`/api/recommend` 20차원 → 22차원 통일**
   - `app/api/recommend/route.ts`의 `callToVector()`에 `score_free`, `score_normal` 차원 추가
   - `driverToVector()`에 `d.score_free`, `d.score_normal` 추가
   - DRIVER_COLS에 `score_free`, `score_normal` 추가

3. **`score_night_prod` 처리**
   - `/simulator` FACTORS 배열에서 참조하나 driver_mbti 테이블에 컬럼 없음
   - 옵션 A: driver_mbti 테이블에 `score_night_prod` 컬럼 추가
   - 옵션 B: 시뮬레이터에서 `score_night_prod` 팩터 제거

4. **`meter_hourly_logs`, `meter_driver_logs` 테이블 migration 추가**
   - `/api/meter-excel` 사용 전 Supabase에 테이블 생성 필요

### 🟡 P2 — 향후 개선

5. `was_sent` / `was_accepted` 피드백 UI 구현
6. 실시간 위치 기반 반경 검색 로직 추가
7. 최종 배차점수 (코사인 + ETA + 수락률) 구현
