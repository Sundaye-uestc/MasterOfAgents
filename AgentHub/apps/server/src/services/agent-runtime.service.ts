// ============================================================
// AgentRuntimeService — Agent adapter lifecycle & run management
// ============================================================

import { ClaudeCodeAdapter } from "../adapters/claude-code.adapter.js";
import type { AgentPlatformAdapter } from "../adapters/base.js";
import type { AgentEvent, AgentConfig } from "@agenthub/shared";
import { getDb, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import type { ChatService } from "./chat.service.js";

let singleton: AgentRuntimeService | null = null;

export function getAgentRuntimeService(): AgentRuntimeService {
  if (!singleton) {
    singleton = new AgentRuntimeService();
  }
  return singleton;
}

export class AgentRuntimeService {
  private adapters = new Map<string, AgentPlatformAdapter>();
  private activeRuns = new Map<string, AbortController>();
  private abortedRuns = new Set<string>();

  async getAdapter(agentConfig: AgentConfig): Promise<AgentPlatformAdapter> {
    const key = agentConfig.id;
    let adapter = this.adapters.get(key);
    if (!adapter) {
      // For now, only Claude Code is supported
      adapter = new ClaudeCodeAdapter();
      await adapter.prepare(agentConfig);
      this.adapters.set(key, adapter);
    }
    return adapter;
  }

  /** Start a direct (1v1) run for a conversation */
  async startDirectRun(params: {
    conversationId: string;
    agentId: string;
    agentConfig: AgentConfig;
    prompt: string;
    systemPrompt?: string;
    triggerMessageId?: string;
    chatService: ChatService;
    onEvent: (event: AgentEvent, messageId: string) => void;
  }): Promise<{ runId: string; agentMessageId: string }> {
    const { conversationId, agentId, agentConfig, prompt, systemPrompt, triggerMessageId, chatService, onEvent } = params;

    // Create run record
    const runId = newId();
    const now = nowISO();
    const db = getDb();

    db.insert(schema.runs).values({
      id: runId,
      conversationId,
      triggerMessageId: triggerMessageId ?? null,
      mode: "direct",
      status: "running",
      startedAt: now,
      createdAt: now,
    }).run();

    // Create agent message placeholder
    const agentMsg = await chatService.createMessage({
      conversationId,
      role: "agent",
      content: "",
      agentId,
      runId,
    });

    // Update message status to streaming
    await chatService.updateMessageStatus(agentMsg.id, "streaming");

    const abortController = new AbortController();
    this.activeRuns.set(runId, abortController);

    const adapter = await this.getAdapter(agentConfig);

    // Run async — stream events back through callback
    (async () => {
      try {
        const stream = adapter.run({
          runId,
          agentId,
          prompt,
          systemPrompt,
          workingDir: process.cwd(),
          signal: abortController.signal,
        });

        for await (const event of stream) {
          onEvent(event, agentMsg.id);

          // Persist tool invocations
          if (event.type === "tool_call") {
            db.insert(schema.toolInvocations).values({
              id: newId(),
              runId,
              agentId,
              toolName: event.toolName,
              inputJson: JSON.stringify(event.input),
              status: "running",
              startedAt: nowISO(),
            }).run();
          }

          // Persist file changes
          if (event.type === "file_change") {
            db.insert(schema.fileChanges).values({
              id: newId(),
              runId,
              path: event.path,
              changeType: event.kind,
              diff: (event as any).diff ?? null,
              status: "pending",
              createdAt: nowISO(),
            }).run();
          }
        }

        // Mark completed only if run was not aborted externally
        if (this.activeRuns.has(runId)) {
          db.update(schema.runs)
            .set({ status: "completed", completedAt: nowISO() } as any)
            .where(eq(schema.runs.id, runId))
            .run();
          await chatService.updateMessageStatus(agentMsg.id, "sent");
        } else {
          // Run was aborted — overwrite content and mark as error
          await chatService.setContent(agentMsg.id, "");
          db.update(schema.runs)
            .set({ status: "failed", errorJson: JSON.stringify({ message: "Run aborted by user" }), completedAt: nowISO() } as any)
            .where(eq(schema.runs.id, runId))
            .run();
          await chatService.updateMessageStatus(agentMsg.id, "error");
          this.abortedRuns.delete(runId);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        db.update(schema.runs)
          .set({ status: "failed", errorJson: JSON.stringify({ message: errorMsg }), completedAt: nowISO() } as any)
          .where(eq(schema.runs.id, runId))
          .run();

        await chatService.updateMessageStatus(agentMsg.id, "error");
      } finally {
        this.activeRuns.delete(runId);
      }
    })();

    return { runId, agentMessageId: agentMsg.id };
  }

  isRunAborted(runId: string): boolean {
    return this.abortedRuns.has(runId);
  }

  async stopRun(runId: string): Promise<void> {
    this.abortedRuns.add(runId);
    const controller = this.activeRuns.get(runId);
    if (controller) {
      controller.abort();
      this.activeRuns.delete(runId);
    }
  }

  async getActiveRuns(): Promise<string[]> {
    return Array.from(this.activeRuns.keys());
  }

  async dispose(): Promise<void> {
    for (const [runId, controller] of this.activeRuns) {
      controller.abort();
    }
    this.activeRuns.clear();
    for (const adapter of this.adapters.values()) {
      await adapter.dispose();
    }
    this.adapters.clear();
  }
}
