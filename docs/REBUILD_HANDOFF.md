# KONAMOBILITY V2 — 재현/핸드오프 가이드 (Gemini / Codex / 모든 AI 대상)

이 문서 + 소스 백업(`KONAMOBILITY_V2_SOURCE_BACKUP_20260626.zip`)만 있으면
프로젝트를 **동일하게 복원·실행**할 수 있습니다.

---

## 1. 무엇을 만드는가
콜카드와 기사를 **22차원 성향 벡터**로 바꿔 **코사인 유사도(75%) + H3 공간점수(25%)** 로
매칭하고, 이를 검증하는 **매칭 스튜디오 시뮬레이터**.
→ 배경/원리/목표는 [`PROJECT_NARRATIVE.md`](./PROJECT_NARRATIVE.md) 참조.

## 2. 기술 스택
- **Next.js (App Router)** — 개발 서버 포트 **3133**, webpack 모드
- **Supabase** — `callcard_mbti`, `driver_mbti` 테이블
- **Google Maps JS API** — 지도 타일 + POI 검색(클라이언트)
- **TMap API (SK Open API)** — 한국 국내 경로/ETA (Google Routes 국내 미지원)
- **deck.gl** — 마커·경로 트레일·H3 육각형 레이어
- **h3-js** — H3 해상도 7 공간 격자

## 3. 실행 절차
```bash
# 1) 의존성 설치 (pnpm 이 PATH에 없으면 npm/npx 사용)
npm install

# 2) 환경변수 파일 생성 (.env.local) — 아래 4장 참고, 실제 키는 직접 발급
#    ※ 백업 zip에는 시크릿이 포함되어 있지 않음 (의도된 보안 처리)

# 3) 개발 서버
npx next dev --port 3133

# 4) 검증
npx tsc --noEmit
npx vitest run
```

## 4. 필요한 환경변수 (이름만 — 실제 값은 각자 발급)

> ⚠️ 실제 키 값은 이 문서/백업/대화 어디에도 기록하지 않습니다. 각 콘솔에서 직접 발급하세요.

| 변수명 | 용도 | 발급처 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Supabase 대시보드 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개(anon) 키 | Supabase 대시보드 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 서비스 롤 키 | Supabase 대시보드 |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 지도/POI (클라이언트) | Google Cloud Console |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | Vector Map 스타일 ID | Google Cloud Console |
| `GOOGLE_MAPS_SERVER_API_KEY` | 서버측 Maps 호출 (HTTP referrer 제한 **없음**으로 설정) | Google Cloud Console |
| `TMAP_APP_KEY` | 경로/ETA (국내) | SK Open API 포털 |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | (구버전 공간 캔버스 fallback) | Mapbox |
| `ANTHROPIC_API_KEY` | (보조 LLM 기능) | Anthropic Console |

### 환경변수 주의점
- `GOOGLE_MAPS_SERVER_API_KEY` 는 **서버→서버 호출**이라 referrer가 없음 →
  Google Cloud Console에서 애플리케이션 제한을 **"없음"** 으로 두어야 403이 안 남.
- 한국 국내 경로는 **반드시 TMap** 사용 (Google Routes는 한국 지도 반출 규제로 빈 응답 `{}`).

## 5. 디렉터리 핵심 지도 (매칭 스튜디오 기준)
```
app/components/v2/matching/
├─ MatchingStudio.tsx        # 풀화면 컨테이너 (지도 배경 + 오버레이 카드)
├─ useMatchingStudio.ts      # 상태/필터/자동실행 로직 (콜카드·시나리오 2모드)
├─ useGoogleMap.ts           # 지도 + deck.gl 레이어 + 마커 맥동 애니메이션
├─ GoogleSpatialStage.tsx    # 지도 무대 + 경로/ETA 상단바
├─ CallBuilder.tsx           # 좌측: 필터 + 모드토글 + 출발/도착 검색
├─ PlaceSearchInput.tsx      # POI 자동완성 (portal 드롭다운)
├─ CandidateDock.tsx         # 우측: Top 10 후보 기사
├─ StudioStatus.tsx          # 상단 KPI 칩 5종
├─ EvidenceDrawer.tsx        # 하단 추천근거 (점수분해/벡터/공간)
└─ matchingStudio.module.css # 풀블리드 글래스 UI 스타일

lib/
├─ matching-vector.ts        # 22D 벡터 정의 + 코사인 (ETA 제외 매칭)
├─ h3-match-score.ts         # 공간점수 + 최종점수(75/25) 결합
├─ matching-studio-model.ts  # 화면용 매칭 모델
├─ adapters/matching.ts      # 콜카드/시나리오 매칭 계산
├─ server/tmap-routes.ts     # TMap 경로 호출
└─ h3-dispatch.ts            # H3 정규화/링 가중치
```

## 6. 절대 변경 금지 규칙
1. V1 경로(`/ingest`, `/vectors`, `/simulator`) 수정 금지
2. 신규 작업은 V2 경로에서만 (`/data-ops`, `/vector-workbench`, `/matching-studio`, `/dispatch-logic`)
3. 최종 점수 = **코사인 75% + H3 25%** (비율 고정)
4. **ETA는 매칭 점수에 미포함** (벡터 저장/표시만)
5. H3 = 기사 **선호/이력 구역** (실시간 GPS 아님)
6. Production 병합/배포 금지
7. 시크릿 키를 소스/문서/대화에 기록 금지

## 7. 핵심 공식 (빠른 참조)
```
콜 벡터  = one-hot (그 콜의 속성만 1)
기사 벡터 = 과거 이력 기반 선호 점수 (0~1)

성향 점수 = cos θ = (A·B) / (‖A‖·‖B‖)        # ETA 차원(score_near) 제외, 21D
공간 점수 = 출발H3궁합×0.45 + 도착H3궁합×0.55  # H3 res 7, 격자거리 기반
최종 점수 = 성향×0.75 + 공간×0.25
```
