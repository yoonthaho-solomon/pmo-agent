# INTERACTION & MOTION SPEC

## 원칙
- 모션은 상태 관계를 설명한다.
- 장식용 반복 애니메이션 금지.
- 클릭 결과는 100ms 안에 시각적 피드백.
- 네트워크/계산이 필요하면 skeleton 또는 단계 표시.
- `prefers-reduced-motion` 대응.

## 시간
- instant: 80ms
- fast: 120ms
- standard: 180ms
- medium: 240ms
- slow: 320ms
- map camera: 500~700ms

## easing
- standard: `cubic-bezier(.2,0,0,1)`
- enter: `cubic-bezier(0,0,.2,1)`
- exit: `cubic-bezier(.4,0,1,1)`

## Workspace 탭
- underline shared layout
- content opacity + y 6px
- layout jump 금지

## Matrix
- hover: row/column focus
- click: selected cell border
- mode 변경: opacity crossfade
- 숫자 변화: 짧은 tween
- 모든 셀 wave animation 금지

## Inspector
- 선택 변경 시 content crossfade
- panel 자체가 반복 slide하지 않음

## Cosine Lens
- A/B 화살표 angle tween
- arc path morph
- score tween
- 선택 축 변경 시에만 실행

## Map
- route line draw 500~700ms
- selected H3 fade
- driver selection map focus
- flyTo 남발 금지
- 사용자가 map 조작 중이면 자동 camera 이동 중지

## Candidate Dock
- rank reorder는 layout animation
- selected row는 border + background
- 점수 변화는 숫자 tween
- 1위 crown은 selected가 아니라 rank 의미

## Drawer
- 240ms
- backdrop 불필요
- map 컨텍스트 유지
- ESC/keyboard 지원
