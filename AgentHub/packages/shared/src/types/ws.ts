// ============================================================
// WebSocket event types — shared between server and client
// ============================================================

export type ServerWsEvent =
  | { type: "message:created"; message: unknown }
  | { type: "message:delta"; messageId: string; delta: string }
  | { type: "message:completed"; messageId: string }
  | { type: "run:started"; runId: string }
  | { type: "run:completed"; runId: string }
  | { type: "run:failed"; runId: string; error: string }
  | { type: "run:status"; runId: string; status: string; progress?: { completed: number; total: number } }
  | { type: "task:started"; runId: string; taskId: string; agentId: string }
  | { type: "task:completed"; runId: string; taskId: string; resultSummary: string }
  | { type: "task:failed"; runId: string; taskId: string; error: string }
  | { type: "orchestrator:plan_created"; runId: string; plan: unknown }
  | { type: "orchestrator:confirmation_needed"; runId: string; taskId: string; taskTitle: string }
  | { type: "tool:invocation"; messageId: string; invocation: unknown }
  | { type: "file:changed"; change: unknown }
  | { type: "artifact:created"; artifact: unknown }
  | { type: "permission:requested"; permission: unknown }
  | { type: "agent:config_draft"; draft: unknown }
  | { type: "typing"; conversationId: string }
  | { type: "joined"; conversationId: string }
  | { type: "error"; message: string; runId?: string };

export type ClientWsEvent =
  | { type: "join:conversation"; conversationId: string }
  | { type: "leave:conversation"; conversationId: string }
  | { type: "typing"; conversationId: string }
  | { type: "cancel:run"; runId: string }
  | { type: "permission:respond"; runId: string; permissionId: string; approved: boolean };
