import type { AgentEvent, AgentConfig } from "@agenthub/shared";

// ============================================================
// AgentPlatformAdapter — all platform adapters implement this
// ============================================================

export interface RunInput {
  runId: string;
  agentId: string;
  prompt: string;
  systemPrompt?: string;
  /** Previous conversation messages for short-term memory context */
  messageHistory?: Array<{ role: "user" | "agent" | "system"; content: string }>;
  workingDir?: string;
  signal?: AbortSignal;
}

export interface AgentPlatformAdapter {
  /** Human-readable platform name */
  readonly platform: string;

  /** Prepare the environment (install deps, check CLI, etc.) */
  prepare(agent: AgentConfig): Promise<void>;

  /** Execute a run, yielding normalized AgentEvent stream */
  run(input: RunInput): AsyncIterable<AgentEvent>;

  /** Stop an active run */
  stop(runId: string): Promise<void>;

  /** Cleanup adapter resources */
  dispose(): Promise<void>;
}
