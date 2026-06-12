-- callcard_mbti: 콜카드별 MBTI 벡터 테이블
-- callcard_eta + remapped 엑셀을 파싱해 콜 단위로 저장
-- /api/callcard-mbti 에서 upsert

CREATE TABLE IF NOT EXISTS callcard_mbti (
  callcard_id       TEXT        PRIMARY KEY,
  asp_id            INTEGER     NOT NULL,
  call_date         DATE        NOT NULL,
  hour_slot         SMALLINT    NOT NULL CHECK (hour_slot BETWEEN 0 AND 23),
  weekday           SMALLINT    NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0=월, 6=일
  s_area            TEXT        NOT NULL DEFAULT '',
  s_hexagon         TEXT        NOT NULL DEFAULT '',
  d_area            TEXT        NOT NULL DEFAULT '',
  d_hexagon         TEXT        NOT NULL DEFAULT '',
  expected_distance INTEGER     NOT NULL DEFAULT 0,  -- 미터
  expected_fare     INTEGER     NOT NULL DEFAULT 0,  -- 원
  is_paid           BOOLEAN     NOT NULL DEFAULT FALSE,
  eta_distance      INTEGER     NULL,                -- 초, 없으면 NULL
  product_type      TEXT        NOT NULL DEFAULT '',
  is_surge          BOOLEAN     NOT NULL DEFAULT FALSE,
  urgency_score     FLOAT       NOT NULL DEFAULT 0.0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 날짜·ASP별 조회에 사용
CREATE INDEX IF NOT EXISTS idx_callcard_mbti_call_date ON callcard_mbti (call_date);
CREATE INDEX IF NOT EXISTS idx_callcard_mbti_asp_id    ON callcard_mbti (asp_id);
CREATE INDEX IF NOT EXISTS idx_callcard_mbti_s_hexagon ON callcard_mbti (s_hexagon);
CREATE INDEX IF NOT EXISTS idx_callcard_mbti_d_hexagon ON callcard_mbti (d_hexagon);

-- upsert 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_callcard_mbti_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_callcard_mbti_updated_at ON callcard_mbti;
CREATE TRIGGER trg_callcard_mbti_updated_at
  BEFORE UPDATE ON callcard_mbti
  FOR EACH ROW EXECUTE FUNCTION update_callcard_mbti_updated_at();
