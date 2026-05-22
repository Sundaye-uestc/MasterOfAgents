// ============================================================
// Process specification for spawning Agent subprocesses
// ============================================================

export interface ProcessSpec {
  /** Unique id for this process instance */
  processId: string;
  /** Executable command */
  command: string;
  /** CLI arguments */
  args: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Timeout in milliseconds, default 600000 (10 min) */
  timeoutMs?: number;
  /** AbortSignal-like for external cancellation */
  signal?: { aborted: boolean; addEventListener(type: "abort", listener: () => void, options?: { once?: boolean }): void };
}

export type ProcessEventType = "stdout" | "stderr" | "exit" | "timeout" | "error";

export interface ProcessEvent {
  type: ProcessEventType;
  processId: string;
  data?: string;
  exitCode?: number | null;
  error?: string;
  timestamp: number;
}
