# DO NOT CHANGE / PROTECTED AREAS

Codex는 저장소 분석 후 실제 파일명을 기록하고 이 문서를 업데이트한다.

## 절대 금지
- Supabase 테이블 임의 생성/삭제/변경
- RLS 임의 해제
- Production 환경변수 출력
- service role key 클라이언트 노출
- 추천 점수 산식 임의 변경
- ETA를 임의 숫자로 생성
- 더미 데이터를 실데이터처럼 표시
- API 오류를 빈 배열로 숨김
- 전체 리팩터링을 단일 커밋으로 수행
- V1 백업 없이 파일 덮어쓰기
- 승인 없이 Production 배포

## 보호 대상
- 현재 정상 데이터 조회
- 기존 벡터 생성
- driver_mbti/관련 데이터
- 기존 matching 결과
- 실데이터 날짜/ASP 필터
- 현재 인증/권한 흐름
- Vercel/Supabase 배포 설정

## UI에서 금지
- 대형 홍보 문장
- 과도한 neon/glow
- 3중 이상 카드 중첩
- 지도 배경에 의미 없는 H3 전체 도배
- 모든 기사 ETA label 상시 노출
- 모든 팩터 링크 상시 노출
- 색만으로 상태 전달
