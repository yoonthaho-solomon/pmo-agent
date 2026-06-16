# HANDOFF_SUMMARY.md

## 현재 정상 작동 기능

| 기능 | 상태 |
|------|------|
| 호출 데이터 엑셀 업로드 → callcard_mbti 적재 | ✅ |
| 기사 일일 로그 적재 → driver_daily_logs | ✅ |
| 기사 MBTI 프로파일 생성 (30일 가중) → driver_mbti | ✅ |
| 배치 코사인 유사도 매칭 (22D) → matching_scores | ✅ |
| ASP KPI 분석 + Claude AI 요약 → daily_snapshots | ✅ |
| 미터 데이터 적재 → meter_daily_logs | ✅ |
| 누적 분석 대시보드 (/dashboard) KPI 트렌드 | ✅ |
| 개발 서버 실행 (npm run dev) | ✅ |

---

## 끊어진 기능

| 기능 | 원인 | 파일:라인 |
|------|------|-----------|
| 프로덕션 빌드 (`npm run build`) | TypeScript 타입 오류 | `simulator/page.tsx:133` |
| `/api/recommend` 22차원 정합성 | 20D 벡터 사용 (score_free, score_normal 누락) | `recommend/route.ts` |
| `/simulator` 심야요금 팩터 | score_night_prod 컬럼 DB에 없음 | `simulator/page.tsx` FACTORS |
| `/api/meter-excel` | meter_hourly_logs, meter_driver_logs 테이블 migration 없음 | `meter-excel/route.ts` |
| 배차 피드백 (was_sent/was_accepted) | UI 없음, API만 있음 | `matching/route.ts` PATCH |

---

## Codex가 가장 먼저 볼 파일

1. `handoff/CURRENT_STATUS.md` — 빌드 오류 확인
2. `handoff/CODEX_NEXT_TASK.md` — 우선순위별 작업 목록
3. `app/simulator/page.tsx:133` — 빌드 오류 수정 (1줄)
4. `app/api/recommend/route.ts` — 20D→22D 통일
5. `app/api/matching/route.ts` — 기준 22D 벡터 확인

---

## 로컬 실행 명령

```bash
# 환경변수 설정 후 (handoff/ENVIRONMENT.md 참조)
npm install
npm run dev
# → http://localhost:3000
```

---

## 빌드 명령

```bash
npm run build
# 현재 상태: ❌ 실패 (simulator/page.tsx:133 TypeScript 오류)
# 수정 후: ✅ 성공 예상
```

---

## 테스트 페이지

| URL | 기능 | 테스트 내용 |
|-----|------|------------|
| `http://localhost:3000` | 일일 관제 | 엑셀 업로드 + 파이프라인 실행 |
| `http://localhost:3000/dashboard` | 누적 분석 | KPI 차트, 기사 검색, 실행 로그 |
| `http://localhost:3000/simulator` | MBTI 시뮬레이터 | 콜카드 입력 → Top 10 추천 |

---

## 공유 가능한 파일

```
handoff/                  ← 이 폴더 전체
app/                      ← 소스코드
lib/                      ← 유틸리티
supabase/migrations/      ← DB 스키마
package.json
package-lock.json
tsconfig.json
next.config.ts
eslint.config.mjs
postcss.config.mjs
CLAUDE.md, AGENTS.md, README.md
dashboard_design_guidelines.md
```

---

## 공유하면 안 되는 파일

```
.env.local                ← SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY 포함
.env                      ← 존재 시 환경변수 포함
.vercel/project.json      ← Vercel 프로젝트 ID (민감도 낮으나 주의)
.claude/settings.local.json ← 로컬 Claude 설정
node_modules/             ← 빌드 산출물
.next/                    ← 빌드 산출물
happycall-pmo/            ← 별도 프로젝트 (개인정보 포함 이미지 있을 수 있음)
```

---

## 이어서 작업 시 체크리스트

- [ ] `npm install` 완료
- [ ] `.env.local` 생성 및 4개 환경변수 설정
- [ ] `npm run dev` 정상 실행 확인
- [ ] Supabase 대시보드에서 8개 테이블 존재 확인
- [ ] `simulator/page.tsx:133` 1줄 수정 후 `npm run build` 성공 확인
- [ ] `/api/recommend` 20D → 22D 수정
- [ ] 탭 구조 개편 (`CODEX_NEXT_TASK.md` Phase 3 참조)
