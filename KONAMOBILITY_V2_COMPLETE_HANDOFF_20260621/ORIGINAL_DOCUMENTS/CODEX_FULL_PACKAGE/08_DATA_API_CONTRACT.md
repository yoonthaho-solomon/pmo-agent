# DATA & API CONTRACT

이 문서는 UI 모델의 기준이다. 실제 API 이름과 필드는 저장소 조사 후 어댑터에서 연결한다.

## 공통
- 모든 ID는 문자열
- scientific notation 금지
- 날짜: `YYYY-MM-DD`
- 시간: ISO 또는 명시된 timezone
- 거리: meter 원본, UI에서 m/km 변환
- 시간: second 원본, UI에서 분/초 변환
- cosine: 0~1
- display percent: 0~100
- 값 없음은 `null`
- `null`을 0 또는 100으로 임의 변환 금지

## 데이터 운영

```ts
type IngestionStatus = "healthy" | "partial" | "missing" | "delayed" | "pending";

type IngestionCell = {
  sourceId: string;
  date: string;
  status: IngestionStatus;
  rowCount: number | null;
  expectedCount: number | null;
  firstReceivedAt: string | null;
  lastReceivedAt: string | null;
  reason?: string | null;
  relatedCounts?: {
    callLogs?: number | null;
    driverLogs?: number | null;
    matchResults?: number | null;
  };
};

type DataProduct = {
  id: string;
  category: string;
  name: string;
  description: string;
  fields: string[];
  sources: string[];
  refreshCycle: string;
  availability: number | null;
  status: "available" | "partial" | "unavailable";
};
```

## 벡터

```ts
type VectorFactor = {
  id: string;
  label: string;
  category: "space" | "time" | "distance" | "product" | "passenger" | "driver";
  rawValue: number | string | null;
  normalizedValue: number | null;
  weight: number | null;
  confidence: number | null;
  contribution?: number | null;
};

type VectorComparison = {
  callcard: VectorFactor[];
  selectedDriver: VectorFactor[];
  compareDrivers?: Array<{
    driverId: string;
    factors: VectorFactor[];
  }>;
  rawCosine: number | null;
  weightedCosine: number | null;
  thetaDeg: number | null;
};
```

## 매칭

```ts
type SimulationInput = {
  regionId: string;
  serviceDate: string;
  dayOfWeek: number;
  time: string;
  origin: {
    address: string | null;
    lng: number | null;
    lat: number | null;
    h3: string | null;
  };
  destination: {
    address: string | null;
    lng: number | null;
    lat: number | null;
    h3: string | null;
  };
  callType: "normal" | "paid";
  passengerTripDistanceM: number | null;
  passengerTripDurationSec: number | null;
};

type DriverCandidate = {
  rank: number;
  driverId: string;
  name?: string | null;
  finalScore: number | null;
  cosineSimilarity: number | null;
  spatialFit: number | null;
  pickupEtaSec: number | null;
  pickupDistanceM: number | null;
  confidence: number | null;
  dataDays: number | null;
  position?: [number, number] | null;
  evidence?: {
    pickup: number | null;
    time: number | null;
    day: number | null;
    distance: number | null;
    product: number | null;
  };
};

type SimulationResult = {
  route: {
    geometry: GeoJSON.LineString | null;
    distanceM: number | null;
    durationSec: number | null;
  };
  candidates: DriverCandidate[];
  selectedDriverId: string | null;
  scoreFormula?: {
    cosineWeight: number;
    spatialWeight: number;
    etaWeight: number;
  } | null;
};
```

## 상태
```ts
type QueryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "empty"; message: string }
  | { status: "partial"; message: string }
  | { status: "error"; message: string; retryable: boolean };
```
