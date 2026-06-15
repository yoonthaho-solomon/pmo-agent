# Live Service Readiness Checklist

작성일: 2026-06-15
대상: PMO AI 우선배차를 라이브서비스로 넘기기 전 최종 점검표

## 현재 완료 상태

### 데이터/벡터

- 호출데이터 기반 `callcard_mbti` 적재 및 원천 필드 보존 완료.
- 기사 `driver_mbti` 22차원 벡터 사용 구조 유지.
- 콜카드 22차원 벡터와 기사 22차원 벡터의 공통 계산 모듈 `lib/matching-vector.ts` 사용.
- `/api/recommend`, `/api/matching`, `/api/matching-verify`가 공통 계산 기준을 사용하도록 정리.

### 콜 위험도

- `/api/callcard-outcomes` 구축.
- 지원 축: 시간대, 거리 구간, 요금 구간, 유료/무료, 탄력/일반, 출발권역, 도착권역.
- `problem_rate = (expired + canceled) / total`.
- 작은 표본 과대평가 방지를 위해 `adjusted_problem_rate`, `sample_confidence` 추가.
- `call_risk_score`는 화면 설명용 독립 지표로 분리. 아직 최종 배차점수에 섞지 않음.

### Matching Lab UI

- 데이터 적재, 콜카드·기사, 매칭 시뮬레이션 3탭 구조 완료.
- 실제 콜카드 선택 후 22D 추천 비교 가능.
- 저장 Top10 정합성 검증 가능.
- 거리순, 22D 유사도순, dispatch simulation Top10 비교 가능.
- 정책별 KPI 요약: 후보 수, 평균 ETA, 평균 유사도, 예상 수락률 표시.

### 라이브 배차 API 초안

- `supabase/migrations/20260615_driver_realtime_state.sql` 작성.
- `/api/dispatch/recommend` skeleton 작성.
- 기본 모드는 `driver_realtime_state` 실데이터를 요구.
- `driver_realtime_state` 미적용 시 `schema_missing`으로 안전 응답.
- `simulation_mode: true`일 때만 `driver_mbti` 기반 결정론적 가상 위치/상태로 검증 가능.

## 아직 운영 배차로 쓰면 안 되는 부분

- `simulation_mode=true` 결과는 운영 배차에 사용 금지.
- 시뮬레이터의 기사 위치, 온라인, 공차, 위치 최신성은 실데이터가 아니다.
- `call_risk_score`는 최종 배차점수에 아직 반영하지 않는다.
- dispatch simulation의 예상 수락률은 아직 실제 기사 수락 이벤트 학습값이 아니다.
- 출발/도착권역 위험도는 smoothing이 들어갔지만, 실제 점수 반영 전 운영 검증이 필요하다.

## 라이브 전환 전 필수 결정

1. 기사 실시간 상태 소스

- Supabase `driver_realtime_state` 테이블에 적재할지
- 외부 기사앱/관제 API에서 직접 읽을지
- 최소 필요 필드: `driver_id`, `asp_id`, `lat`, `lng`, `location_updated_at`, `online_status`, `empty_status`, `can_receive_call`

2. 위치 계산 방식

- 1차: 앱 서버 haversine + lat/lng bounding box
- 고도화: PostGIS `geography(Point, 4326)` + GIST 인덱스

3. 상태 최신성 TTL

- 현재 초안: 90초
- 운영에서 앱 위치 수집 주기에 맞춰 조정 필요

4. 반경 확장 정책

- 현재 초안: 3km → 6km → 9km
- 장기적으로는 거리보다 ETA 기준으로 전환 권장

5. 최종 점수 정책

초기 운영 권장:

```text
final_score = vector_cosine
```

설명용 구성요소:

- ETA 점수
- 기사 신뢰도
- 예상 수락확률
- call_risk_score
- 도착지역 가치
- 배차 균형 점수

검증 후 다음 버전에서만 가중합 반영.

6. 배차 결과 이벤트 저장

라이브 검증에는 아래 이벤트 저장이 필요하다.

- 후보 생성 시각
- 후보 기사 목록
- 콜카드 발송 순서
- 기사별 수락/거절/무응답/만료
- 최종 배차 기사
- 배차 소요시간
- 취소 여부
- 운행완료 여부

## 개발자에게 넘길 최소 구현 순서

1. Supabase에 `20260615_driver_realtime_state.sql` 적용 여부 결정.
2. 실제 기사 상태 샘플 100~1000건 적재 또는 외부 API mock 연결.
3. `/api/dispatch/recommend`를 `simulation_mode=false`로 호출해 실데이터 후보가 반환되는지 확인.
4. `/simulator`에서 dispatch simulation 패널을 실데이터 패널로 교체.
5. 배차 이벤트 저장 테이블/API 설계.
6. A/B 테스트 기준 정의: 기존 거리순 대비 수락률, 배차시간, expired, canceled 비교.

## 현재 운영 URL

- 대시보드: https://pmo-agent-khaki.vercel.app/dashboard
- 시뮬레이터: https://pmo-agent-khaki.vercel.app/simulator
- dispatch skeleton: `POST https://pmo-agent-khaki.vercel.app/api/dispatch/recommend`
- dispatch event skeleton: `GET/POST https://pmo-agent-khaki.vercel.app/api/dispatch/events`

## 현재 기준 커밋

최근 핵심 커밋:

- `213355f feat: summarize policy comparison metrics`
- `71fcff6 feat: compare dispatch simulation rankings`
- `65a825a feat: smooth call outcome risk`
- `0da4da0 feat: add dispatch simulation mode`
- `d575f46 feat: add live dispatch skeleton`

## 최종 판단

현재 상태는 “라이브 배차 로직을 검증하기 위한 Matching Lab”으로는 1차 완성이다.
실제 라이브서비스 전환의 남은 핵심은 UI가 아니라 기사 실시간 상태 데이터와 배차 결과 이벤트 저장이다.
