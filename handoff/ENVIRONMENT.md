# ENVIRONMENT.md

## 필요한 환경변수

| 변수명 | 용도 | 공개여부 | Local | Preview | Production |
|--------|------|----------|-------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 공개 (NEXT_PUBLIC) | ✅ | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 (RLS 적용) | 공개 (NEXT_PUBLIC) | ✅ | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 (RLS 우회) | **비공개** | ✅ | ✅ | ✅ |
| `ANTHROPIC_API_KEY` | Claude AI API 키 | **비공개** | ✅ | ✅ | ✅ |

---

## 각 변수의 용도

### `NEXT_PUBLIC_SUPABASE_URL`
- Supabase 프로젝트의 REST API 엔드포인트 URL
- 형식: `https://[project-ref].supabase.co`
- 사용 파일: 모든 API route, `/simulator` 페이지, `/dashboard` 페이지

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase 프로젝트의 공개 익명 키 (JWT)
- Row Level Security(RLS) 정책 적용 대상
- 사용 파일: 모든 API route (`/api/analyze`, `/api/driver-logs`, `/api/callcard-mbti`,
  `/api/callcard-mbti-compute`, `/api/driver-mbti`, `/api/matching`, `/api/recommend`,
  `/api/meter-logs`), `/simulator` 페이지, `/dashboard` 페이지

### `SUPABASE_SERVICE_ROLE_KEY`
- Supabase 서비스 롤 키 (RLS 우회, 전체 접근)
- **절대 클라이언트 사이드에 노출 금지**
- 사용 파일: `app/api/meter-excel/route.ts` 전용

### `ANTHROPIC_API_KEY`
- Anthropic Claude API 키
- ASP별 KPI 요약 생성에 사용
- 사용 파일: `app/api/analyze/route.ts`
- 없을 경우: `ai_summary`가 null로 저장됨 (오류 없이 동작)

---

## 사용하는 파일 위치

```
app/api/analyze/route.ts          → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY
app/api/callcard-mbti/route.ts    → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
app/api/callcard-mbti-compute/    → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
app/api/driver-logs/route.ts      → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
app/api/driver-mbti/route.ts      → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
app/api/matching/route.ts         → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
app/api/recommend/route.ts        → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
app/api/meter-logs/route.ts       → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
app/api/meter-excel/route.ts      → NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
app/simulator/page.tsx            → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
app/dashboard/page.tsx            → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Local / Preview / Production 구분

| 환경 | 파일 | 비고 |
|------|------|------|
| Local 개발 | `.env.local` | Git 추적 제외 (`.gitignore`) |
| Preview | Vercel 프로젝트 설정 > Environment Variables | PR 배포 시 자동 적용 |
| Production | Vercel 프로젝트 설정 > Environment Variables | `npm run build` 시 사용 |

현재 `.env.example` 없음 — Codex가 `.env.local`을 직접 생성해야 함

`.env.local` 생성 예시 (실제 값은 Supabase/Anthropic 대시보드에서 확인):
```env
NEXT_PUBLIC_SUPABASE_URL=[SECRET]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[SECRET]
SUPABASE_SERVICE_ROLE_KEY=[SECRET]
ANTHROPIC_API_KEY=[SECRET]
```

---

## Node 버전

- `package.json`: `@types/node: "^20"` → Node.js 20.x 필요
- 권장: Node.js 20 LTS

---

## 패키지 매니저

- `npm` (package-lock.json 존재)

---

## 설치 명령

```bash
npm install
```

---

## 로컬 실행 명령

```bash
npm run dev
# → http://localhost:3000 (개발 서버, HMR 활성화)
```

---

## 빌드 명령

```bash
npm run build
# Next.js 정적 + 서버 빌드
# .next/ 폴더에 아티팩트 생성

npm run start
# 프로덕션 모드 실행 (빌드 후)
```

---

## Lint 명령

```bash
npm run lint
# ESLint 9 + eslint-config-next 16.2.9
```
