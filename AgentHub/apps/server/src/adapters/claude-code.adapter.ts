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
import { crashLog } from "../lib/crash-log.js";
import * as path from "node:path";
import * as fs from "node:fs";

export class ClaudeCodeAdapter implements AgentPlatformAdapter {
  readonly platform = "claude-code";

  private supervisor = new ProcessSupervisor();
  private agentConfig: AgentConfig | null = null;
  private activeRunIds = new Set<string>();
  private activeSupervisors = new Map<string, ProcessSupervisor>();
  private permissionMode: "bypass" | "interactive";

  constructor(options?: { permissionMode?: "bypass" | "interactive" }) {
    this.permissionMode = options?.permissionMode ?? "bypass";
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

    const { runId, agentId, prompt, systemPrompt, messageHistory, workingDir, signal } = input;
    this.activeRunIds.add(runId);

    crashLog(`[claude] run() entered, about to yield run_started`);
    const ts = Date.now();
    yield { type: "run_started", runId, agentId, timestamp: ts };
    crashLog(`[claude] run_started yielded, building args...`);

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

你可以为用户生成 PPT。系统会在你完成后**自动**生成 HTML 在线预览和幻灯片图片，用户无需下载即可在聊天界面直接翻页查看。因此你**不需要**做任何形式的质量检查——那是系统的职责，不是你的。

你的任务只有两步：**生成 → 告知完成**。仅此而已。

### 方式一：AI 图示幻灯片（推荐）
1. 创建 slides_plan.json（page_type: cover / content / data）
2. 执行 \`python ${pptDir.replace(/\\/g, '\\\\')}\\\\generate_ppt.py --plan slides_plan.json --style gradient-glass --resolution 2K --output ppt_output\`

### 方式二：程序化 PPTX
使用 pptxgenjs 直接生成 .pptx 文件。

### 🚫 严禁的 QA 行为（每条都会浪费用户数分钟时间）
- ❌ 提取 PPTX 文本检查内容
- ❌ 用任何方式将 PPTX 导出为图片进行"视觉审查"（包括但不限于 LibreOffice、PowerShell COM、Python 脚本）
- ❌ 启动子代理（sub-agent）做视觉审查或内容审查
- ❌ 做间距/颜色/对齐/对比度的数学验证
- ❌ 生成 QA 报告表格（如"检查项 | Slide 1 | Slide 2"）
- ❌ 说"发现 X 个问题，正在修复"然后重新生成
- ❌ 任何形式的"先审查再修复"循环

### ✅ 正确的完成流程
1. 生成 PPTX 文件
2. 验证文件存在且 >1KB
3. 告诉用户："PPT 已生成，请查看下方预览。如需调整请告诉我。"
4. 结束。不要做任何额外步骤。

### 其他参数
- 风格: gradient-glass (科技商务), vector-illustration (教育培训)
- 分辨率: 2K (推荐), 4K
- 每页约 30 秒，默认 5-7 页
`;
    }
    effectiveSystemPrompt = effectiveSystemPrompt + pptBlock;

    if (effectiveSystemPrompt) {
      args.push("--system-prompt", effectiveSystemPrompt);
    }

    const processId = `claude-${runId}`;
    const sup = new ProcessSupervisor();

    // Set up abort signal listener
    if (signal) {
      signal.addEventListener("abort", () => sup.stop(processId), { once: true });
    }

    try {
      this.activeSupervisors.set(runId, sup);
      crashLog(`[claude] Calling runViaEventEmitter...`);
      const events = this.runViaEventEmitter(sup, processId, args, workingDir, runId, agentId, signal);
      crashLog(`[claude] runViaEventEmitter created, entering for-await...`);
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
      crashLog(`[claude] run() finally — disposing supervisor`);
      this.activeRunIds.delete(runId);
      this.activeSupervisors.delete(runId);
      await sup.dispose();
      crashLog(`[claude] run() finally — supervisor disposed`);
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

    crashLog(`[claude] Calling sup.start() with command="claude" cwd=${workingDir || "default"}`);
    sup.start({
      processId,
      command: "claude",
      args,
      cwd: workingDir,
      timeoutMs: 10 * 60 * 1000,
      signal,
    });
    crashLog(`[claude] sup.start() returned, entering event loop`);

    while (true) {
      // Drain queue
      while (queue.length > 0) {
        const ev = queue.shift()!;
        crashLog(`[claude] Dequeued event kind=${ev.kind} queueRemaining=${queue.length}`);
        switch (ev.kind) {
          case "stdout": {
            crashLog(`[claude] Parsing stdout: ${ev.line.slice(0, 120)}`);
            const parsed = parseStreamLine(ev.line, runId, agentId);
            crashLog(`[claude] Parsed result: ${parsed ? parsed.type : 'null'}`);
            if (parsed) {
              if (parsed.type === "run_completed") {
                crashLog(`[adapter] 🏁 YIELD run_completed (from stream-json ${'result'} type)`);
              }
              crashLog(`[claude] About to yield ${parsed.type}`);
              yield parsed;
              crashLog(`[claude] Yielded ${parsed.type} — back in adapter loop`);
              if (isStreamComplete(ev.line)) {
                crashLog(`[claude] isStreamComplete=true — generator RETURN`);
                return;
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
            crashLog(`[claude] Process exited code=${ev.code} — returning from generator`);
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

      // Check abort
      if (signal?.aborted) {
        sup.stop(processId);
        return;
      }

      // Wait for more events with a 30s wake-up to re-check idle/abort.
      // Resolves when: (a) a new event arrives, (b) signal is aborted,
      // or (c) 30 seconds pass so we can re-check the idle watchdog.
      crashLog(`[claude] Waiting for events (queue=${queue.length} finished=${finished})`);
      while (queue.length === 0 && !finished && !signal?.aborted) {
        await Promise.race([
          new Promise<void>((resolve) => { resolveWait = resolve; }),
          new Promise<void>((resolve) => setTimeout(resolve, WAKEUP_INTERVAL_MS)),
        ]);
        crashLog(`[claude] Woke from wait (queue=${queue.length} finished=${finished} idle=${Date.now() - lastActivity}ms)`);
      }
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
