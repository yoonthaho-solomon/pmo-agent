# QA & ACCEPTANCE CRITERIA

## 공통
- [ ] 3개 작업공간이 동일한 App Shell 사용
- [ ] 탭 역할이 섞이지 않음
- [ ] 1440×900 가로 스크롤 없음
- [ ] 1366×768에서 핵심 기능 접근 가능
- [ ] 브라우저 zoom 90~110%에서 깨지지 않음
- [ ] loading/empty/partial/error 상태 존재
- [ ] ID scientific notation 없음
- [ ] null을 가짜 0/100으로 표시하지 않음
- [ ] 실제 API 값과 UI 문구 일치
- [ ] 키보드 focus-visible
- [ ] reduced motion 지원

## 데이터 운영
- [ ] 데이터 소스 선택 동작
- [ ] matrix row/column 정렬
- [ ] 셀 hover tooltip
- [ ] 셀 click inspector
- [ ] healthy/partial/missing/delayed/pending 구분
- [ ] 적재 기간/건수 실제값
- [ ] data catalog 검색/필터
- [ ] sticky header/first column

## 벡터 워크벤치
- [ ] 팩터 검색/필터
- [ ] Matrix/Difference/Contribution/Projection 전환
- [ ] 콜카드와 기사값 구분
- [ ] 선택 행과 inspector 연동
- [ ] cosine raw/weighted 값 표시
- [ ] 축 on/off 결과 변화
- [ ] 관계 맵은 선택/상위 팩터 중심
- [ ] 추천 기사 랭킹/지도 없음

## 매칭 스튜디오
- [ ] 지도 화면 65% 이상
- [ ] 주소 검색
- [ ] 지도 클릭으로 출발/도착
- [ ] marker drag
- [ ] reverse geocode
- [ ] route distance/duration
- [ ] origin/destination H3
- [ ] H3 layer
- [ ] candidate layer
- [ ] passenger route
- [ ] pickup route
- [ ] 기사별 pickup ETA
- [ ] Top 10
- [ ] 기사 선택 시 map/evidence 연동
- [ ] layer toggle
- [ ] map loading/error
- [ ] panel이 지도 조작을 방해하지 않음

## 성능
- [ ] map dynamic import
- [ ] API duplicate request 없음
- [ ] deck layers memoized
- [ ] hover 시 프레임 드랍 없음
- [ ] 비활성 탭 불필요 렌더 없음
- [ ] build 성공
- [ ] typecheck 성공
- [ ] lint 성공

## 최종 제출
- [ ] 변경 파일 목록
- [ ] 컴포넌트 트리
- [ ] API 어댑터 설명
- [ ] 3개 최종 스크린샷
- [ ] 인터랙션 영상/GIF
- [ ] before/after
- [ ] 남은 TODO
