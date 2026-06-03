// ============================================================
// CodexAdapter — Codex/OpenCode CLI via subprocess
//
// Uses globally installed `codex` or `opencode` CLI.
// Normalizes output into the unified AgentEvent stream.
// ============================================================

import type { AgentEvent, AgentConfig } from "@agenthub/shared";
import type { AgentPlatformAdapter, RunInput } from "./base.js";
import { parseStreamLine, isStreamComplete } from "../runtime/stream-json-parser.js";
import { ProcessSupervisor } from "../runtime/process-supervisor.js";
import { crashLog } from "../lib/crash-log.js";
import * as path from "node:path";
import * as fs from "node:fs";

export class CodexAdapter implements AgentPlatformAdapter {
  readonly platform: string;

  private supervisor = new ProcessSupervisor();
  private agentConfig: AgentConfig | null = null;
  private activeRunIds = new Set<string>();
  private activeSupervisors = new Map<string, ProcessSupervisor>();
  private permissionMode: "bypass" | "interactive";
  private cliCommand: string;

  constructor(options?: { permissionMode?: "bypass" | "interactive"; platform?: string }) {
    this.platform = options?.platform ?? "codex";
    this.permissionMode = options?.permissionMode ?? "bypass";
    this.cliCommand = this.platform === "opencode" ? "opencode" : "codex";
  }

  async prepare(agent: AgentConfig): Promise<void> {
    this.agentConfig = agent;
    await this.verifyCli();
  }

  respondToPermission(runId: string, permissionId: string, response: "allow" | "deny"): void {
    const sup = this.activeSupervisors.get(runId);
    if (!sup) {
      console.warn(`[${this.platform}-adapter] no supervisor for run ${runId}`);
      return;
    }
    const input = response === "allow" ? "allow\n" : "deny\n";
    sup.writeStdin(`${this.platform}-${runId}`, input);
  }

  private async verifyCli(): Promise<void> {
    const procId = `${this.platform}-verify`;
    const supervisor = new ProcessSupervisor();

    await new Promise<void>((resolve, reject) => {
      supervisor.on("exit", () => resolve());
      supervisor.on("error", ({ error }) => reject(new Error(`${this.cliCommand} CLI check failed: ${error}`)));
      supervisor.start({
        processId: procId,
        command: this.cliCommand,
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

    const { runId, agentId, prompt, systemPrompt, messageHistory, workingDir, signal } = input;
    this.activeRunIds.add(runId);

    const ts = Date.now();
    yield { type: "run_started", runId, agentId, timestamp: ts };

    // Build effective system prompt: inject conversation history for short-term memory
    let effectiveSystemPrompt = systemPrompt ?? this.agentConfig.systemPrompt ?? "";

    // Explicitly tell the agent its working directory so it doesn't forget
    const cwd = workingDir ?? process.cwd();
    const cwdBlock = `\n当前工作目录: ${cwd}\n请将所有新建/修改的文件放在此目录下，除非用户明确指定了其他路径。\n请始终使用中文进行思考和回复，包括工具调用中的描述文本和文件内容（代码和配置文件除外）。`;

    if (messageHistory && messageHistory.length > 0) {
      const historyBlock = messageHistory
        .map((m) => `[${m.role === "user" ? "用户" : m.role === "agent" ? "AI助手" : "系统"}]: ${m.content}`)
        .join("\n\n");
      effectiveSystemPrompt = `以下是本次对话的历史记录（按时间顺序）：\n\n${historyBlock}\n\n---\n以上是对话历史。现在请根据以下用户的最新消息进行回复。${cwdBlock}\n${effectiveSystemPrompt}`;
    } else {
      effectiveSystemPrompt = effectiveSystemPrompt + cwdBlock;
    }

    const args = [
      "-p", prompt,
      "--output-format", "stream-json",
      "--no-session-persistence",
      "--verbose",
    ];

    if (this.permissionMode === "bypass") {
      args.push("--permission-mode", "bypassPermissions");
    }

    // Add PPT generation capability instructions
    const pptDir = path.resolve(process.cwd(), "..", "ppt");
    const pptAvailable = fs.existsSync(path.join(pptDir, "generate_ppt.py"));
    let pptBlock = "";
    if (pptAvailable) {
      pptBlock = `
## PPT 生成能力

你可以为用户生成 PPT。有两种方式，根据需求选择：

### 方式一：AI 图示幻灯片（推荐用于演示/汇报）
使用 NanoBanana (Gemini) 生成带 AI 图示的高质量 16:9 幻灯片图片：

1. **规划**: 创建 slides_plan.json（cover/content/data 页面类型）
2. **生成**: \`python ${pptDir.replace(/\\/g, '\\\\')}\\\\generate_ppt.py --plan slides_plan.json --style gradient-glass --resolution 2K --output ppt_output\`
3. 结果：ppt_output/index.html（播放器）+ ppt_output/images/（幻灯片图片）

### 方式二：程序化 PPTX（推荐用于简单文字/表格 PPT）
使用 pptxgenjs Node.js 库直接生成 .pptx 文件。生成后系统会自动创建 HTML 内联预览。

### ⚠️ 重要约束
- **绝对禁止**尝试安装或使用 LibreOffice、PowerShell COM 对象、或其他工具将 PPTX 导出为图片来做"视觉审查"
- **绝对禁止**生成后做子代理视觉审查（sub-agent review）——系统已自动生成 HTML 预览给用户
- 生成完成后只需验证文件存在且大小合理（>1KB），然后直接告知用户结果
- 如果有小问题用户会自行反馈，无需预先修复

其他参数:
- 风格: gradient-glass (科技商务), vector-illustration (教育培训)
- 分辨率: 2K (推荐，快速), 4K (高清打印)
- 生成约 30 秒/页，请提前告知用户
- 默认 5-7 页
`;
    }
    effectiveSystemPrompt = effectiveSystemPrompt + pptBlock;

    if (effectiveSystemPrompt) {
      args.push("--system-prompt", effectiveSystemPrompt);
    }

    const processId = `${this.platform}-${runId}`;
    const sup = new ProcessSupervisor();

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
      crashLog(`[codex] run() finally — disposing supervisor`);
      this.activeRunIds.delete(runId);
      this.activeSupervisors.delete(runId);
      await sup.dispose();
      crashLog(`[codex] run() finally — supervisor disposed`);
    }
  }

  private async *runViaEventEmitter(
    sup: ProcessSupervisor,
    processId: string,
    args: string[],
    workingDir: string | undefined,
    runId: string,
    agentId: string,
    signal?: AbortSignal
  ): AsyncIterable<AgentEvent> {
    type QueuedEvent =
      | { kind: "stdout"; line: string }
      | { kind: "stderr"; line: string }
      | { kind: "exit"; code: number | null }
      | { kind: "error"; error: string };

    const queue: QueuedEvent[] = [];
    let resolveWait: (() => void) | null = null;
    let finished = false;
    let lastActivity = Date.now();
    const IDLE_KILL_MS = 3 * 60 * 1000; // kill if no output for 3 minutes
    const WAKEUP_INTERVAL_MS = 30_000;  // re-check every 30 seconds

    const wake = () => {
      lastActivity = Date.now();
      resolveWait?.();
    };

    const push = (ev: QueuedEvent) => {
      queue.push(ev);
      wake();
    };

    sup.on("stdout", (data) => push({ kind: "stdout", line: data.line }));
    sup.on("stderr", (data) => push({ kind: "stderr", line: data.line }));
    sup.on("exit", (data) => { push({ kind: "exit", code: data.code }); finished = true; wake(); });
    sup.on("timeout", () => { push({ kind: "error", error: "Process timed out" }); finished = true; wake(); });
    sup.on("error", (data) => { push({ kind: "error", error: data.error }); finished = true; wake(); });

    // Also wake when the abort signal fires, so the loop detects it
    if (signal) {
      signal.addEventListener("abort", wake, { once: true });
    }

    sup.start({
      processId,
      command: this.cliCommand,
      args,
      cwd: workingDir,
      timeoutMs: 10 * 60 * 1000,
      signal,
    });

    while (true) {
      while (queue.length > 0) {
        const ev = queue.shift()!;
        switch (ev.kind) {
          case "stdout": {
            const parsed = parseStreamLine(ev.line, runId, agentId);
            if (parsed) {
              if (parsed.type === "run_completed") {
                console.log(`[adapter] 🏁 YIELD run_completed (from stream-json result type)`);
              }
              yield parsed;
              if (isStreamComplete(ev.line)) {
                crashLog(`[codex] isStreamComplete=true — generator RETURN`);
                return;
              }
            }
            break;
          }
          case "stderr":
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
            crashLog(`[codex] Process exited code=${ev.code} — returning from generator`);
            if (ev.code === 0) {
              yield { type: "run_completed", runId, summary: `${this.platform} run completed`, timestamp: Date.now() };
            } else {
              yield { type: "run_failed", runId, error: `Exit code ${ev.code}`, timestamp: Date.now() };
            }
            return;
          }
        }
      }

      if (finished && queue.length === 0) return;

      // Idle watchdog: if the process hasn't produced any output for 3 minutes,
      // kill it — prevents "thinking forever" when the CLI hangs.
      const idle = Date.now() - lastActivity;
      if (idle > IDLE_KILL_MS) {
        console.warn(`[adapter] ${processId}: idle ${idle}ms — killing hung process`);
        sup.stop(processId);
        finished = true;
        queue.push({ kind: "error", error: `Process killed after ${Math.round(idle / 1000)}s idle` });
        continue; // drain the error event
      }

      if (signal?.aborted) {
        sup.stop(processId);
        return;
      }

      // Wait for more events with a 30s wake-up to re-check idle/abort.
      while (queue.length === 0 && !finished && !signal?.aborted) {
        await Promise.race([
          new Promise<void>((resolve) => { resolveWait = resolve; }),
          new Promise<void>((resolve) => setTimeout(resolve, WAKEUP_INTERVAL_MS)),
        ]);
      }
    }
  }

  async stop(runId: string): Promise<void> {
    const sup = new ProcessSupervisor();
    sup.stop(`${this.platform}-${runId}`);
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
