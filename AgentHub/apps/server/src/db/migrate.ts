// ============================================================
// Schema migration — creates tables if they don't exist
// Called on startup; uses IF NOT EXISTS for idempotency
// ============================================================

import type { Database as SqlJsDb } from "sql.js";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  pinned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  agent_id TEXT NOT NULL,
  role TEXT,
  auto_reply INTEGER DEFAULT 1,
  joined_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  avatar TEXT,
  adapter_kind TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  capabilities_json TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'unknown',
  status_reason TEXT,
  last_checked_at TEXT,
  is_custom INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  run_id TEXT,
  task_id TEXT,
  agent_id TEXT,
  reply_to_id TEXT,
  role TEXT NOT NULL,
  content TEXT,
  segments_json TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  trigger_message_id TEXT,
  mode TEXT NOT NULL DEFAULT 'direct',
  status TEXT NOT NULL DEFAULT 'queued',
  plan_json TEXT,
  planner_model TEXT,
  error_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  agent_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  dependencies_json TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  expected_output TEXT,
  result_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_invocations (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  task_id TEXT,
  agent_id TEXT,
  tool_name TEXT NOT NULL,
  input_json TEXT,
  output_json TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  root_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  run_id TEXT,
  label TEXT,
  manifest_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_changes (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  task_id TEXT,
  path TEXT NOT NULL,
  change_type TEXT NOT NULL,
  before_hash TEXT,
  after_hash TEXT,
  diff TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  message_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT,
  mime_type TEXT,
  size INTEGER,
  preview_url TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  action TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  provider TEXT,
  encrypted_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  artifact_id TEXT,
  run_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  target TEXT,
  url TEXT,
  log TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY DEFAULT 'default',
  avatar TEXT,
  updated_at TEXT NOT NULL
);
`;

export function runMigrations(sqlDb: SqlJsDb) {
  // sql.js doesn't support multiple statements in one run() call,
  // so we split by semicolons
  const statements = SCHEMA_SQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    sqlDb.run(stmt + ";");
  }
}
