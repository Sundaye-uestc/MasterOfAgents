// ============================================================
// ClaudeCodeAdapter — Claude Code CLI via subprocess
//
// Uses the globally installed `claude` CLI to execute prompts
// and normalizes output into the unified AgentEvent stream.
//
// Phase 0 decision: CLI subprocess (most reliable path).
// The `claude` binary is already installed on this machine.
// ============================================================

import type { AgentEvent, AgentConfig } from "@agenthub/shared";
import type { AgentPlatformAdapter, RunInput } from "./base.js";
import { parseStreamLine, isStreamComplete } from "../runtime/stream-json-parser.js";
import { ProcessSupervisor } from "../runtime/process-supervisor.js";

export class ClaudeCodeAdapter implements AgentPlatformAdapter {
  readonly platform = "claude-code";

  private supervisor = new ProcessSupervisor();
  private agentConfig: AgentConfig | null = null;
  private activeRunIds = new Set<string>();
  private activeSupervisors = new Map<string, ProcessSupervisor>();
  private permissionMode: "bypass" | "interactive";

  constructor(options?: { permissionMode?: "bypass" | "interactive" }) {
    this.permissionMode = options?.permissionMode ?? "interactive";
  }

  async prepare(agent: AgentConfig): Promise<void> {
    this.agentConfig = agent;
    await this.verifyCli();
  }

  /** Respond to a permission request by writing to the subprocess stdin */
  respondToPermission(runId: string, permissionId: string, response: "allow" | "deny"): void {
    const sup = this.activeSupervisors.get(runId);
    if (!sup) {
      console.warn(`[claude-adapter] no supervisor for run ${runId}`);
      return;
    }
    // Claude CLI expects "allow\n" or "deny\n" on stdin
    const input = response === "allow" ? `allow\n` : `deny\n`;
    sup.writeStdin(`claude-${runId}`, input);
  }

  private async verifyCli(): Promise<void> {
    // Quick version check to confirm claude is functional
    const procId = "claude-verify";
    const supervisor = new ProcessSupervisor();

    await new Promise<void>((resolve, reject) => {
      supervisor.on("exit", () => resolve());
      supervisor.on("error", ({ error }) => reject(new Error(`Claude CLI check failed: ${error}`)));
      supervisor.start({
        processId: procId,
        command: "claude",
        args: ["--version"],
        timeoutMs: 30_000,
      });
    });

    supervisor.dispose();
  }

  async *run(input: RunInput): AsyncIterable<AgentEvent> {
    if (!this.agentConfig) {
      throw new Error("Adapter not prepared. Call prepare() first.");
    }

    const { runId, agentId, prompt, systemPrompt, workingDir, signal } = input;
    this.activeRunIds.add(runId);

    const ts = Date.now();
    yield { type: "run_started", runId, agentId, timestamp: ts };

    const args = [
      "-p", prompt,
      "--output-format", "stream-json",
      "--no-session-persistence",
      "--verbose",
    ];

    if (this.permissionMode === "bypass") {
      args.push("--permission-mode", "bypassPermissions");
    }

    if (systemPrompt) {
      args.push("--system-prompt", systemPrompt);
    }

    const processId = `claude-${runId}`;
    const sup = new ProcessSupervisor();

    // Set up abort signal listener
    if (signal) {
      signal.addEventListener("abort", () => sup.stop(processId), { once: true });
    }

    try {
      this.activeSupervisors.set(runId, sup);
      const events = this.runViaEventEmitter(sup, processId, args, workingDir, runId, agentId, signal);
      for await (const event of events) {
        yield event;
      }
    } catch (err) {
      yield {
        type: "run_failed",
        runId,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      };
    } finally {
      this.activeRunIds.delete(runId);
      this.activeSupervisors.delete(runId);
      await sup.dispose();
    }
  }

  /** Bridge from EventEmitter ProcessSupervisor to AsyncIterable<AgentEvent> */
  private async *runViaEventEmitter(
    sup: ProcessSupervisor,
    processId: string,
    args: string[],
    workingDir: string | undefined,
    runId: string,
    agentId: string,
    signal?: AbortSignal
  ): AsyncIterable<AgentEvent> {
    // Event queue
    type QueuedEvent =
      | { kind: "stdout"; line: string }
      | { kind: "stderr"; line: string }
      | { kind: "exit"; code: number | null }
      | { kind: "error"; error: string };

    const queue: QueuedEvent[] = [];
    let resolveWait: (() => void) | null = null;
    let finished = false;

    const push = (ev: QueuedEvent) => {
      queue.push(ev);
      resolveWait?.();
    };

    sup.on("stdout", (data) => push({ kind: "stdout", line: data.line }));
    sup.on("stderr", (data) => push({ kind: "stderr", line: data.line }));
    sup.on("exit", (data) => { push({ kind: "exit", code: data.code }); finished = true; resolveWait?.(); });
    sup.on("timeout", () => { push({ kind: "error", error: "Process timed out" }); finished = true; resolveWait?.(); });
    sup.on("error", (data) => { push({ kind: "error", error: data.error }); finished = true; resolveWait?.(); });

    sup.start({
      processId,
      command: "claude",
      args,
      cwd: workingDir,
      timeoutMs: 10 * 60 * 1000,
      signal,
    });

    while (true) {
      // Drain queue
      while (queue.length > 0) {
        const ev = queue.shift()!;
        switch (ev.kind) {
          case "stdout": {
            const parsed = parseStreamLine(ev.line, runId, agentId);
            if (parsed) {
              yield parsed;
              if (isStreamComplete(ev.line)) {
                return; // stream-json "result" type — done
              }
            }
            break;
          }
          case "stderr":
            // Detect permission prompts from stderr patterns
            if (/permission|approval|grant|authorization/i.test(ev.line)) {
              yield {
                type: "permission_request",
                runId,
                permissionId: `perm-${runId}-${Date.now()}`,
                toolName: "unknown",
                description: ev.line,
                timestamp: Date.now(),
              };
            } else {
              yield { type: "log", runId, level: "warn", message: ev.line, timestamp: Date.now() };
            }
            break;
          case "error":
            yield { type: "run_failed", runId, error: ev.error, timestamp: Date.now() };
            return;
          case "exit": {
            if (ev.code === 0) {
              yield { type: "run_completed", runId, summary: "Claude Code run completed", timestamp: Date.now() };
            } else {
              yield { type: "run_failed", runId, error: `Exit code ${ev.code}`, timestamp: Date.now() };
            }
            return;
          }
        }
      }

      if (finished && queue.length === 0) return;

      // Check abort
      if (signal?.aborted) {
        sup.stop(processId);
        return;
      }

      // Wait for more events
      await new Promise<void>((resolve) => { resolveWait = resolve; });
    }
  }

  async stop(runId: string): Promise<void> {
    const sup = new ProcessSupervisor();
    sup.stop(`claude-${runId}`);
    this.activeRunIds.delete(runId);
    await sup.dispose();
  }

  async dispose(): Promise<void> {
    for (const runId of this.activeRunIds) {
      await this.stop(runId);
    }
    await this.supervisor.dispose();
    this.agentConfig = null;
  }
}
