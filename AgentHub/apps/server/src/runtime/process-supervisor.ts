import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { ProcessSpec } from "@agenthub/shared";
import { DEFAULT_RUN_TIMEOUT_MS, MAX_CONCURRENT_PROCESSES } from "@agenthub/shared";

// ============================================================
// ProcessSupervisor — manages Agent subprocesses
// ============================================================

export interface SupervisedProcess {
  processId: string;
  child: ChildProcess;
  startTime: number;
  timeoutMs: number;
  timer: ReturnType<typeof setTimeout>;
}

export interface ProcessOutput {
  processId: string;
  line: string;
  stream: "stdout" | "stderr";
}

export class ProcessSupervisor extends EventEmitter {
  private processes = new Map<string, SupervisedProcess>();

  // --- Event overloads for typed consumption ---

  override on(event: "stdout", listener: (data: ProcessOutput) => void): this;
  override on(event: "stderr", listener: (data: ProcessOutput) => void): this;
  override on(event: "exit", listener: (data: { processId: string; code: number | null }) => void): this;
  override on(event: "timeout", listener: (data: { processId: string }) => void): this;
  override on(event: "error", listener: (data: { processId: string; error: string }) => void): this;
  override on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  override emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  // --- Public API ---

  get activeCount(): number {
    return this.processes.size;
  }

  get activeIds(): string[] {
    return Array.from(this.processes.keys());
  }

  start(spec: ProcessSpec): string {
    if (this.processes.size >= MAX_CONCURRENT_PROCESSES) {
      throw new Error(
        `Max concurrent processes (${MAX_CONCURRENT_PROCESSES}) reached. ` +
        `Active: [${this.activeIds.join(", ")}]`
      );
    }

    if (this.processes.has(spec.processId)) {
      throw new Error(`Process ${spec.processId} is already running`);
    }

    const timeoutMs = spec.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: { ...process.env, ...spec.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      this.emit("timeout", { processId: spec.processId });
      this.stop(spec.processId);
    }, timeoutMs);

    const supervised: SupervisedProcess = {
      processId: spec.processId,
      child,
      startTime: Date.now(),
      timeoutMs,
      timer,
    };

    this.processes.set(spec.processId, supervised);

    // Parse stdout line by line
    let stdoutBuf = "";
    child.stdout!.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          this.emit("stdout", { processId: spec.processId, line, stream: "stdout" });
        }
      }
    });

    // Collect stderr
    let stderrBuf = "";
    child.stderr!.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          this.emit("stderr", { processId: spec.processId, line, stream: "stderr" });
        }
      }
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      // Flush remaining buffers
      if (stdoutBuf.trim()) {
        this.emit("stdout", { processId: spec.processId, line: stdoutBuf.trim(), stream: "stdout" });
      }
      if (stderrBuf.trim()) {
        this.emit("stderr", { processId: spec.processId, line: stderrBuf.trim(), stream: "stderr" });
      }
      this.emit("exit", { processId: spec.processId, code });
      this.processes.delete(spec.processId);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      this.emit("error", { processId: spec.processId, error: err.message });
      this.processes.delete(spec.processId);
    });

    // AbortSignal support
    if (spec.signal) {
      spec.signal.addEventListener("abort", () => {
        this.stop(spec.processId);
      }, { once: true });
    }

    return spec.processId;
  }

  stop(processId: string): void {
    const proc = this.processes.get(processId);
    if (!proc) return;

    clearTimeout(proc.timer);
    try {
      if (process.platform === "win32" && proc.child.pid) {
        // Windows: use taskkill to force-kill the process tree
        spawn("taskkill", ["/PID", String(proc.child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } else {
        // Unix: SIGTERM first, then SIGKILL after grace period
        proc.child.kill("SIGTERM");
        setTimeout(() => {
          if (proc.child.exitCode === null) {
            try { proc.child.kill("SIGKILL"); } catch { /* best effort */ }
          }
        }, 5000);
      }
    } catch {
      // Process already exited
    }
    this.processes.delete(processId);
  }

  writeStdin(processId: string, data: string): void {
    const proc = this.processes.get(processId);
    if (proc?.child.stdin && !proc.child.stdin.destroyed) {
      proc.child.stdin.write(data);
    }
  }

  async dispose(): Promise<void> {
    this.stopAll();
    // Wait briefly for processes to exit
    await new Promise((r) => setTimeout(r, 100));
  }

  stopAll(): void {
    for (const id of this.activeIds) {
      this.stop(id);
    }
  }
}
