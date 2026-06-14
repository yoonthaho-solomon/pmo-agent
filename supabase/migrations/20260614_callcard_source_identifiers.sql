-- Preserve source identifiers needed for production driver/vehicle linking.
-- Existing vector calculations continue to use the same 22D feature columns.

ALTER TABLE callcard_mbti
  ADD COLUMN IF NOT EXISTS driver_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS vehicle_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_callcard_mbti_driver_id ON callcard_mbti (driver_id);
CREATE INDEX IF NOT EXISTS idx_callcard_mbti_vehicle_id ON callcard_mbti (vehicle_id);
