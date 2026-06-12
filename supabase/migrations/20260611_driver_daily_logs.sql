-- driver_daily_logs: 기사별 일일 콜 수신/수락 집계
-- callcard_eta + remapped 엑셀을 파싱해 driver_id + service_date 단위로 저장
-- /api/driver-logs 에서 upsert

CREATE TABLE IF NOT EXISTS driver_daily_logs (
  driver_id             TEXT        NOT NULL,
  asp_id                INTEGER     NOT NULL,
  service_date          DATE        NOT NULL,
  weekday               SMALLINT    NOT NULL,  -- JS getDay(): 0=일, 1=월, …, 6=토

  -- 수신/수락/만료 집계
  total_received        INTEGER     NOT NULL DEFAULT 0,
  total_accepted        INTEGER     NOT NULL DEFAULT 0,
  total_expired         INTEGER     NOT NULL DEFAULT 0,
  accept_rate           FLOAT       NOT NULL DEFAULT 0,

  -- 시간대/지역 배열 (수락된 콜 기준)
  accepted_hours        SMALLINT[]  NOT NULL DEFAULT '{}',
  accepted_s_areas      TEXT[]      NOT NULL DEFAULT '{}',
  accepted_d_areas      TEXT[]      NOT NULL DEFAULT '{}',
  accepted_s_hexagons   TEXT[]      NOT NULL DEFAULT '{}',
  accepted_d_hexagons   TEXT[]      NOT NULL DEFAULT '{}',
  rejected_s_hexagons   TEXT[]      NOT NULL DEFAULT '{}',
  rejected_d_hexagons   TEXT[]      NOT NULL DEFAULT '{}',

  -- 거리/요금 평균
  avg_distance          FLOAT       NULL,
  avg_fare              FLOAT       NULL,

  -- 유료/무료
  paid_accepted         INTEGER     NOT NULL DEFAULT 0,
  free_accepted         INTEGER     NOT NULL DEFAULT 0,

  -- 요금 구간 (수락 콜 기준)
  low_fare_cnt          INTEGER     NOT NULL DEFAULT 0,
  mid_fare_cnt          INTEGER     NOT NULL DEFAULT 0,
  high_fare_cnt         INTEGER     NOT NULL DEFAULT 0,

  -- 상품 유형
  product_normal_cnt    INTEGER     NOT NULL DEFAULT 0,
  product_night_cnt     INTEGER     NOT NULL DEFAULT 0,
  product_surge_cnt     INTEGER     NOT NULL DEFAULT 0,

  -- 거리 구간 (수락 콜 기준)
  short_cnt             INTEGER     NOT NULL DEFAULT 0,
  medium_cnt            INTEGER     NOT NULL DEFAULT 0,
  long_cnt              INTEGER     NOT NULL DEFAULT 0,

  -- 배차 ETA 평균 (초, 수락 콜 기준)
  avg_accept_eta        FLOAT       NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (driver_id, service_date)
);

CREATE INDEX IF NOT EXISTS idx_driver_daily_logs_asp_id       ON driver_daily_logs (asp_id);
CREATE INDEX IF NOT EXISTS idx_driver_daily_logs_service_date ON driver_daily_logs (service_date);
CREATE INDEX IF NOT EXISTS idx_driver_daily_logs_driver_id    ON driver_daily_logs (driver_id);

CREATE OR REPLACE FUNCTION update_driver_daily_logs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_daily_logs_updated_at ON driver_daily_logs;
CREATE TRIGGER trg_driver_daily_logs_updated_at
  BEFORE UPDATE ON driver_daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_driver_daily_logs_updated_at();
