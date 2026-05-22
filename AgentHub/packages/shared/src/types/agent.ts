// ============================================================
// Agent identity, capability, and status types
// ============================================================

export type AgentPlatform = "claude-code" | "opencode" | "codex" | "custom";

export type AgentStatus = "online" | "offline" | "busy" | "error";

export interface AgentCapability {
  label: string;
  description?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  platform: AgentPlatform;
  status: AgentStatus;
  capabilities: AgentCapability[];
  systemPrompt?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentConfigDraft {
  name: string;
  platform: AgentPlatform;
  systemPrompt?: string;
  model?: string;
  capabilities: string[];
}
