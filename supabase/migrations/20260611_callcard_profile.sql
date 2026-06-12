-- callcard_profile: ASP별 콜 수요 프로파일
-- callcard_mbti를 집계해서 /api/callcard-mbti-compute가 upsert
-- driver_mbti와 동일한 스키마 구조, 집계 단위만 asp_id

CREATE TABLE IF NOT EXISTS callcard_profile (
  asp_id            INTEGER     PRIMARY KEY,

  -- 시간대 비율 (합 = 1)
  score_dawn        FLOAT       NOT NULL DEFAULT 0,  -- 0~5시
  score_morning     FLOAT       NOT NULL DEFAULT 0,  -- 6~11시
  score_daytime     FLOAT       NOT NULL DEFAULT 0,  -- 12~17시
  score_night       FLOAT       NOT NULL DEFAULT 0,  -- 18~23시

  -- 요일 비율 (합 = 1, 0=월~6=일)
  score_mon         FLOAT       NOT NULL DEFAULT 0,
  score_tue         FLOAT       NOT NULL DEFAULT 0,
  score_wed         FLOAT       NOT NULL DEFAULT 0,
  score_thu         FLOAT       NOT NULL DEFAULT 0,
  score_fri         FLOAT       NOT NULL DEFAULT 0,
  score_sat         FLOAT       NOT NULL DEFAULT 0,
  score_sun         FLOAT       NOT NULL DEFAULT 0,

  -- 거리 비율 (합 ≤ 1, 거리 미상 콜 제외)
  score_short       FLOAT       NOT NULL DEFAULT 0,  -- ≤3000m
  score_medium      FLOAT       NOT NULL DEFAULT 0,  -- 3001~8000m
  score_long        FLOAT       NOT NULL DEFAULT 0,  -- >8000m

  -- 요금 비율 (합 ≤ 1, 요금 미상 콜 제외)
  score_low_fare    FLOAT       NOT NULL DEFAULT 0,  -- ≤10000원
  score_mid_fare    FLOAT       NOT NULL DEFAULT 0,  -- 10001~20000원
  score_high_fare   FLOAT       NOT NULL DEFAULT 0,  -- >20000원

  -- 유료/무료 비율
  score_paid        FLOAT       NOT NULL DEFAULT 0,
  score_free        FLOAT       NOT NULL DEFAULT 0,

  -- 서지/일반 비율
  score_surge       FLOAT       NOT NULL DEFAULT 0,
  score_normal      FLOAT       NOT NULL DEFAULT 0,

  -- ETA 근접도 (1=매우 가까운 콜 많음, 0=먼 콜 많음)
  score_near        FLOAT       NOT NULL DEFAULT 0,

  -- 선호 출발·도착 헥사곤 (top 3)
  pref_s_hexagons   TEXT[]      NOT NULL DEFAULT '{}',
  pref_d_hexagons   TEXT[]      NOT NULL DEFAULT '{}',

  -- 통계
  total_calls       INTEGER     NOT NULL DEFAULT 0,
  data_days         INTEGER     NOT NULL DEFAULT 0,
  reliability       FLOAT       NOT NULL DEFAULT 0,  -- min(data_days/30, 1.0)

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_callcard_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_callcard_profile_updated_at ON callcard_profile;
CREATE TRIGGER trg_callcard_profile_updated_at
  BEFORE UPDATE ON callcard_profile
  FOR EACH ROW EXECUTE FUNCTION update_callcard_profile_updated_at();
