-- Preserve source callcard outcome/location fields for live dispatch analysis.
-- These columns let us model EXPIRED/CANCELED call difficulty without changing the existing 22D vector contract.

ALTER TABLE callcard_mbti
  ADD COLUMN IF NOT EXISTS status TEXT NULL,
  ADD COLUMN IF NOT EXISTS status_group TEXT NULL,
  ADD COLUMN IF NOT EXISTS passenger_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NULL,
  ADD COLUMN IF NOT EXISTS passenger_addr TEXT NULL,
  ADD COLUMN IF NOT EXISTS dest_addr TEXT NULL,
  ADD COLUMN IF NOT EXISTS passenger_lat DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS passenger_lng DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS dest_lat DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS dest_lng DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS request_datetime TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS alloc_datetime TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cancel_datetime TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pickup_datetime TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS drop_datetime TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS call_fee INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_callcard_mbti_status ON callcard_mbti (status);
CREATE INDEX IF NOT EXISTS idx_callcard_mbti_status_group ON callcard_mbti (status_group);
CREATE INDEX IF NOT EXISTS idx_callcard_mbti_request_datetime ON callcard_mbti (request_datetime);
