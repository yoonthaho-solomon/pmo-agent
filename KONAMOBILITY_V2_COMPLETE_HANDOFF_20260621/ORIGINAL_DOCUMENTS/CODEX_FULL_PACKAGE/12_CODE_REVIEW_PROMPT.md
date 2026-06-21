# CODE REVIEW PROMPT

구현이 끝난 뒤 아래 내용을 Codex에 다시 전달한다.

---

이번 구현을 작성자가 아닌 독립 리뷰어의 관점으로 검수하라.

## 1. 레퍼런스 일치
- 3장 레퍼런스와 정보구조가 일치하는가
- 패널 비율과 우선순위가 일치하는가
- 카드형 V1 구조로 되돌아가지 않았는가
- 지도 중심 작업공간이 구현되었는가

## 2. 로직 무결성
- 기존 API/DB/계산 로직이 유지되었는가
- UI 문구가 실제 계산과 일치하는가
- 더미/하드코딩 값이 남았는가
- ID/날짜/거리/ETA 포맷 오류가 있는가

## 3. 공간 구현
- Mapbox/deck.gl/H3가 역할별로 분리되었는가
- layer object가 불필요하게 재생성되는가
- picking과 selection이 안정적인가
- route와 pickup route가 구분되는가

## 4. 상태
- loading/empty/partial/error가 실제로 보이는가
- 오류가 빈 데이터로 숨겨지는가
- race condition 또는 stale result가 있는가
- 실행 버튼 중복 요청 방지가 있는가

## 5. 접근성/성능
- focus-visible
- keyboard
- reduced motion
- map dynamic import
- excessive re-render
- layout shift

## 6. 결과
문제를 심각도 순으로 정리하라.
- P0: 데이터/보안/Production 위험
- P1: 기능 오류
- P2: UI/UX 불일치
- P3: polish

각 문제에 파일과 코드 위치, 수정안을 제시하라.
문제가 없다는 결론을 쉽게 내리지 말고 실제 실행과 build 결과를 근거로 판단하라.
