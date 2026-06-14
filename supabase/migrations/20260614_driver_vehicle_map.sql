-- driver_vehicle_map: production reference table for linking callcard drivers, vehicles, and meter keys.
-- First populated from callcard_mbti(driver_id, vehicle_id). vehicle_no/driver_key are filled when a vehicle-number source is available.

CREATE TABLE IF NOT EXISTS driver_vehicle_map (
  driver_id        TEXT        NOT NULL,
  vehicle_id       TEXT        NOT NULL,
  vehicle_no       TEXT        NULL,
  driver_key       TEXT        NULL,
  asp_id           INTEGER     NULL,
  first_call_date  DATE        NULL,
  last_call_date   DATE        NULL,
  call_count       INTEGER     NOT NULL DEFAULT 0,
  source           TEXT        NOT NULL DEFAULT 'callcard_mbti',
  confidence       FLOAT       NOT NULL DEFAULT 0.7,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE driver_vehicle_map
  ADD COLUMN IF NOT EXISTS driver_id TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_id TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_no TEXT,
  ADD COLUMN IF NOT EXISTS driver_key TEXT,
  ADD COLUMN IF NOT EXISTS asp_id INTEGER,
  ADD COLUMN IF NOT EXISTS first_call_date DATE,
  ADD COLUMN IF NOT EXISTS last_call_date DATE,
  ADD COLUMN IF NOT EXISTS call_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'callcard_mbti',
  ADD COLUMN IF NOT EXISTS confidence FLOAT NOT NULL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS ux_driver_vehicle_map_driver_vehicle ON driver_vehicle_map (driver_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_driver_vehicle_map_driver_id ON driver_vehicle_map (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_vehicle_map_vehicle_id ON driver_vehicle_map (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_driver_vehicle_map_vehicle_no ON driver_vehicle_map (vehicle_no);
CREATE INDEX IF NOT EXISTS idx_driver_vehicle_map_driver_key ON driver_vehicle_map (driver_key);

CREATE OR REPLACE FUNCTION update_driver_vehicle_map_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_vehicle_map_updated_at ON driver_vehicle_map;
CREATE TRIGGER trg_driver_vehicle_map_updated_at
  BEFORE UPDATE ON driver_vehicle_map
  FOR EACH ROW EXECUTE FUNCTION update_driver_vehicle_map_updated_at();
