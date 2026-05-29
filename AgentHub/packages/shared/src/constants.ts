// ============================================================
// Constants shared between frontend and backend
// ============================================================

/** Maximum concurrent Agent processes */
export const MAX_CONCURRENT_PROCESSES = 3;

/** Default timeout for a single run (10 minutes) */
export const DEFAULT_RUN_TIMEOUT_MS = 10 * 60 * 1000;

/** Maximum tool loop rounds per run */
export const MAX_TOOL_ROUNDS = 100;

/** Supported Agent platforms */
export const AGENT_PLATFORMS = ["claude-code", "opencode", "codex", "custom"] as const;

/** Sandbox modes */
export const SANDBOX_MODES = {
  READONLY: "readonly",
  DEV: "dev",
  DEPLOY: "deploy",
} as const;

/** Artifact types */
export const ARTIFACT_TYPES = {
  FILE: "file",
  DIFF: "diff",
  WEBPAGE: "webpage",
  ARCHIVE: "archive",
} as const;

/** Deployment statuses */
export const DEPLOY_STATUSES = {
  PENDING: "pending",
  BUILDING: "building",
  DEPLOYED: "deployed",
  FAILED: "failed",
} as const;

/** File change types */
export const FILE_CHANGE_TYPES = {
  CREATE: "create",
  MODIFY: "modify",
  DELETE: "delete",
} as const;

/** File change statuses */
export const FILE_CHANGE_STATUSES = {
  PENDING: "pending",
  APPLIED: "applied",
  REVERTED: "reverted",
} as const;

/** WebSocket event names (server → client) */
export const WS_SERVER_EVENTS = {
  MESSAGE_CREATED: "message:created",
  MESSAGE_UPDATED: "message:updated",
  MESSAGE_DELETED: "message:deleted",
  RUN_STARTED: "run:started",
  RUN_UPDATED: "run:updated",
  RUN_COMPLETED: "run:completed",
  TASK_STARTED: "task:started",
  TASK_COMPLETED: "task:completed",
  TOOL_INVOCATION: "tool:invocation",
  FILE_CHANGED: "file:changed",
  ARTIFACT_CREATED: "artifact:created",
  DEPLOY_STATUS: "deploy:status",
  AGENT_STATUS: "agent:status",
  ERROR: "error",
} as const;

/** WebSocket event names (client → server) */
export const WS_CLIENT_EVENTS = {
  JOIN_CONVERSATION: "join:conversation",
  LEAVE_CONVERSATION: "leave:conversation",
  TYPING: "typing",
  CANCEL_RUN: "cancel:run",
} as const;
