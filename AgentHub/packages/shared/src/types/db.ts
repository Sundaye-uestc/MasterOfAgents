// ============================================================
// Database model types — derived from Drizzle schema
// Used across server and web for type safety
// ============================================================

// --- Conversation ---
export interface ConversationRow {
  id: string;
  title: string;
  type: "direct" | "group";
  status: "active" | "archived";
  pinnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMemberRow {
  id: string;
  conversationId: string;
  agentId: string;
  role: string | null;
  autoReply: number;
  joinedAt: string;
}

// --- Agent ---
export interface AgentRow {
  id: string;
  name: string;
  slug: string | null;
  avatar: string | null;
  adapterKind: string;
  configJson: string;
  capabilitiesJson: string;
  status: string;
  statusReason: string | null;
  lastCheckedAt: string | null;
  isCustom: number;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

// --- Message ---
export interface MessageRow {
  id: string;
  conversationId: string;
  runId: string | null;
  taskId: string | null;
  agentId: string | null;
  replyToId: string | null;
  role: "user" | "agent" | "system" | "tool";
  content: string | null;
  segmentsJson: string | null;
  status: "sending" | "sent" | "streaming" | "error";
  metadataJson: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Run ---
export interface RunRow {
  id: string;
  conversationId: string;
  triggerMessageId: string | null;
  mode: "direct" | "orchestrated";
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "waiting_permission";
  planJson: string | null;
  plannerModel: string | null;
  errorJson: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// --- Task ---
export interface TaskRow {
  id: string;
  runId: string;
  agentId: string | null;
  title: string;
  description: string | null;
  dependenciesJson: string | null;
  status: "queued" | "running" | "completed" | "blocked" | "failed" | "skipped";
  expectedOutput: string | null;
  resultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Tool Invocation ---
export interface ToolInvocationRow {
  id: string;
  runId: string;
  taskId: string | null;
  agentId: string | null;
  toolName: string;
  inputJson: string | null;
  outputJson: string | null;
  status: "running" | "success" | "error";
  startedAt: string | null;
  completedAt: string | null;
}

// --- File Change ---
export interface FileChangeRow {
  id: string;
  runId: string;
  taskId: string | null;
  path: string;
  changeType: "create" | "modify" | "delete";
  beforeHash: string | null;
  afterHash: string | null;
  diff: string | null;
  status: "pending" | "applied" | "reverted";
  createdAt: string;
}

// --- Artifact ---
export interface ArtifactRow {
  id: string;
  runId: string | null;
  messageId: string | null;
  type: "file" | "diff" | "webpage" | "archive" | "slideshow";
  name: string;
  path: string | null;
  mimeType: string | null;
  size: number | null;
  previewUrl: string | null;
  metadataJson: string | null;
  createdAt: string;
}

// --- Workspace ---
export interface WorkspaceRow {
  id: string;
  conversationId: string;
  rootPath: string;
  status: string;
  createdAt: string;
}

export interface WorkspaceSnapshotRow {
  id: string;
  workspaceId: string;
  runId: string | null;
  label: string | null;
  manifestJson: string | null;
  createdAt: string;
}
