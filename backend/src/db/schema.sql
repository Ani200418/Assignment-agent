-- Runs on every server start. "IF NOT EXISTS" makes it safe to re-run.
-- Timestamps are ISO-8601 UTC strings, e.g. 2026-10-10T12:30:45.123Z

CREATE TABLE IF NOT EXISTS agents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL CHECK (length(trim(name)) > 0),
  module       TEXT    NOT NULL CHECK (module IN ('Task', 'DSC', 'License')),
  description  TEXT,
  status       TEXT    NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'published', 'disabled')),
  config_json  TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id          INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  run_type          TEXT    NOT NULL DEFAULT 'test' CHECK (run_type IN ('test', 'actual')),
  status            TEXT    NOT NULL CHECK (status IN ('success', 'failed')),
  trigger_data_json TEXT,
  result_json       TEXT,
  error_message     TEXT,
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Indexes match the queries we will run: filter agents by module/status,
-- and fetch runs for one agent (or all runs) newest-first.
CREATE INDEX IF NOT EXISTS idx_agents_module_status ON agents (module, status);
CREATE INDEX IF NOT EXISTS idx_agents_updated_at    ON agents (updated_at);
CREATE INDEX IF NOT EXISTS idx_runs_agent_created   ON agent_runs (agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_runs_created         ON agent_runs (created_at);
