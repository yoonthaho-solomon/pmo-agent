# DESIGN SYSTEM

## 시각 언어
- 정밀함
- 운영 가능성
- 공간성
- 데이터 신뢰
- 절제된 미래지향성

## 표면 계층
1. App background
2. Workspace panel
3. Interactive row/control
4. Floating overlay

카드 중첩은 최대 2단계.

## 색상 역할
- cyan: 호출, 경로, active, 콜카드 벡터
- violet: 기사 벡터, similarity, selected H3
- green: 정상, 연결, 높은 신뢰
- amber: 부분, 주의, 1위 강조
- red: 누락, 오류, 낮은 신뢰
- blue: 일반 정보, 기사 비교
- neutral: 배경/구조

## 글로우 사용
허용:
- 현재 선택 marker
- active route
- selected matrix cell
- active 탭 underline

금지:
- 모든 카드 테두리
- 모든 아이콘
- 전체 배경
- 장식 목적의 네온

## 타이포
- 한글: Pretendard 또는 현재 프로젝트 기본 한글 폰트
- 숫자/영문: 동일 폰트 우선, 필요 시 Inter
- Page label: 12~13px
- Page title: 20~24px
- Section title: 14~16px
- Body: 13~14px
- Table: 12~13px
- KPI: 28~38px
- Caption: 11~12px

## 간격
4px scale:
`4, 8, 12, 16, 20, 24, 32`

## Radius
- control: 6px
- row: 6px
- panel: 8px
- floating overlay: 10px
- 원형 button: 999px

## 보더
- 기본: 1px, 낮은 alpha
- selected: accent color 1px
- focus-visible: 2px ring

## 그림자
- 기본 panel은 shadow 최소
- floating panel만 medium shadow
- hover마다 강한 그림자 금지

## 아이콘
- 한 라이브러리만 사용
- Lucide 계열 권장
- 16/18/20/24px
- stroke 1.5~1.75
- 이모지 금지
