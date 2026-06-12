-- matching_scores: 콜카드별 추천 기사 TOP 10
-- /api/matching 에서 upsert
-- was_sent / was_accepted 는 dispatch CSV 적재 후 업데이트

CREATE TABLE IF NOT EXISTS matching_scores (
  call_id       TEXT        NOT NULL,
  driver_id     TEXT        NOT NULL,
  asp_id        INTEGER     NOT NULL,
  match_date    DATE        NOT NULL,
  cosine_score  FLOAT       NOT NULL,
  rank_in_call  INTEGER     NOT NULL CHECK (rank_in_call BETWEEN 1 AND 10),
  was_sent      BOOLEAN     NOT NULL DEFAULT FALSE,
  was_accepted  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (call_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_matching_scores_match_date ON matching_scores (match_date);
CREATE INDEX IF NOT EXISTS idx_matching_scores_call_id    ON matching_scores (call_id);
CREATE INDEX IF NOT EXISTS idx_matching_scores_driver_id  ON matching_scores (driver_id);
CREATE INDEX IF NOT EXISTS idx_matching_scores_rank       ON matching_scores (match_date, rank_in_call);

CREATE OR REPLACE FUNCTION update_matching_scores_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matching_scores_updated_at ON matching_scores;
CREATE TRIGGER trg_matching_scores_updated_at
  BEFORE UPDATE ON matching_scores
  FOR EACH ROW EXECUTE FUNCTION update_matching_scores_updated_at();
