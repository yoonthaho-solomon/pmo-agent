-- Dispatch event log for live AI dispatch validation.
-- Apply after dispatch candidate generation is ready to store send/accept/reject/no-response outcomes.

CREATE TABLE IF NOT EXISTS dispatch_events (
  id BIGSERIAL PRIMARY KEY,
  dispatch_id TEXT NOT NULL,
  callcard_id TEXT NULL,
  asp_id BIGINT NOT NULL,
  driver_id TEXT NULL,
  vehicle_id TEXT NULL,
  event_type TEXT NOT NULL,
  event_status TEXT NULL,
  rank_in_dispatch INTEGER NULL,
  radius_step_km DOUBLE PRECISION NULL,
  distance_km DOUBLE PRECISION NULL,
  eta_seconds INTEGER NULL,
  vector_cosine DOUBLE PRECISION NULL,
  final_score DOUBLE PRECISION NULL,
  call_risk_score DOUBLE PRECISION NULL,
  score_components JSONB NULL,
  status_snapshot JSONB NULL,
  candidate_snapshot JSONB NULL,
  event_payload JSONB NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dispatch_events_event_type_chk CHECK (
    event_type IN ('candidate_generated', 'callcard_sent', 'accepted', 'rejected', 'no_response', 'expired', 'passenger_canceled', 'driver_canceled', 'pickup', 'drop', 'failed')
  ),
  CONSTRAINT dispatch_events_event_status_chk CHECK (
    event_status IS NULL OR event_status IN ('pending', 'sent', 'accepted', 'rejected', 'expired', 'canceled', 'completed', 'failed')
  ),
  CONSTRAINT dispatch_events_rank_chk CHECK (rank_in_dispatch IS NULL OR rank_in_dispatch > 0)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_events_dispatch_id
  ON dispatch_events (dispatch_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_events_callcard_id
  ON dispatch_events (callcard_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_events_asp_event_at
  ON dispatch_events (asp_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_events_driver_event_at
  ON dispatch_events (driver_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_events_type_status
  ON dispatch_events (event_type, event_status);

COMMENT ON TABLE dispatch_events IS 'Append-only event log for live dispatch candidate generation, sending, response, timeout, cancellation, pickup, and drop outcomes.';
COMMENT ON COLUMN dispatch_events.dispatch_id IS 'Stable dispatch attempt id shared by candidate generation and all driver send/response events.';
COMMENT ON COLUMN dispatch_events.event_type IS 'Dispatch lifecycle event type such as candidate_generated, callcard_sent, accepted, rejected, no_response, expired.';
COMMENT ON COLUMN dispatch_events.candidate_snapshot IS 'Optional candidate list or single candidate snapshot used for explainability and offline replay.';
