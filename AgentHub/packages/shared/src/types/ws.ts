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
  | { type: "tool:invocation"; tool: unknown }
  | { type: "file:changed"; change: unknown }
  | { type: "artifact:created"; artifact: unknown }
  | { type: "typing"; conversationId: string }
  | { type: "joined"; conversationId: string }
  | { type: "error"; message: string; runId?: string };

export type ClientWsEvent =
  | { type: "join:conversation"; conversationId: string }
  | { type: "leave:conversation"; conversationId: string }
  | { type: "typing"; conversationId: string }
  | { type: "cancel:run"; runId: string };
