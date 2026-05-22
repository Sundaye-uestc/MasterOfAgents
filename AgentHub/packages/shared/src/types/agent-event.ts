// ============================================================
// AgentEvent — unified event stream from any Agent platform
// All adapters normalize platform-specific output into these types.
// ============================================================

/** Stream-level lifecycle events */
export interface AgentEventLifecycle {
  type: "run_started";
  runId: string;
  agentId: string;
  timestamp: number;
}

export interface AgentEventCompleted {
  type: "run_completed";
  runId: string;
  summary: string;
  timestamp: number;
}

export interface AgentEventFailed {
  type: "run_failed";
  runId: string;
  error: string;
  timestamp: number;
}

/** Content events — streamed text deltas */
export interface AgentEventTextDelta {
  type: "text_delta";
  runId: string;
  delta: string;
  timestamp: number;
}

/** Tool call lifecycle */
export interface AgentEventToolCall {
  type: "tool_call";
  runId: string;
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  timestamp: number;
}

export interface AgentEventToolResult {
  type: "tool_result";
  runId: string;
  toolCallId: string;
  toolName: string;
  output: string;
  isError?: boolean;
  timestamp: number;
}

/** File system changes detected during the run */
export interface AgentEventFileChange {
  type: "file_change";
  runId: string;
  path: string;
  kind: "create" | "modify" | "delete";
  diff?: string;
  timestamp: number;
}

/** Artifact produced by the run */
export interface AgentEventArtifact {
  type: "artifact_created";
  runId: string;
  artifactId: string;
  artifactType: "file" | "diff" | "webpage" | "archive";
  path: string;
  mimeType?: string;
  timestamp: number;
}

/** Permission / confirmation request from the Agent */
export interface AgentEventPermissionRequest {
  type: "permission_request";
  runId: string;
  permissionId: string;
  toolName: string;
  description: string;
  command?: string;
  timestamp: number;
}

/** Raw stderr log entry */
export interface AgentEventLog {
  type: "log";
  runId: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: number;
}

export type AgentEvent =
  | AgentEventLifecycle
  | AgentEventCompleted
  | AgentEventFailed
  | AgentEventTextDelta
  | AgentEventToolCall
  | AgentEventToolResult
  | AgentEventFileChange
  | AgentEventArtifact
  | AgentEventPermissionRequest
  | AgentEventLog;
