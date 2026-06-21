export type QueryStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "partial"
  | "error";

export type IngestionStatus =
  | "healthy"
  | "partial"
  | "missing"
  | "delayed"
  | "pending";

export type WorkspaceId =
  | "data-ops"
  | "vector-workbench"
  | "matching-studio";

export type MatrixMode =
  | "matrix"
  | "difference"
  | "contribution"
  | "projection";

export type MapLayerVisibility = {
  h3: boolean;
  candidates: boolean;
  passengerRoute: boolean;
  pickupRoute: boolean;
  etaLabels: boolean;
};

export type LocationPoint = {
  address: string | null;
  lng: number | null;
  lat: number | null;
  h3: string | null;
};

export type SimulationPhase =
  | "idle"
  | "location-input"
  | "route-calculating"
  | "embedding"
  | "candidate-search"
  | "ranking"
  | "complete"
  | "error";
