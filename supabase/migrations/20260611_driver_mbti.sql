-- driver_mbti: 기사별 누적 MBTI 프로파일 (최근 30일 가중 집계)
-- /api/driver-mbti 에서 upsert

CREATE TABLE IF NOT EXISTS driver_mbti (
  driver_id             TEXT        PRIMARY KEY,
  asp_id                INTEGER     NOT NULL,

  -- 시간대 비율 (합 = 1)
  score_dawn            FLOAT       NOT NULL DEFAULT 0,  -- 0~5시
  score_morning         FLOAT       NOT NULL DEFAULT 0,  -- 6~11시
  score_daytime         FLOAT       NOT NULL DEFAULT 0,  -- 12~17시
  score_night           FLOAT       NOT NULL DEFAULT 0,  -- 18~23시

  -- 요일 비율 (합 = 1, JS getDay() 기준: sun=0, mon=1, …, sat=6)
  score_sun             FLOAT       NOT NULL DEFAULT 0,
  score_mon             FLOAT       NOT NULL DEFAULT 0,
  score_tue             FLOAT       NOT NULL DEFAULT 0,
  score_wed             FLOAT       NOT NULL DEFAULT 0,
  score_thu             FLOAT       NOT NULL DEFAULT 0,
  score_fri             FLOAT       NOT NULL DEFAULT 0,
  score_sat             FLOAT       NOT NULL DEFAULT 0,

  -- 거리 구간 비율 (합 ≤ 1)
  score_short           FLOAT       NOT NULL DEFAULT 0,  -- ≤3000m
  score_medium          FLOAT       NOT NULL DEFAULT 0,  -- 3001~8000m
  score_long            FLOAT       NOT NULL DEFAULT 0,  -- >8000m

  -- 요금 구간 비율 (합 ≤ 1)
  score_low_fare        FLOAT       NOT NULL DEFAULT 0,  -- ≤10000원
  score_mid_fare        FLOAT       NOT NULL DEFAULT 0,  -- 10001~20000원
  score_high_fare       FLOAT       NOT NULL DEFAULT 0,  -- >20000원

  -- 유료/무료 비율
  score_paid            FLOAT       NOT NULL DEFAULT 0,
  score_free            FLOAT       NOT NULL DEFAULT 0,

  -- 서지/일반 비율
  score_surge           FLOAT       NOT NULL DEFAULT 0,
  score_normal          FLOAT       NOT NULL DEFAULT 0,

  -- 배차 근접도 (1=가까운 콜 많음, 0=먼 콜 많음)
  score_near            FLOAT       NOT NULL DEFAULT 0,

  -- 선호 출발·도착 헥사곤 (top 3, 가중 빈도 기준)
  pref_s_hexagons       TEXT[]      NOT NULL DEFAULT '{}',
  pref_d_hexagons       TEXT[]      NOT NULL DEFAULT '{}',

  -- 통계
  data_days             INTEGER     NOT NULL DEFAULT 0,  -- 실제 데이터 일수
  reliability           FLOAT       NOT NULL DEFAULT 0,  -- min(data_days/30, 1.0)

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_mbti_asp_id ON driver_mbti (asp_id);

CREATE OR REPLACE FUNCTION update_driver_mbti_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_mbti_updated_at ON driver_mbti;
CREATE TRIGGER trg_driver_mbti_updated_at
  BEFORE UPDATE ON driver_mbti
  FOR EACH ROW EXECUTE FUNCTION update_driver_mbti_updated_at();
