# MAPBOX + DECK.GL + H3 SPEC

## 역할 분리
- Mapbox GL JS: basemap, camera, geocoder, popup/control, route context
- deck.gl: 대량 데이터 layer, H3, 기사 point/icon, path, picking
- h3-js: 좌표→H3, H3 boundary/center, 공간 키 계산

## 권장 통합
현재 Mapbox 구조를 조사한 뒤 deck.gl `MapboxOverlay` 사용을 우선 검토한다.

- overlay mode: 기존 Mapbox controls/plugins를 쉽게 유지할 때
- interleaved mode: Mapbox label/road layer 사이에 deck layer를 배치해야 할 때

## 필수 레이어

### H3HexagonLayer
용도:
- 출발지/도착지 H3
- 기사 선호 H3
- 공간 적합도
- 후보 밀도

데이터:
```ts
type H3CellDatum = {
  h3: string;
  score: number;
  kind: "origin" | "destination" | "fit" | "density";
  count?: number;
};
```

규칙:
- H3를 배경 패턴으로 깔지 않는다.
- score와 의미가 있는 cell만 렌더.
- hover/selected 색을 분리.
- 줌 레벨에 따라 opacity/label 조정.

### ScatterplotLayer 또는 IconLayer
용도:
- 후보 기사
- 선택 기사
- 기사 cluster

데이터:
```ts
type DriverPoint = {
  driverId: string;
  position: [number, number];
  pickupEtaSec?: number;
  score?: number;
  confidence?: number;
};
```

### PathLayer
두 종류를 분리:
- 승객 여정: origin → destination
- 픽업 경로: selected driver → origin

색상/스타일을 명확히 다르게 한다.

### TextLayer
- ETA label
- 중요한 선택 대상만
- 모든 기사에 항상 text 표시 금지

## 지도 입력
- 주소 검색
- 지도 클릭
- marker drag
- reverse geocoding
- form ↔ marker 양방향 동기화

## 경로 계산
- 승객 예상거리/시간
- 선택 기사 픽업거리/ETA
- 직선거리와 route 거리 구분
- API 실패 시 마지막 정상값을 현재값처럼 표시하지 않음

## H3
- 현재 운영 기준 resolution을 설정값으로 관리
- 기존 프로젝트 기준이 있다면 그대로 사용
- origin/destination cell
- candidate/driver preference cell
- cell ID는 문자열
- tooltip에 H3, score, count 표시

## Picking
- `pickable: true`
- hover object
- selected object
- click selection
- tooltip은 portal 또는 map overlay
- map move 중 tooltip 정리

## 레이어 컨트롤
- H3 적합도
- 후보 기사
- 픽업 ETA
- 승객 경로
- 선택 기사 경로
- label
- 전체 on/off가 아닌 필요한 최소 제어

## 성능
- 레이어 object를 불필요하게 매 render 생성하지 않음
- data/updateTriggers 최적화
- 줌 레벨에 따라 표시량 조절
- 기사 수가 많으면 aggregation/clustering
- 지도 dynamic import
- 화면 비활성 시 불필요한 animation 중단
