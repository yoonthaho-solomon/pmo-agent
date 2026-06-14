-- Speed up call outcome analysis filters used by /api/callcard-outcomes.
-- Apply before enabling asp_id-scoped outcome risk queries in the simulator.

CREATE INDEX IF NOT EXISTS idx_callcard_mbti_outcome_asp_date_callid
  ON callcard_mbti (asp_id, call_date, callcard_id)
  WHERE status_group IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_callcard_mbti_outcome_date_callid
  ON callcard_mbti (call_date, callcard_id)
  WHERE status_group IS NOT NULL;