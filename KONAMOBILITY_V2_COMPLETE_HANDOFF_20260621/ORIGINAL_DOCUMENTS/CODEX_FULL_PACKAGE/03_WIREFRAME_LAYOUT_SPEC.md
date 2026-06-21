# WIREFRAME & LAYOUT SPEC

기준 해상도: 1672×941 레퍼런스, 실제 1440×900 이상 데스크톱

---

# 공통 App Shell

- Header: 64px
- Workspace body: `calc(100dvh - 64px)`
- 기본 배경: full viewport
- 기본 외부 여백: 14~16px
- panel gap: 10~14px
- panel radius: 8~10px
- 페이지 중앙 max-width를 강제하지 않고 전체 폭 사용

---

# 1. 데이터 운영 콘솔

## 1행: 전체 작업공간

```text
┌──────── 228px ────────┬──────────── fluid ────────────┬── 300px ──┐
│ Source Rail            │ Ingestion Matrix              │ Inspector  │
│                        │                                │            │
├────────────────────────┴────────────────────────────────┴────────────┤
│ Data Catalog Table — full width below source rail offset            │
└──────────────────────────────────────────────────────────────────────┘
```

## 크기
- 좌측 rail: 220~240px
- 우측 inspector: 292~320px
- 중앙: 남은 영역
- 상단 summary strip: 중앙+우측 영역 상단 70~78px
- matrix: 가용 높이의 약 55~62%
- catalog: 하단 약 260~310px

## 중요한 배치
- Source Rail은 header 아래부터 하단까지 고정
- 중앙 matrix와 inspector 상단 정렬
- catalog는 중앙+우측 폭 전체 사용
- matrix cell은 정사각형에 가깝게
- 스크롤은 전체 페이지보다 panel 내부에서 우선 처리

---

# 2. 벡터 워크벤치

```text
┌── 240px ──┬────────────── fluid matrix ──────────────┬── 285px ──┐
│ Factor    │ Matrix                     Relationship  │ Inspector  │
│ Library   │                                              │
├───────────┴──────────────────────────────────────────┴─────────────┤
│ Cosine Lens — full-width within main area                           │
└─────────────────────────────────────────────────────────────────────┘
```

## 크기
- Factor Library: 232~252px
- Inspector: 280~300px
- Matrix area: main center width의 62~70%
- Relationship map: main center width의 30~38%
- Cosine Lens: 높이 280~330px
- Matrix row: 34~38px
- Factor item: 34~38px

## 배치 규칙
- 팩터 목록과 matrix row 수직 정렬
- Inspector는 선택된 팩터가 없을 때 empty state
- Cosine Lens는 화면 하단에서 한 번에 보이도록 높이를 제한
- 모든 정보를 카드로 쪼개지 말고 하나의 작업표면으로 연결

---

# 3. 공간 매칭 스튜디오

```text
┌ Winner Summary — 100% width / 76px ────────────────────────────────┐
├─────────────────────────────────────────────────────────────────────┤
│ Full Map Canvas                                                     │
│ ┌ Floating Call Builder 300px ┐      ┌ Layer Control 190px ┐       │
│ │                              │      │                     │       │
│ └──────────────────────────────┘      └─────────────────────┘       │
│                                  ┌ Candidate Dock 350px ─────────┐ │
│                                  │ Top 10                       │ │
│                                  └──────────────────────────────┘ │
├ Evidence Drawer — collapsed 64px / expanded 250~310px ─────────────┤
└─────────────────────────────────────────────────────────────────────┘
```

## 크기
- Map: 화면 본문의 65% 이상
- Call Builder: 290~320px
- Candidate Dock: 340~380px
- Layer control: 180~220px
- Winner summary: 72~84px
- Evidence: collapsed 60~68px, expanded 260~320px

## 지도 우선 원칙
- 지도는 별도 카드 내부의 작은 영역이 아니다.
- body의 기본 배경 자체가 지도 캔버스다.
- 패널은 map 위 floating surface.
- 지도 조작 영역을 패널이 과도하게 가리지 않는다.

---

# 반응형

## 1600px 이상
- 모든 패널 동시 노출

## 1280~1599px
- rail과 inspector 폭 축소
- relationship map compact
- candidate dock 320px

## 1024~1279px
- inspector/dock drawer 전환
- source/factor rail collapsible
- map 우선

## 1024px 미만
- 기능 검증용 stacked view
- 모바일 앱처럼 재설계하지 않음
