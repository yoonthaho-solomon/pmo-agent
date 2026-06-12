-- meter_daily_logs: 천안 미터기 기사별 일일 운행 통계
-- 통계_천안_YYYYMMDD_YYYYMMDD.xlsx Driver Summary 시트 파싱
-- /api/meter-logs 에서 upsert

CREATE TABLE IF NOT EXISTS meter_daily_logs (
  driver_key          TEXT        NOT NULL,
  service_date        DATE        NOT NULL,
  asp_id              BIGINT      NOT NULL DEFAULT 147000000000,

  -- 운행 기본 지표
  start_hour          FLOAT       NULL,   -- 운행 시작 시각
  work_hour           FLOAT       NULL,   -- 근무 시간 (시간)
  travel_min          FLOAT       NULL,   -- 주행 시간 (분)
  dist_km             FLOAT       NULL,   -- 총 주행 거리 (km)
  empty_km            FLOAT       NULL,   -- 공차 거리 (km)

  -- 운행 실적
  ride_count          INTEGER     NULL,   -- 운행 건수
  earning             FLOAT       NULL,   -- 총 매출
  earning_streethail  FLOAT       NULL,   -- 일반 (길거리) 매출
  earning_platform    FLOAT       NULL,   -- 플랫폼 매출
  drive_rate          FLOAT       NULL,   -- 가동률
  earning_per_hour    FLOAT       NULL,   -- 시간당 매출

  -- 파생 비율
  street_ratio        FLOAT       NULL,   -- earning_streethail / earning
  platform_ratio      FLOAT       NULL,   -- earning_platform / earning

  -- 시간대별 운행 건수 (0~23시, JSONB {"0":2,"1":0,...})
  hourly_rides        JSONB       NOT NULL DEFAULT '{}',

  -- 시간대별 플랫폼 운행 건수 (0~23시, JSONB)
  hourly_platform     JSONB       NOT NULL DEFAULT '{}',

  -- 기사 ID (driver_daily_logs 와 조인용, 나중에 매핑)
  driver_id           TEXT        NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (driver_key, service_date)
);

CREATE INDEX IF NOT EXISTS idx_meter_daily_logs_service_date ON meter_daily_logs (service_date);
CREATE INDEX IF NOT EXISTS idx_meter_daily_logs_asp_id       ON meter_daily_logs (asp_id);
CREATE INDEX IF NOT EXISTS idx_meter_daily_logs_driver_id    ON meter_daily_logs (driver_id);

CREATE OR REPLACE FUNCTION update_meter_daily_logs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meter_daily_logs_updated_at ON meter_daily_logs;
CREATE TRIGGER trg_meter_daily_logs_updated_at
  BEFORE UPDATE ON meter_daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_meter_daily_logs_updated_at();
