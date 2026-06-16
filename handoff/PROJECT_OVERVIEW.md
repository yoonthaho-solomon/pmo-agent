# PROJECT_OVERVIEW.md

## 프로젝트 목적

**PMO Agent**는 라이드셰어 플랫폼(e음택시, 행복콜택시, 동백택시)의 **MBTI 기반 기사-콜 매칭 엔진**이다.
호출 데이터와 앱미터 데이터를 매일 엑셀로 적재하고, 기사의 수락 이력을 22차원 벡터로 프로파일링한 뒤
코사인 유사도로 콜카드와 가장 잘 맞는 기사 Top 10을 추천한다.

---

## 현재 구현된 기능

| 기능 | 상태 | 경로 |
|------|------|------|
| 호출 데이터 엑셀 업로드 | ✅ | `/` (홈) |
| 앱미터 데이터 엑셀 업로드 | ✅ | `/` (홈) |
| ASP별 일일 KPI 분석 + Claude AI 요약 | ✅ | `/api/analyze` |
| 기사 일일 로그 적재 | ✅ | `/api/driver-logs` |
| 콜카드 MBTI 벡터 생성 | ✅ | `/api/callcard-mbti` |
| 콜카드 프로파일 집계 | ✅ | `/api/callcard-mbti-compute` |
| 기사 MBTI 프로파일 생성 (30일 가중) | ✅ | `/api/driver-mbti` |
| 콜-기사 코사인 유사도 매칭 | ✅ | `/api/matching` |
| 실시간 콜카드 기사 추천 | ✅ | `/api/recommend` |
| 미터 일별 기사 통계 적재 | ✅ | `/api/meter-logs` |
| 미터 시간대별/기사별 통계 적재 | ✅ | `/api/meter-excel` |
| 일일 관제 대시보드 | ✅ | `/` (홈) |
| 누적 분석 대시보드 (KPI 트렌드 + 실행 로그) | ✅ | `/dashboard` |
| MBTI 매칭 시뮬레이터 | ✅ | `/simulator` |

---

## 배포 URL

- **Vercel Production**: `.vercel` 폴더 존재, 실제 URL은 Vercel 대시보드 확인 필요
- 로컬 개발: `http://localhost:3000`

---

## GitHub 저장소

- 브랜치: `main`
- 로컬 경로: `C:\Users\pgman\pmo-agent`
- 리모트: `git remote -v`로 확인

---

## 로컬 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정 (.env.local 생성)
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY 값 채우기

# 3. 개발 서버 실행
npm run dev
# → http://localhost:3000
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | Next.js 16.2.9 (App Router) |
| 런타임 | React 19.2.4 |
| 언어 | TypeScript 5 |
| 스타일 | Tailwind CSS 4 (inline style 혼용) |
| 차트 | Recharts 3.8.1 |
| 엑셀 파싱 | xlsx 0.18.5 |
| DB | Supabase (PostgreSQL) |
| AI | Anthropic SDK 0.104.1 (claude-sonnet-4-6 / claude-opus-4-8) |
| 배포 | Vercel |
| Node | 20.x (package.json `@types/node: ^20`) |
| 패키지 매니저 | npm |

---

## 페이지별 역할

### `/` (홈 — 일일 관제)
- 호출 데이터 엑셀 2종 (callcard_eta, remapped) 업로드
- 미터 데이터 엑셀 업로드
- 4단계 배치 파이프라인 실행 버튼 (Driver Logs → Callcard MBTI → Driver MBTI → Matching)
- ASP별 KPI 카드 + Claude AI 요약 출력

### `/dashboard` (누적 분석)
- KPI 트렌드 라인차트 (기간 필터 가능)
- MBTI 매칭 프로세스 시각화 (22차원 벡터 설명)
- 매칭 시뮬레이터 섹션 (실시간 추천 테스트)
- 에이전트 실행 로그 테이블

### `/simulator` (MBTI 매칭 시뮬레이터)
- Step 1: 콜카드 속성 입력 (플랫폼, 시간, 요일, 거리, 요금, 유료여부, 상품)
- Step 2: 22차원 벡터 생성 + 레이더 차트 시각화
- Step 3: Supabase에서 기사 MBTI 로드 후 코사인 유사도 계산 → Top 10 출력

---

## 정상 작동 기능

- 엑셀 업로드 및 Supabase 적재 (모든 API)
- 기사 MBTI 프로파일 생성 (30일 가중 집계)
- 콜카드 22차원 벡터 생성 및 저장
- 코사인 유사도 계산 및 matching_scores 저장
- `/simulator` 페이지: 콜카드 입력 → 실시간 Top 10 추천
- `/dashboard` KPI 트렌드 차트
- Claude AI KPI 요약 생성

---

## 미완성 기능

- `dispatch_proposals` 테이블: 코드에 없음 (migration 없음)
- `callcard_patterns`, `driver_profiles` 테이블: 코드에 없음
- `meter_hourly_logs`, `meter_driver_logs` 테이블: API 코드에 있으나 migration 파일 없음
- was_sent / was_accepted 피드백 루프: PATCH 엔드포인트만 있고 UI 없음
- 실시간 위치 기반 반경 검색: 미구현
- 기사 현황/상태 탭: 미구현
- 최종 배차점수 (코사인 + ETA + 수락률 결합): 미구현
- 미수락 시 반경 단계 확장: 미구현
- `/api/recommend` 벡터 차원이 20D로 `/api/matching` 22D와 불일치 (known bug)
- 시뮬레이터 `score_night_prod` 팩터: driver_mbti 테이블에 해당 컬럼 없음
