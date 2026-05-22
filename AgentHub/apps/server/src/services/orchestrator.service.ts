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
import { broadcastToConversation } from "../ws/gateway.js";

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

    // Plan the task decomposition
    const availableAgents = agentConfigs.map((a) => ({
      id: a.id,
      name: a.name,
      capabilities: a.capabilities?.map((c: any) => c.label ?? c) ?? [],
    }));

    const plan = await this.planner.generateTaskPlan({
      prompt,
      availableAgents,
    });

    // Persist plan to run
    db.update(schema.runs)
      .set({ planJson: JSON.stringify(plan) } as any)
      .where(eq(schema.runs.id, runId))
      .run();

    // Create task records in DB
    for (const task of plan.tasks) {
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

    // Broadcast plan to clients
    broadcastToConversation(conversationId, {
      type: "orchestrator:plan_created",
      runId,
      plan: plan as any,
    });

    // Init orchestration state
    const state: OrchestrationState = {
      runId,
      plan,
      completedTasks: new Set(),
      failedTasks: new Set(),
      activeTasks: new Map(),
      agentBusy: new Set(),
    };
    this.activeOrchestrations.set(runId, state);

    // Create a system message with the plan summary
    const planSummary = plan.tasks.map((t, i) => `${i + 1}. **${t.title}** → ${t.agentId}`).join("\n");
    await this.chatService.createMessage({
      conversationId,
      role: "system",
      content: `任务已分解为 ${plan.tasks.length} 个子任务：\n${planSummary}\n\n${plan.reasoning}`,
      runId,
    });

    // Kick off scheduling
    await this.scheduleReadyTasks(runId, conversationId, agentConfigs, params.systemPrompt);

    return { runId, plan };
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
    systemPrompt?: string
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

    try {
      const { runId: subRunId } = await this.runtime.startDirectRun({
        conversationId,
        agentId: task.agentId,
        agentConfig,
        prompt: `${task.description}\n\nExpected output: ${task.expectedOutput}`,
        systemPrompt,
        chatService: this.chatService,
        onEvent: (event, msgId) => {
          // Delegate text deltas and other events to the existing streaming flow
          // The conversations.ts route handler already handles the WS broadcast
        },
      });

      state.activeTasks.set(task.id, subRunId);

      // In a real implementation, we'd wait for the run to complete via the existing
      // event stream. For now, we track the sub-run and the caller (
      // conversations.ts onEvent callback) will call handleTaskCompleted
      // when the run finishes.
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[orchestrator] task ${task.id} execution error: ${errorMsg}`);

      // Retry once
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
            onEvent: () => {},
          });
          state.activeTasks.set(task.id, subRunId);
          return;
        } catch {
          // Retry also failed
        }
      }

      state.agentBusy.delete(task.agentId);
      state.failedTasks.add(task.id);
      await this.markTaskStatus(task.id, "failed");

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

    // Build agent configs from the plan tasks
    const agentIds = [...new Set(state.plan.tasks.map((t) => t.agentId))];
    const agentConfigs: AgentConfig[] = agentIds.map((id) => ({
      id,
      name: id,
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

    // Create aggregate summary message
    const summaryLines = state.plan.tasks.map((t) => {
      const icon = state.completedTasks.has(t.id) ? "✅" : state.failedTasks.has(t.id) ? "❌" : "⏭️";
      return `${icon} ${t.title}`;
    });
    await this.chatService.createMessage({
      conversationId,
      role: "system",
      content: `任务执行完成 (${completed}/${total} 成功${failed > 0 ? `, ${failed} 失败` : ""})\n\n${summaryLines.join("\n")}`,
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
