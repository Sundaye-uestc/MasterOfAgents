// ============================================================
// Drizzle ORM schema — SQLite tables for AgentHub
// ============================================================

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// --- Conversations ---
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(), // "direct" | "group"
  status: text("status").notNull().default("active"), // "active" | "archived"
  pinnedAt: text("pinned_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// --- Conversation Members (for group chats) ---
export const conversationMembers = sqliteTable("conversation_members", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  agentId: text("agent_id").notNull(),
  role: text("role"), // "participant" | "observer"
  autoReply: integer("auto_reply").default(1),
  joinedAt: text("joined_at").notNull(),
});

// --- Agents ---
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  avatar: text("avatar"),
  adapterKind: text("adapter_kind").notNull(), // "claude-code" | "codex" | "opencode" | "custom"
  configJson: text("config_json").notNull().default("{}"),
  capabilitiesJson: text("capabilities_json").default("[]"),
  status: text("status").notNull().default("unknown"), // "online" | "offline" | "busy" | "error"
  statusReason: text("status_reason"),
  lastCheckedAt: text("last_checked_at"),
  isCustom: integer("is_custom").default(0),
  enabled: integer("enabled").default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// --- Messages ---
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  runId: text("run_id"),
  taskId: text("task_id"),
  agentId: text("agent_id"),
  replyToId: text("reply_to_id"),
  role: text("role").notNull(), // "user" | "agent" | "system" | "tool"
  content: text("content"),
  segmentsJson: text("segments_json"), // JSON array of content segments
  status: text("status").notNull().default("sent"), // "sending" | "sent" | "streaming" | "error"
  metadataJson: text("metadata_json"), // { pinned, edited, etc }
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// --- Runs ---
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  triggerMessageId: text("trigger_message_id"),
  mode: text("mode").notNull().default("direct"), // "direct" | "orchestrated"
  status: text("status").notNull().default("queued"), // "queued" | "running" | "completed" | "failed" | "cancelled"
  planJson: text("plan_json"),
  plannerModel: text("planner_model"),
  errorJson: text("error_json"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});

// --- Tasks (for orchestrated runs) ---
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runs.id),
  agentId: text("agent_id"),
  title: text("title").notNull(),
  description: text("description"),
  dependenciesJson: text("dependencies_json"), // JSON array of task IDs
  status: text("status").notNull().default("queued"),
  expectedOutput: text("expected_output"),
  resultSummary: text("result_summary"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// --- Tool Invocations ---
export const toolInvocations = sqliteTable("tool_invocations", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runs.id),
  taskId: text("task_id"),
  agentId: text("agent_id"),
  toolName: text("tool_name").notNull(),
  inputJson: text("input_json"),
  outputJson: text("output_json"),
  status: text("status").notNull().default("running"), // "running" | "success" | "error"
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
});

// --- Workspaces ---
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  rootPath: text("root_path").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
});

// --- Workspace Snapshots ---
export const workspaceSnapshots = sqliteTable("workspace_snapshots", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  runId: text("run_id"),
  label: text("label"),
  manifestJson: text("manifest_json"),
  createdAt: text("created_at").notNull(),
});

// --- File Changes ---
export const fileChanges = sqliteTable("file_changes", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runs.id),
  taskId: text("task_id"),
  path: text("path").notNull(),
  changeType: text("change_type").notNull(), // "create" | "modify" | "delete"
  beforeHash: text("before_hash"),
  afterHash: text("after_hash"),
  diff: text("diff"),
  status: text("status").notNull().default("pending"), // "pending" | "applied" | "reverted"
  createdAt: text("created_at").notNull(),
});

// --- Artifacts ---
export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  runId: text("run_id"),
  messageId: text("message_id"),
  type: text("type").notNull(), // "file" | "diff" | "webpage" | "archive"
  name: text("name").notNull(),
  path: text("path"),
  mimeType: text("mime_type"),
  size: integer("size"),
  previewUrl: text("preview_url"),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull(),
});

// --- Audit Logs ---
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  runId: text("run_id"),
  action: text("action").notNull(),
  detailJson: text("detail_json"),
  createdAt: text("created_at").notNull(),
});

// --- Secrets ---
export const secrets = sqliteTable("secrets", {
  id: text("id").primaryKey(),
  name: text("name").unique().notNull(),
  provider: text("provider"),
  encryptedValue: text("encrypted_value").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// --- Deployments ---
export const deployments = sqliteTable("deployments", {
  id: text("id").primaryKey(),
  artifactId: text("artifact_id"),
  runId: text("run_id"),
  status: text("status").notNull().default("pending"),
  target: text("target"),
  url: text("url"),
  log: text("log"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});
