-- daily_snapshots: ASP별 일일 KPI 스냅샷 + AI 요약
-- /api/analyze 에서 upsert

CREATE TABLE IF NOT EXISTS daily_snapshots (
  asp_id          INTEGER     NOT NULL,
  service_date    DATE        NOT NULL,

  -- KPI 지표
  total_calls     INTEGER     NOT NULL DEFAULT 0,
  success_count   INTEGER     NOT NULL DEFAULT 0,
  expired_count   INTEGER     NOT NULL DEFAULT 0,
  canceled_count  INTEGER     NOT NULL DEFAULT 0,
  success_rate    FLOAT       NOT NULL DEFAULT 0,
  surge_call_cnt  INTEGER     NOT NULL DEFAULT 0,
  avg_accept_eta  FLOAT       NULL,

  -- Claude AI 요약
  ai_summary      TEXT        NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (asp_id, service_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_service_date ON daily_snapshots (service_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_asp_id       ON daily_snapshots (asp_id);

CREATE OR REPLACE FUNCTION update_daily_snapshots_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_snapshots_updated_at ON daily_snapshots;
CREATE TRIGGER trg_daily_snapshots_updated_at
  BEFORE UPDATE ON daily_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_daily_snapshots_updated_at();
