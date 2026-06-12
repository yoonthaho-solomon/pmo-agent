-- agent_logs: API 에이전트 실행 이력
-- /lib/agent-logger.ts 의 logAgentRun() 에서 INSERT

CREATE TABLE IF NOT EXISTS agent_logs (
  id            BIGSERIAL   PRIMARY KEY,
  run_date      DATE        NOT NULL,
  agent_name    TEXT        NOT NULL,
  input_rows    INTEGER     NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL CHECK (status IN ('success', 'failed')),
  duration_ms   INTEGER     NOT NULL DEFAULT 0,
  error_msg     TEXT        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_run_date    ON agent_logs (run_date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_name  ON agent_logs (agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status      ON agent_logs (status);
