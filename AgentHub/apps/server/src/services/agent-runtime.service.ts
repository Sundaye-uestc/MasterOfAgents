// ============================================================
// AgentRuntimeService — Agent adapter lifecycle & run management
// ============================================================

import { ClaudeCodeAdapter } from "../adapters/claude-code.adapter.js";
import { CodexAdapter } from "../adapters/codex.adapter.js";
import type { AgentPlatformAdapter } from "../adapters/base.js";
import type { AgentEvent, AgentConfig } from "@agenthub/shared";
import { getDb, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import type { ChatService } from "./chat.service.js";
import { WorkspaceService } from "./workspace.service.js";
import { broadcastToConversation } from "../ws/gateway.js";

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
  private runAdapterMap = new Map<string, string>(); // runId -> agentConfigId

  async getAdapter(agentConfig: AgentConfig): Promise<AgentPlatformAdapter> {
    const key = agentConfig.id;
    let adapter = this.adapters.get(key);
    if (!adapter) {
      const kind = agentConfig.platform ?? "claude-code";
      // Try CodexAdapter only if codex/opencode CLI is available; fallback to ClaudeCodeAdapter
      if (kind === "codex" || kind === "opencode") {
        adapter = new CodexAdapter({ platform: kind });
        try {
          await adapter.prepare(agentConfig);
        } catch (err) {
          console.warn(`[runtime] CodexAdapter prepare failed (${(err as Error).message}), falling back to ClaudeCodeAdapter`);
          adapter = new ClaudeCodeAdapter();
          await adapter.prepare(agentConfig);
        }
      } else {
        adapter = new ClaudeCodeAdapter();
        await adapter.prepare(agentConfig);
      }
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

    // Build conversation history for short-term memory context
    let messageHistory: Array<{ role: "user" | "agent" | "system"; content: string }> | undefined;
    try {
      messageHistory = await chatService.buildAgentContext(conversationId);
    } catch (err) {
      console.warn(`[runtime] Failed to build agent context: ${(err as Error).message}`);
    }

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

    // Create agent message placeholder (streaming so WS message:created shows "思考中")
    const agentMsg = await chatService.createMessage({
      conversationId,
      role: "agent",
      content: "",
      agentId,
      runId,
      status: "streaming",
    });

    const abortController = new AbortController();
    this.activeRuns.set(runId, abortController);

    const adapter = await this.getAdapter(agentConfig);
    this.runAdapterMap.set(runId, agentConfig.id);

    const workspaceSvc = new WorkspaceService();

    // Run async — stream events back through callback
    (async () => {
      let beforeSnapshotId: string | null = null;

      // Ensure workspace exists BEFORE the run so we can use it as workingDir
      let workspaceRoot: string | null = null;
      try {
        const ws = await workspaceSvc.ensureWorkspace(conversationId);
        workspaceRoot = ws.rootPath;
        const beforeManifest = workspaceSvc.generateManifest(ws.rootPath);
        const beforeSnap = await workspaceSvc.createSnapshot(ws.id, runId, "before", beforeManifest);
        beforeSnapshotId = beforeSnap.id;
      } catch (snapErr) {
        console.warn(`[runtime] Failed to create before snapshot: ${(snapErr as Error).message}`);
      }

      try {
        const stream = adapter.run({
          runId,
          agentId,
          prompt,
          systemPrompt,
          messageHistory,
          workingDir: workspaceRoot ?? process.cwd(),

          signal: abortController.signal,
        });

        // Defer run_completed until AFTER diffSnapshots, so the frontend
        // always sees file changes when it calls load() on run:completed.
        let deferredCompletedEvent: AgentEvent | null = null;
        let eventCount = 0;

        for await (const event of stream) {
          eventCount++;
          // Defer run_completed / run_failed until after snapshot diffing
          if (event.type === "run_completed" || event.type === "run_failed") {
            console.log(`[runtime] ⏸️  Deferring ${event.type} event (total events: ${eventCount})`);
            deferredCompletedEvent = event;
            continue;
          }

          onEvent(event, agentMsg.id);

          // Persist tool invocations
          if (event.type === "tool_call") {
            db.insert(schema.toolInvocations).values({
              id: event.toolCallId || newId(),
              runId,
              agentId,
              toolName: event.toolName,
              inputJson: JSON.stringify(event.input),
              status: "running",
              startedAt: nowISO(),
            }).run();
          }

          // Persist tool results
          if (event.type === "tool_result") {
            db.update(schema.toolInvocations)
              .set({
                outputJson: event.output,
                status: event.isError ? "error" : "success",
                completedAt: nowISO(),
              } as any)
              .where(eq(schema.toolInvocations.id, event.toolCallId))
              .run();
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

        // --- Create after snapshot + diff ---
        try {
          const ws = await workspaceSvc.ensureWorkspace(conversationId);
          const afterManifest = workspaceSvc.generateManifest(ws.rootPath);
          const afterSnap = await workspaceSvc.createSnapshot(ws.id, runId, "after", afterManifest);
          if (beforeSnapshotId) {
            console.log(`[runtime] 🔍 Running diffSnapshots: before=${beforeSnapshotId.slice(0,8)}... after=${afterSnap.id.slice(0,8)}...`);
            const changes = await workspaceSvc.diffSnapshots(beforeSnapshotId, afterSnap.id);
            console.log(`[runtime] 📁 diffSnapshots found ${changes.length} file change(s): ${changes.map(c => `${c.changeType}:${c.path}`).join(', ') || '(none)'}`);
            // Broadcast each file change so the frontend updates in real-time
            for (const fc of changes) {
              console.log(`[runtime] 📤 Broadcasting file:changed — ${fc.changeType}:${fc.path}`);
              broadcastToConversation(conversationId, {
                type: "file:changed",
                change: fc,
              });
            }
          } else {
            console.warn(`[runtime] ⚠️  No beforeSnapshotId — skipping diffSnapshots`);
          }
        } catch (snapErr) {
          console.warn(`[runtime] Failed to create after snapshot: ${(snapErr as Error).message}`);
        }

        // --- Now emit the deferred run_completed / run_failed ---
        // This MUST happen after diffSnapshots so the frontend's load() HTTP
        // request always finds file changes in the DB.
        if (deferredCompletedEvent) {
          console.log(`[runtime] ▶️  Emitting deferred ${deferredCompletedEvent.type} — diffSnapshots completed before this`);
          onEvent(deferredCompletedEvent, agentMsg.id);
        } else {
          console.warn(`[runtime] ⚠️  No deferred completion event — run_completed/run_failed was never captured from stream`);
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

  async handlePermissionResponse(runId: string, permissionId: string, approved: boolean): Promise<void> {
    const agentConfigId = this.runAdapterMap.get(runId);
    if (!agentConfigId) {
      console.warn(`[runtime] no adapter mapping for run ${runId}`);
      return;
    }
    const adapter = this.adapters.get(agentConfigId);
    if (!adapter) {
      console.warn(`[runtime] adapter not found for ${agentConfigId}`);
      return;
    }
    // Call respondToPermission if the adapter supports it
    if ("respondToPermission" in adapter && typeof (adapter as any).respondToPermission === "function") {
      (adapter as any).respondToPermission(runId, permissionId, approved ? "allow" : "deny");
    }
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
