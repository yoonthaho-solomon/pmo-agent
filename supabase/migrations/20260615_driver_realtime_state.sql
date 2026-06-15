-- Driver realtime state for live dispatch candidate generation.
-- This migration is a schema draft. Apply only after the realtime state source is confirmed.

CREATE TABLE IF NOT EXISTS driver_realtime_state (
  driver_id TEXT PRIMARY KEY,
  asp_id BIGINT NOT NULL,
  vehicle_id TEXT NULL,
  vehicle_no TEXT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location_updated_at TIMESTAMPTZ NOT NULL,
  online_status BOOLEAN NOT NULL DEFAULT FALSE,
  empty_status BOOLEAN NOT NULL DEFAULT FALSE,
  can_receive_call BOOLEAN NOT NULL DEFAULT FALSE,
  current_trip_status TEXT NULL,
  last_call_id TEXT NULL,
  source TEXT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT driver_realtime_state_lat_chk CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT driver_realtime_state_lng_chk CHECK (lng BETWEEN -180 AND 180),
  CONSTRAINT driver_realtime_state_trip_status_chk CHECK (
    current_trip_status IS NULL OR current_trip_status IN ('idle', 'assigned', 'pickup', 'on_trip', 'offline', 'blocked')
  )
);

CREATE INDEX IF NOT EXISTS idx_driver_realtime_state_asp_status
  ON driver_realtime_state (asp_id, online_status, empty_status, can_receive_call);

CREATE INDEX IF NOT EXISTS idx_driver_realtime_state_updated_at
  ON driver_realtime_state (location_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_realtime_state_asp_location
  ON driver_realtime_state (asp_id, lat, lng);

CREATE INDEX IF NOT EXISTS idx_driver_realtime_state_vehicle_id
  ON driver_realtime_state (vehicle_id);

CREATE OR REPLACE FUNCTION update_driver_realtime_state_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_realtime_state_updated_at ON driver_realtime_state;
CREATE TRIGGER trg_driver_realtime_state_updated_at
  BEFORE UPDATE ON driver_realtime_state
  FOR EACH ROW EXECUTE FUNCTION update_driver_realtime_state_updated_at();

COMMENT ON TABLE driver_realtime_state IS 'Live driver location and availability snapshot for dispatch candidate generation. Short TTL state, not a historical profile.';
COMMENT ON COLUMN driver_realtime_state.location_updated_at IS 'Timestamp of the latest location/status signal from driver app or dispatch source.';
COMMENT ON COLUMN driver_realtime_state.can_receive_call IS 'True only when the driver can receive a new callcard.';
