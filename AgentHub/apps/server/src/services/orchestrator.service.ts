// ============================================================
// OrchestratorService — multi-agent task orchestration
// Plans via PlannerService, schedules via DAG, executes via
// AgentRuntimeService.
// ============================================================

import type { TaskPlan, TaskPlanItem } from "@agenthub/shared";
import type { AgentConfig } from "@agenthub/shared";
import { PlannerService } from "./planner.service.js";
import type { ChatService } from "./chat.service.js";
import { getAgentRuntimeService } from "./agent-runtime.service.js";
import { getDb, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import { broadcastToConversation, agentEventToWsEvent } from "../ws/gateway.js";
import type { AgentEvent } from "@agenthub/shared";

interface OrchestrationState {
  runId: string;
  plan: TaskPlan;
  completedTasks: Set<string>;
  failedTasks: Set<string>;
  activeTasks: Map<string, string>; // taskId -> subRunId
  agentBusy: Set<string>;           // agentIds currently executing
}

export class OrchestratorService {
  private planner: PlannerService;
  private chatService: ChatService;
  private activeOrchestrations = new Map<string, OrchestrationState>();
  private runtime = getAgentRuntimeService();

  constructor(chatService: ChatService, planner?: PlannerService) {
    this.chatService = chatService;
    this.planner = planner ?? new PlannerService();
  }

  async startOrchestratedRun(params: {
    conversationId: string;
    triggerMessageId: string;
    prompt: string;
    agentConfigs: AgentConfig[];
    systemPrompt?: string;
  }): Promise<{ runId: string; plan: TaskPlan }> {
    const { conversationId, triggerMessageId, prompt, agentConfigs } = params;
    const db = getDb();
    const runId = newId();
    const now = nowISO();

    // Create orchestrated run record
    db.insert(schema.runs).values({
      id: runId,
      conversationId,
      triggerMessageId,
      mode: "orchestrated",
      status: "running",
      plannerModel: this.planner["model"] ?? "claude-sonnet-4-6",
      startedAt: now,
      createdAt: now,
    }).run();

    // Plan the task decomposition — try @mention-based first
    const agentInfos = agentConfigs.map((a) => ({
      id: a.id,
      name: a.name,
      capabilities: a.capabilities?.map((c: any) => c.label ?? c) ?? [],
    }));

    // Build conversation history for planner context
    let conversationHistory: string | undefined;
    try {
      const historyEntries = await this.chatService.buildAgentContext(conversationId);
      if (historyEntries.length > 0) {
        conversationHistory = historyEntries
          .map((m) => `[${m.role === "user" ? "用户" : m.role === "agent" ? "AI助手" : "系统"}]: ${m.content}`)
          .join("\n\n");
      }
    } catch (err) {
      console.warn(`[orchestrator] Failed to build conversation history: ${(err as Error).message}`);
    }

    // Detect if this is a follow-up message (conversation has prior completed/failed
    // orchestrated runs). If so, inject a hint so the Planner creates a fix/refinement
    // plan instead of re-decomposing the original task from scratch.
    let effectivePrompt = prompt;
    try {
      const priorRuns = db.select()
        .from(schema.runs)
        .where(eq(schema.runs.conversationId, conversationId))
        .all() as any[];
      const hasPriorCompletedRun = priorRuns.some(
        (r: any) => r.mode === "orchestrated" && (r.status === "completed" || r.status === "failed")
      );
      if (hasPriorCompletedRun) {
        effectivePrompt = `[上下文：这是用户对上一轮任务执行结果的反馈或后续请求，不是全新的独立任务。请先判断用户意图——
- 如果用户报告了 BUG、指出问题、要求修复 → 只创建 1 个修复/改进任务，分配给合适的 Agent
- 如果用户要求微调、改进、补充 → 创建针对性的调整任务
- 只有当用户提出完全不同的新需求时，才按正常流程分解
关键：不要重复创建对话历史中已经完成的任务。]

${prompt}`;
      }
    } catch (err) {
      console.warn(`[orchestrator] Failed to check prior runs: ${(err as Error).message}`);
    }

    const plan = this.parseMentionedTasks(prompt, agentConfigs) ??
      await this.planner.generateTaskPlan({
        prompt: effectivePrompt,
        availableAgents: agentInfos,
        conversationHistory,
      });

    // Create task records in DB with UUID mapping — planner uses fixed IDs
    // like "task-1"/"task-2" which collide across runs, so we remap them.
    const idMap = new Map<string, string>(); // plannerId → realId
    for (const task of plan.tasks) {
      const realId = newId();
      idMap.set(task.id, realId);
    }

    // Replace task IDs and dependency references in the plan
    const remappedPlan: TaskPlan = {
      ...plan,
      tasks: plan.tasks.map((t) => ({
        ...t,
        id: idMap.get(t.id) ?? t.id,
        dependencies: t.dependencies.map((d) => idMap.get(d) ?? d),
      })),
    };

    for (const task of remappedPlan.tasks) {
      db.insert(schema.tasks).values({
        id: task.id,
        runId,
        agentId: task.agentId,
        title: task.title,
        description: task.description,
        dependenciesJson: JSON.stringify(task.dependencies),
        status: "queued",
        expectedOutput: task.expectedOutput,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    // Persist the remapped plan (with real IDs) to the run record
    db.update(schema.runs)
      .set({ planJson: JSON.stringify(remappedPlan) } as any)
      .where(eq(schema.runs.id, runId))
      .run();

    // Broadcast remapped plan to clients
    broadcastToConversation(conversationId, {
      type: "orchestrator:plan_created",
      runId,
      plan: remappedPlan as any,
    });

    // Init orchestration state
    const state: OrchestrationState = {
      runId,
      plan: remappedPlan,
      completedTasks: new Set(),
      failedTasks: new Set(),
      activeTasks: new Map(),
      agentBusy: new Set(),
    };
    this.activeOrchestrations.set(runId, state);

    // Create a compact system message with the plan summary
    const agentNameMap = new Map(agentConfigs.map((a) => [a.id, a.name]));
    const planSummary = remappedPlan.tasks.map((t: TaskPlanItem, i: number) => `${i + 1}. ${t.title} → ${agentNameMap.get(t.agentId) ?? t.agentId}`).join("  ·  ");
    const reasoningLine = remappedPlan.reasoning ? ` — ${remappedPlan.reasoning}` : "";
    await this.chatService.createMessage({
      conversationId,
      role: "system",
      content: `任务已分解为 ${plan.tasks.length} 个子任务：${planSummary}${reasoningLine}`,
      runId,
    });

    // Kick off scheduling
    await this.scheduleReadyTasks(runId, conversationId, agentConfigs, params.systemPrompt);

    return { runId, plan: remappedPlan };
  }

  /** Parse @agent mentions from prompt and create tasks directly (no LLM needed) */
  private parseMentionedTasks(
    prompt: string,
    agentConfigs: AgentConfig[]
  ): TaskPlan | null {
    // Find all @agent occurrences by matching against known agent names
    interface AgentMatch { agent: AgentConfig; position: number; endPos: number }
    const found: AgentMatch[] = [];

    for (const agent of agentConfigs) {
      const nameParts = agent.name.split(/\s+/);
      // Try matching the full name first, then first word
      const patterns = [agent.name];
      if (nameParts.length > 1 && nameParts[0]) {
        patterns.push(nameParts[0]);
      }
      // Also match by id
      patterns.push(agent.id);

      for (const pattern of patterns) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`@${escaped}\\b`, 'gi');
        let m: RegExpExecArray | null;
        while ((m = regex.exec(prompt)) !== null) {
          // Avoid duplicates at same position
          if (!found.some((f) => f.position === m!.index)) {
            found.push({ agent, position: m!.index, endPos: m!.index + m![0].length });
          }
        }
      }
    }

    if (found.length === 0) return null;

    // Sort by position
    found.sort((a, b) => a.position - b.position);

    // Split prompt by @agent mentions to get per-agent tasks
    const segments: Array<{ agent: AgentConfig; task: string }> = [];
    for (let i = 0; i < found.length; i++) {
      const current = found[i]!;
      const next = found[i + 1];
      const taskStart = current.endPos;
      const taskEnd = next ? next.position : prompt.length;
      let task = prompt.substring(taskStart, taskEnd).trim();
      if (task.startsWith("@")) {
        task = task.substring(task.indexOf(" ") + 1).trim();
      }
      if (task) {
        segments.push({ agent: current.agent, task });
      }
    }

    if (segments.length === 0) return null;

    const tasks: TaskPlanItem[] = [];
    const seenAgents = new Set<string>();

    for (const seg of segments) {
      if (seenAgents.has(seg.agent.id)) continue;
      seenAgents.add(seg.agent.id);

      tasks.push({
        id: newId(),
        title: seg.task.length > 40 ? seg.task.substring(0, 40) + "..." : seg.task,
        description: seg.task,
        agentId: seg.agent.id,
        dependencies: [],
        expectedOutput: `完成：${seg.task}`,
        riskLevel: "low",
        writeScope: [],
      });
    }

    if (tasks.length === 0) return null;

    return {
      planId: newId(),
      tasks,
      reasoning: `从用户消息中解析了 ${tasks.length} 个 @Agent 指定任务`,
      estimatedRounds: 1,
    };
  }

  private async scheduleReadyTasks(
    runId: string,
    conversationId: string,
    agentConfigs: AgentConfig[],
    systemPrompt?: string
  ): Promise<void> {
    const state = this.activeOrchestrations.get(runId);
    if (!state) return;

    const db = getDb();
    const agentMap = new Map(agentConfigs.map((a) => [a.id, a]));

    // Find tasks that are "ready" (all deps completed, not currently running)
    for (const task of state.plan.tasks) {
      if (state.completedTasks.has(task.id)) continue;
      if (state.failedTasks.has(task.id)) continue;
      if (state.activeTasks.has(task.id)) continue;

      // Check dependencies satisfied
      const depsOk = task.dependencies.every((depId) => state.completedTasks.has(depId));
      if (!depsOk) continue;

      // Check agent is not busy
      if (state.agentBusy.has(task.agentId)) continue;

      // Check write-scope overlap with running tasks
      if (task.writeScope && task.writeScope.length > 0) {
        let overlap = false;
        for (const [activeTaskId] of state.activeTasks) {
          const activeTask = state.plan.tasks.find((t) => t.id === activeTaskId);
          if (activeTask?.writeScope && this.hasOverlap(task.writeScope, activeTask.writeScope)) {
            overlap = true;
            break;
          }
        }
        if (overlap) continue;
      }

      // High-risk tasks need confirmation — skip for now, emit event
      if (task.riskLevel === "high") {
        broadcastToConversation(conversationId, {
          type: "orchestrator:confirmation_needed",
          runId,
          taskId: task.id,
          taskTitle: task.title,
        });
        continue;
      }

      // Ready to execute
      await this.executeTask(runId, conversationId, task, agentMap, systemPrompt);
    }

    // Check if all done
    this.checkCompletion(runId, conversationId);
  }

  private async executeTask(
    runId: string,
    conversationId: string,
    task: TaskPlanItem,
    agentMap: Map<string, AgentConfig>,
    systemPrompt?: string,
    retryMsgId?: string
  ): Promise<void> {
    const state = this.activeOrchestrations.get(runId);
    if (!state) return;

    const agentConfig = agentMap.get(task.agentId);
    if (!agentConfig) {
      console.warn(`[orchestrator] agent ${task.agentId} not found for task ${task.id}`);
      state.failedTasks.add(task.id);
      await this.markTaskStatus(task.id, "failed");
      return;
    }

    // Mark task running
    state.agentBusy.add(task.agentId);
    await this.markTaskStatus(task.id, "running");

    broadcastToConversation(conversationId, {
      type: "task:started",
      runId,
      taskId: task.id,
      agentId: task.agentId,
    });

    let currentMsgId: string | null = retryMsgId ?? null;

    const handleEvent = (event: AgentEvent, msgId: string) => {
      if (!currentMsgId) currentMsgId = msgId;
      if (event.type === "text_delta") {
        if (!this.runtime.isRunAborted(event.runId)) {
          this.chatService.appendContent(msgId, event.delta);
        }
      }
      const wsEvent = agentEventToWsEvent(event);
      if (wsEvent) {
        if (wsEvent.type === "message:delta" || wsEvent.type === "tool:invocation") {
          (wsEvent as any).messageId = msgId;
        }
        broadcastToConversation(conversationId, wsEvent);
      }
      if (event.type === "run_completed") {
        broadcastToConversation(conversationId, {
          type: "message:completed",
          messageId: msgId,
        });
        this.handleTaskCompleted({
          runId,
          taskId: task.id,
          resultSummary: "Task completed",
          success: true,
        });
      }
      if (event.type === "run_failed") {
        broadcastToConversation(conversationId, {
          type: "message:completed",
          messageId: msgId,
        });
        this.handleTaskCompleted({
          runId,
          taskId: task.id,
          resultSummary: event.error ?? "Task failed",
          success: false,
        });
      }
    };

    try {
      const { runId: subRunId } = await this.runtime.startDirectRun({
        conversationId,
        agentId: task.agentId,
        agentConfig,
        prompt: `${task.description}\n\nExpected output: ${task.expectedOutput}`,
        systemPrompt,
        chatService: this.chatService,
        onEvent: handleEvent,
      });

      state.activeTasks.set(task.id, subRunId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[orchestrator] task ${task.id} execution error: ${errorMsg}`);

      // Retry once — reuse the same agent message ID to avoid duplicates
      if (this.shouldRetry(task)) {
        console.log(`[orchestrator] retrying task ${task.id}`);
        try {
          const { runId: subRunId } = await this.runtime.startDirectRun({
            conversationId,
            agentId: task.agentId,
            agentConfig: agentMap.get(task.agentId)!,
            prompt: `${task.description}\n\nExpected output: ${task.expectedOutput}\n\nPREVIOUS ATTEMPT FAILED: ${errorMsg}`,
            systemPrompt,
            chatService: this.chatService,
            onEvent: handleEvent,
          });
          state.activeTasks.set(task.id, subRunId);
          return;
        } catch (retryErr) {
          console.error(`[orchestrator] task ${task.id} retry also failed:`, retryErr);
        }
      }

      state.agentBusy.delete(task.agentId);
      state.failedTasks.add(task.id);
      await this.markTaskStatus(task.id, "failed");

      // Send message:completed to close streaming on the agent message
      if (currentMsgId) {
        broadcastToConversation(conversationId, {
          type: "message:completed",
          messageId: currentMsgId,
        });
      }

      broadcastToConversation(conversationId, {
        type: "task:failed",
        runId,
        taskId: task.id,
        error: errorMsg,
      });

      // Block dependent tasks
      await this.blockDependentTasks(runId, task.id, conversationId);
      this.checkCompletion(runId, conversationId);
    }
  }

  async handleTaskCompleted(params: {
    runId: string;
    taskId: string;
    resultSummary: string;
    success: boolean;
  }): Promise<void> {
    const state = this.activeOrchestrations.get(params.runId);
    if (!state) return;

    const task = state.plan.tasks.find((t) => t.id === params.taskId);
    if (!task) return;

    state.activeTasks.delete(params.taskId);
    state.agentBusy.delete(task.agentId);

    if (params.success) {
      state.completedTasks.add(params.taskId);
      await this.markTaskStatus(params.taskId, "completed", params.resultSummary);

      // Find conversationId from the run
      const db = getDb();
      const run = db.select().from(schema.runs).where(eq(schema.runs.id, params.runId)).get() as any;
      const conversationId = run?.conversationId ?? run?.conversation_id;

      broadcastToConversation(conversationId, {
        type: "task:completed",
        runId: params.runId,
        taskId: params.taskId,
        resultSummary: params.resultSummary,
      });

      broadcastToConversation(conversationId, {
        type: "run:status",
        runId: params.runId,
        status: "running",
        progress: {
          completed: state.completedTasks.size,
          total: state.plan.tasks.length,
        },
      });
    } else {
      state.failedTasks.add(params.taskId);
      await this.markTaskStatus(params.taskId, "failed");
    }

    // Find agent configs and continue scheduling
    const db2 = getDb();
    const run2 = db2.select().from(schema.runs).where(eq(schema.runs.id, params.runId)).get() as any;
    const convId = run2?.conversationId ?? run2?.conversation_id;

    // Build agent configs from the plan tasks — look up real names from DB
    const agentIds = [...new Set(state.plan.tasks.map((t) => t.agentId))];
    const agentRows = db2.select().from(schema.agents).all() as any[];
    const agentNameById = new Map<string, string>();
    for (const row of agentRows) {
      agentNameById.set(row.id, row.name);
    }
    const agentConfigs: AgentConfig[] = agentIds.map((id) => ({
      id,
      name: agentNameById.get(id) ?? id,
      platform: "claude-code" as const,
      status: "online" as const,
      capabilities: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    await this.scheduleReadyTasks(params.runId, convId, agentConfigs);
    this.checkCompletion(params.runId, convId);
  }

  async stopOrchestration(runId: string): Promise<void> {
    const state = this.activeOrchestrations.get(runId);
    if (!state) return;

    // Stop all active sub-runs
    for (const [, subRunId] of state.activeTasks) {
      await this.runtime.stopRun(subRunId);
    }

    const db = getDb();
    db.update(schema.runs)
      .set({ status: "cancelled", completedAt: nowISO() } as any)
      .where(eq(schema.runs.id, runId))
      .run();

    this.activeOrchestrations.delete(runId);
  }

  // --- Private helpers ---

  private async checkCompletion(runId: string, conversationId: string): Promise<void> {
    const state = this.activeOrchestrations.get(runId);
    if (!state) return;

    const totalDone = state.completedTasks.size + state.failedTasks.size;
    if (totalDone >= state.plan.tasks.length) {
      await this.aggregateRun(runId, conversationId);
    }
  }

  private async aggregateRun(runId: string, conversationId: string): Promise<void> {
    const state = this.activeOrchestrations.get(runId);
    if (!state) return;

    const db = getDb();
    const now = nowISO();

    const completed = state.completedTasks.size;
    const failed = state.failedTasks.size;
    const total = state.plan.tasks.length;

    const status = failed > 0 ? "failed" : "completed";

    db.update(schema.runs)
      .set({ status, completedAt: now } as any)
      .where(eq(schema.runs.id, runId))
      .run();

    // Create compact aggregate summary (single line)
    const summaryItems = state.plan.tasks.map((t) => {
      const icon = state.completedTasks.has(t.id) ? "✅" : state.failedTasks.has(t.id) ? "❌" : "⏭️";
      return `${icon} ${t.title}`;
    });
    await this.chatService.createMessage({
      conversationId,
      role: "system",
      content: `任务执行完成 (${completed}/${total} 成功${failed > 0 ? `, ${failed} 失败` : ""}) — ${summaryItems.join("  ")}`,
      runId,
    });

    broadcastToConversation(conversationId, {
      type: "run:completed",
      runId,
    });

    this.activeOrchestrations.delete(runId);
  }

  private async markTaskStatus(taskId: string, status: string, resultSummary?: string): Promise<void> {
    const db = getDb();
    const updates: any = { status, updatedAt: nowISO() };
    if (resultSummary) updates.resultSummary = resultSummary;
    db.update(schema.tasks).set(updates).where(eq(schema.tasks.id, taskId)).run();
  }

  private async blockDependentTasks(runId: string, failedTaskId: string, conversationId: string): Promise<void> {
    const state = this.activeOrchestrations.get(runId);
    if (!state) return;

    for (const task of state.plan.tasks) {
      if (task.dependencies.includes(failedTaskId) && !state.completedTasks.has(task.id)) {
        await this.markTaskStatus(task.id, "blocked");
        state.failedTasks.add(task.id);
      }
    }
  }

  private shouldRetry(task: TaskPlanItem): boolean {
    // Retry tasks that have a writeScope or are medium risk
    return task.riskLevel === "medium" || task.riskLevel === "low";
  }

  private hasOverlap(a: string[], b: string[]): boolean {
    const normalize = (p: string) => p.replace(/\/+$/, "") + "/";
    for (const path of a) {
      const np = normalize(path);
      for (const other of b) {
        const no = normalize(other);
        if (np === no) return true;
        if (np.startsWith(no) || no.startsWith(np)) return true;
      }
    }
    return false;
  }
}

let orchestratorSingleton: OrchestratorService | null = null;

export function getOrchestratorService(chatService: ChatService): OrchestratorService {
  if (!orchestratorSingleton) {
    orchestratorSingleton = new OrchestratorService(chatService);
  }
  return orchestratorSingleton;
}
