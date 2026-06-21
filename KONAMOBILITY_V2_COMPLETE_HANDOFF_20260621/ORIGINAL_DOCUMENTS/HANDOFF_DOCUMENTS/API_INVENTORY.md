# API_INVENTORY.md

---

## 1. `POST /api/analyze`

**파일**: `app/api/analyze/route.ts`  
**Method**: POST  
**Content-Type**: multipart/form-data

**입력**:
```
FormData {
  file1: File  (callcard_eta.xlsx — 콜 이벤트 + ETA)
  file2: File  (remapped.xlsx — 콜 속성 재매핑)
  service_date?: string  (YYYY-MM-DD, 파일명에서 자동 추출 가능)
}
```

**출력**:
```json
{
  "message": "분석 완료",
  "results": [
    {
      "asp_id": 147000000000,
      "total_calls": 1234,
      "success_count": 987,
      "expired_count": 200,
      "canceled_count": 47,
      "success_rate": 83.1,
      "surge_call_cnt": 15,
      "avg_accept_eta": 32.5,
      "ai_summary": "행복콜택시 2026-06-12 분석: ..."
    }
  ]
}
```

**사용 테이블**: `daily_snapshots` (UPSERT), `agent_logs` (INSERT)  
**호출 위치**: 홈 `/` 페이지 — "분석" 버튼  
**정상 작동 여부**: ✅  
**알려진 오류**: Anthropic API 키 없을 경우 ai_summary가 null로 저장됨

---

## 2. `POST /api/driver-logs`

**파일**: `app/api/driver-logs/route.ts`  
**Method**: POST  
**Content-Type**: multipart/form-data

**입력**:
```
FormData {
  file1: File  (callcard_eta.xlsx)
  file2: File  (remapped.xlsx)
}
```
service_date는 파일명 패턴에서 자동 추출

**출력**:
```json
{
  "message": "기사 로그 적재 완료",
  "driver_count": 523,
  "service_date": "2026-06-12"
}
```

**사용 테이블**: `driver_daily_logs` (UPSERT), `agent_logs` (INSERT)  
**호출 위치**: 홈 `/` 페이지 — 4단계 파이프라인 Step 1  
**정상 작동 여부**: ✅  
**알려진 오류**: 파일명에서 날짜 추출 실패 시 에러 반환

---

## 3. `POST /api/callcard-mbti`

**파일**: `app/api/callcard-mbti/route.ts`  
**Method**: POST  
**Content-Type**: multipart/form-data

**입력**:
```
FormData {
  file1: File  (callcard_eta.xlsx)
  file2: File  (remapped.xlsx)
}
```

**출력**:
```json
{
  "message": "콜카드 MBTI 적재 완료",
  "inserted": 3847,
  "call_date": "2026-06-12"
}
```

**사용 테이블**: `callcard_mbti` (UPSERT), `agent_logs` (INSERT)  
**호출 위치**: 홈 `/` 페이지 — 4단계 파이프라인 Step 2  
**정상 작동 여부**: ✅  
**알려진 오류**: callcard_id 중복 시 upsert로 덮어씀

---

## 4. `POST /api/callcard-mbti-compute`

**파일**: `app/api/callcard-mbti-compute/route.ts`  
**Method**: POST  
**Content-Type**: application/json (선택)

**입력**:
```json
{ "asp_id": 147000000000 }  // 생략 시 전체 ASP
```

**출력**:
```json
{
  "message": "콜카드 프로파일 계산 완료",
  "asp_count": 3
}
```

**사용 테이블**: `callcard_mbti` (SELECT), `callcard_profile` (UPSERT), `agent_logs` (INSERT)  
**호출 위치**: 홈 `/` 페이지 — "콜카드 프로파일 계산" 버튼 (개별)  
**정상 작동 여부**: ✅  
**알려진 오류**: callcard_mbti 데이터 없을 시 빈 프로파일 생성

---

## 5. `POST /api/driver-mbti`

**파일**: `app/api/driver-mbti/route.ts`  
**Method**: POST  
**Content-Type**: application/json (선택)

**입력**:
```json
{ "asp_id": 147000000000 }  // 생략 시 전체 ASP
```

**출력**:
```json
{
  "message": "기사 MBTI 계산 완료",
  "driver_count": 523
}
```

**사용 테이블**: `driver_daily_logs` (SELECT, 최근 30일), `driver_mbti` (UPSERT), `agent_logs` (INSERT)  
**호출 위치**: 홈 `/` 페이지 — 4단계 파이프라인 Step 3  
**정상 작동 여부**: ✅  
**알려진 오류**: driver_daily_logs의 weekday가 JS getDay() 기준(0=일)이므로 내부 변환 로직 포함

---

## 6. `POST /api/matching`

**파일**: `app/api/matching/route.ts`  
**Method**: POST  
**Content-Type**: application/json

**입력**:
```json
{ "call_date": "2026-06-12" }
```

**출력 (성공)**:
```json
{
  "message": "매칭 완료",
  "call_date": "2026-06-12",
  "call_count": 3847,
  "driver_count": 523,
  "match_count": 12450
}
```

**출력 (실패 422)**:
- `callcard_mbti` 데이터 없을 때
- `driver_mbti` 데이터 없을 때
- asp_id 불일치로 매칭 결과 없을 때

**사용 테이블**: `callcard_mbti` (SELECT, 날짜 필터), `driver_mbti` (SELECT, 전체), `matching_scores` (UPSERT), `agent_logs` (INSERT)  
**호출 위치**: 홈 `/` 페이지 — 4단계 파이프라인 Step 4  
**정상 작동 여부**: ✅  
**알려진 오류**: asp_id 불일치 시 422 에러 (callcard_mbti는 장형, driver_mbti는 driver-mbti 변환 후 장형)

---

## 7. `PATCH /api/matching`

**파일**: `app/api/matching/route.ts`  
**Method**: PATCH  
**Content-Type**: application/json

**입력**:
```json
{
  "updates": [
    { "call_id": "CC001", "driver_id": "DRV123", "was_sent": true },
    { "call_id": "CC002", "driver_id": "DRV456", "was_accepted": true }
  ]
}
```

**출력**:
```json
{ "message": "업데이트 완료", "updated_count": 2 }
```

**사용 테이블**: `matching_scores` (UPDATE)  
**호출 위치**: UI 없음 (직접 API 호출 또는 향후 배차 피드백 연동 예정)  
**정상 작동 여부**: ✅ (API 로직은 완성, UI 미구현)

---

## 8. `POST /api/recommend`

**파일**: `app/api/recommend/route.ts`  
**Method**: POST  
**Content-Type**: application/json

**입력**:
```json
{
  "asp_id": 147000000000,
  "hour_slot": 8,
  "weekday": 0,
  "expected_distance": 5000,
  "expected_fare": 12000,
  "is_paid": false,
  "is_surge": false,
  "s_hexagon": "HEX001",
  "d_hexagon": "HEX002"
}
```

**출력**:
```json
{
  "asp_id": 147000000000,
  "driver_pool_size": 523,
  "recommended_drivers": [
    {
      "driver_id": "DRV***",
      "cosine_score": 0.8734,
      "rank": 1,
      "match_reason": "오전 전문 기사 (활동 비중 72%) · 중거리 콜 선호 · 유료콜 수락률 45%"
    }
  ]
}
```

**사용 테이블**: `driver_mbti` (SELECT, asp_id 필터)  
**호출 위치**: `/dashboard` 매칭 시뮬레이터 섹션  
**정상 작동 여부**: ⚠️ 작동하나 **20차원 벡터** 사용 (matching의 22차원과 불일치)  
**알려진 오류**: `score_free`와 `score_normal` 차원 누락 → 동일 데이터로 다른 점수 산출

---

## 9. `POST /api/meter-logs`

**파일**: `app/api/meter-logs/route.ts`  
**Method**: POST  
**Content-Type**: multipart/form-data

**입력**:
```
FormData {
  file: File  (통계_천안_YYYYMMDD_YYYYMMDD.xlsx — Driver Summary 시트)
}
```
asp_id 고정: 147000000000 (천안)

**출력**:
```json
{
  "message": "미터 로그 적재 완료",
  "driver_count": 245,
  "total_rows_read": 245,
  "service_date": "2026-06-12"
}
```

**사용 테이블**: `meter_daily_logs` (UPSERT), `agent_logs` (INSERT)  
**호출 위치**: 홈 `/` 페이지 — 미터 데이터 업로드 섹션  
**정상 작동 여부**: ✅  
**알려진 오류**: 파일명에서 날짜 추출 실패 시 에러 (파일명 패턴: 통계_천안_YYYYMMDD_YYYYMMDD.xlsx)

---

## 10. `POST /api/meter-excel`

**파일**: `app/api/meter-excel/route.ts`  
**Method**: POST  
**Content-Type**: multipart/form-data

**입력**:
```
FormData {
  file: File  (2시트 구성 엑셀 — "Hourly Summary", "Driver Summary")
  asp_id?: string  (기본값: "147")
}
```

**출력**:
```json
{
  "message": "미터 엑셀 적재 완료",
  "hourly_inserted": 24,
  "driver_inserted": 245
}
```

**사용 테이블**: `meter_hourly_logs` (UPSERT), `meter_driver_logs` (UPSERT), `agent_logs` (INSERT)  
**호출 위치**: 홈 `/` 페이지  
**정상 작동 여부**: ⚠️ `meter_hourly_logs`, `meter_driver_logs` 테이블이 migration 파일 없음  
**알려진 오류**: Supabase에 해당 테이블이 생성되어 있지 않으면 500 에러

---

## 공통 사항

- 모든 API는 `lib/agent-logger.ts`의 `logAgentRun()`을 호출해 `agent_logs`에 기록
- 배치 크기: 모든 UPSERT 500건 단위
- 에러 시 `agent_logs`에 `status: 'failed'`, `error_msg` 기록
- 인증: anon key (기본), service_role key (meter-excel만)
